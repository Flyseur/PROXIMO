import { Link, useParams } from "react-router";
import { useState, useEffect } from "react";
import WhatsAppButton from "../components/WhatsAppButton";
import VoiceAssistant from "../components/VoiceAssistant";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import { fmtDate, api, ApiError, userToken, type ArtisanDetail, type PublicUser } from "../lib/api";

import { I, Rich } from "../components/Icon";
export default function ArtisanProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: a, loading, error } = useFetch<ArtisanDetail>(id ? `/artisans/${id}` : null);
  const [activeTab, setActiveTab] = useState<"portfolio" | "avis" | "infos">("portfolio");

  // État local des avis pour mise à jour instantanée
  const [reviewsList, setReviewsList] = useState<{ name: string; rating: number; text: string; date: string }[]>([]);
  const [currentRating, setCurrentRating] = useState(5);
  const [currentReviewsCount, setCurrentReviewsCount] = useState(0);

  // Formulaire de dépôt d'avis
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (a) {
      setReviewsList(a.reviewsList);
      setCurrentRating(a.rating);
      setCurrentReviewsCount(a.reviews);
    }
  }, [a]);

  // Pré-remplir automatiquement le nom si le client est connecté
  useEffect(() => {
    if (userToken.get()) {
      api.get<{ user: PublicUser }>("/me", "user")
        .then((res) => {
          if (res?.user && !reviewAuthor) {
            setReviewAuthor(`${res.user.firstName} ${res.user.lastName}`.trim());
          }
        })
        .catch(() => {});
    }
  }, []);

  function openReviewForm() {
    setActiveTab("avis");
    setShowReviewForm(true);
    setReviewError("");
    setTimeout(() => {
      document.getElementById("review-form-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!a) return;
    if (!reviewAuthor.trim()) return setReviewError("Veuillez renseigner votre nom ou prénom.");
    if (!reviewText.trim() || reviewText.trim().length < 2) return setReviewError("Votre avis doit contenir au moins 2 caractères.");
    setSubmittingReview(true);
    setReviewError("");
    try {
      const res = await api.post<{ review: { name: string; rating: number; text: string; date: string }; artisan: { rating: number; reviews: number } }>(
        `/artisans/${a.id}/reviews`,
        { author: reviewAuthor.trim(), rating: reviewRating, text: reviewText.trim() }
      );
      setReviewsList((prev) => [res.review, ...prev]);
      setCurrentRating(res.artisan.rating);
      setCurrentReviewsCount(res.artisan.reviews);
      setReviewSuccess(true);
      setReviewText("");
      setTimeout(() => {
        setShowReviewForm(false);
        setReviewSuccess(false);
      }, 3500);
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Impossible d'enregistrer votre avis. Veuillez réessayer.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !a) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <ErrorBox message={error?.status === 404 ? "Ce profil n'existe pas ou n'est plus disponible." : (error?.message ?? "Erreur de chargement.")} />
        <Link to="/recherche" className="inline-block mt-6 text-[#F26522] font-bold hover:underline"><I e="←" /> Retour à la recherche</Link>
      </div>
    );
  }

  const profileText = `${a.name} est ${a.trade} basé à ${a.commune}. Noté ${currentRating} étoiles sur ${currentReviewsCount} avis. Tarif : ${a.price}. ${a.available ? "Disponible maintenant." : "Actuellement occupé."}`;
  const fullStars = Math.round(currentRating);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <nav className="text-sm text-[#6B7280] mb-8 flex items-center gap-2" aria-label="Fil d'Ariane">
        <Link to="/" className="hover:text-[#F26522] transition-colors"><I e="🏠" /> Accueil</Link><span aria-hidden="true">/</span>
        <Link to="/recherche" className="hover:text-[#F26522] transition-colors"><I e="🔍" /> Recherche</Link><span aria-hidden="true">/</span>
        <span className="text-[#1D4E5B] font-semibold">{a.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="flex items-start gap-6 mb-8 p-6 bg-[#F4F8F9] rounded-2xl border-2 border-[#E8F2F5]">
            {a.img ? (
              <img src={a.img} alt={`Photo de profil de ${a.name}`} className="w-24 h-24 rounded-2xl object-cover bg-[#E8F2F5] flex-shrink-0 shadow-sm" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1D4E5B] to-[#2B6D7F] text-white flex items-center justify-center text-3xl font-black flex-shrink-0 shadow-sm">
                {a.name.split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "PRO"}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-4xl text-[#1D4E5B]">{a.name}</h1>
                  <p className="text-[#6B7280] text-lg mt-1 font-medium">{a.trade}</p>
                  <p className="text-sm text-[#F26522] font-bold mt-1"><I e="📍" /> {a.commune}{a.zone ? ` · ${a.zone}` : ""}</p>
                </div>
                <span className={`text-sm px-3 py-1.5 rounded-full font-bold flex-shrink-0 ${a.available ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`}>{a.available ? <Rich text={"✓ Disponible"} /> : <Rich text={"✗ Occupé"} />}</span>
              </div>
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                <button
                  type="button"
                  onClick={openReviewForm}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group text-left"
                  title="Voir les avis ou laisser un avis"
                >
                  <div className="flex items-center gap-1 text-base" aria-label={`Note moyenne : ${currentRating} sur 5`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <I key={s} e="★" className={s <= fullStars ? "text-amber-400 drop-shadow-xs" : "text-gray-300"} />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-[#1D4E5B] ml-1">{currentRating}</span>
                  <span className="text-sm text-[#F26522] group-hover:underline font-semibold ml-1">({currentReviewsCount} avis · Noter <I e="✍️" />)</span>
                </button>
                {a.years != null && (<><span className="text-[#D1D9DC]">|</span><span className="text-sm text-[#6B7280]"><I e="⏱" /> {a.years} ans d'expérience</span></>)}
                {a.verified && (<><span className="text-[#D1D9DC]">|</span><span className="text-sm text-[#6B7280]"><I e="🏅" /> Certifié</span></>)}
              </div>
              <div className="mt-4"><VoiceAssistant label="Écouter ce profil" text={profileText} /></div>
            </div>
          </div>

          <div className="border-b-2 border-[#E8F2F5] mb-8" role="tablist" aria-label="Sections du profil">
            {([["portfolio", "🖼️ Portfolio"], ["avis", "⭐ Avis clients"], ["infos", "ℹ️ Informations"]] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab}
                className={`px-5 pb-4 text-sm font-bold transition-colors border-b-2 -mb-[2px] mr-2 ${activeTab === tab ? "border-[#F26522] text-[#F26522]" : "border-transparent text-[#6B7280] hover:text-[#1D4E5B]"}`}><Rich text={label} /></button>
            ))}
          </div>

          <div role="tabpanel">
            {activeTab === "portfolio" && (
              a.portfolio.length ? (
                <div className="grid grid-cols-2 gap-4">
                  {a.portfolio.map((src, i) => <img key={i} src={src} alt={`Réalisation ${i + 1} par ${a.name}`} className="rounded-2xl object-cover w-full h-48 bg-[#E8F2F5]" />)}
                </div>
              ) : <p className="text-[#6B7280]">Cet artisan n'a pas encore ajouté de réalisations.</p>
            )}

            {activeTab === "avis" && (
              <div className="flex flex-col gap-6">
                {/* Header score & CTA */}
                <div className="bg-[#F4F8F9] rounded-2xl p-6 border-2 border-[#E8F2F5] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-extrabold text-[#1D4E5B]">{currentRating}</div>
                    <div>
                      <div className="flex items-center gap-1 text-xl">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <I key={s} e="★" className={s <= Math.round(currentRating) ? "text-amber-400 drop-shadow-xs" : "text-gray-300"} />
                        ))}
                      </div>
                      <p className="text-xs text-[#6B7280] font-semibold mt-0.5">{currentReviewsCount} avis certifiés Proximo CI</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowReviewForm(!showReviewForm); setReviewError(""); }}
                    className="px-5 py-3 rounded-xl bg-[#F26522] text-white font-bold text-sm hover:bg-[#C84E10] transition-colors shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <I e="✍️" /> {showReviewForm ? "Fermer le formulaire" : "Laisser un avis"}
                  </button>
                </div>

                {/* Review Form */}
                {showReviewForm && (
                  <form id="review-form-section" onSubmit={handleSubmitReview} className="bg-white rounded-2xl p-6 border-2 border-[#F26522]/30 shadow-md flex flex-col gap-4 animate-in fade-in duration-200 scroll-mt-28">
                    <h3 className="font-bold text-[#1D4E5B] text-lg flex items-center gap-2">
                      <I e="⭐" /> Votre retour d'expérience avec {a.name}
                    </h3>

                    {reviewSuccess && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2">
                        <I e="✅" /> Merci ! Votre avis a été publié avec succès.
                      </div>
                    )}

                    {reviewError && <ErrorBox message={reviewError} />}

                    <div>
                      <label className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Note globale * (cliquez sur les étoiles pour noter)</label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const activeRating = hoverRating ?? reviewRating;
                          const isFilled = star <= activeRating;
                          return (
                            <button
                              type="button"
                              key={star}
                              onClick={() => { setReviewRating(star); setHoverRating(null); }}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(null)}
                              className="text-3xl transition-transform hover:scale-125 cursor-pointer focus:outline-none p-1"
                              title={`${star} étoile${star > 1 ? "s" : ""}`}
                              aria-label={`Donner une note de ${star} sur 5`}
                            >
                              <I
                                e="★"
                                className={isFilled ? "text-amber-400 drop-shadow-sm scale-105" : "text-gray-300 opacity-60 hover:opacity-100"}
                              />
                            </button>
                          );
                        })}
                        <span className="text-sm font-bold text-[#1D4E5B] ml-2">
                          {(hoverRating ?? reviewRating) === 5 ? "Excellent (5/5)" : (hoverRating ?? reviewRating) === 4 ? "Très bien (4/5)" : (hoverRating ?? reviewRating) === 3 ? "Correct (3/5)" : (hoverRating ?? reviewRating) === 2 ? "Décevant (2/5)" : "Médiocre (1/5)"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="revAuthor" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Votre nom complet ou prénom *</label>
                      <input
                        id="revAuthor"
                        type="text"
                        maxLength={80}
                        placeholder="Ex : Koffi Marc, Mariam K..."
                        value={reviewAuthor}
                        onChange={(e) => setReviewAuthor(e.target.value)}
                        className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="revText" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Votre avis détaillé *</label>
                      <textarea
                        id="revText"
                        rows={3}
                        maxLength={1000}
                        placeholder="Expliquez la prestation réalisée (qualité des finitions, ponctualité, respect du devis en FCFA)..."
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowReviewForm(false)}
                        className="px-4 py-2.5 rounded-xl border border-[#D1D9DC] text-[#6B7280] font-semibold text-sm hover:bg-[#F4F8F9] transition-colors cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="px-6 py-2.5 rounded-xl bg-[#1D4E5B] text-white font-bold text-sm hover:bg-[#163A43] transition-colors shadow-xs disabled:opacity-60 cursor-pointer flex items-center gap-2"
                      >
                        {submittingReview ? "Envoi..." : <Rich text={"🚀 Publier mon avis"} />}
                      </button>
                    </div>
                  </form>
                )}

                {/* Reviews List */}
                {reviewsList.length ? (
                  <div className="flex flex-col gap-4">
                    {reviewsList.map((r, i) => (
                      <div key={i} className="bg-[#F4F8F9] rounded-2xl p-5 border-2 border-[#E8F2F5] transition-all hover:border-[#D1D9DC]">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-[#1D4E5B]">{r.name}</p>
                            <p className="text-xs text-[#9CA3AF]">{fmtDate(r.date)}</p>
                          </div>
                          <div className="flex items-center gap-0.5 text-sm" aria-label={`Note : ${r.rating} étoiles sur 5`}>
                            {Array.from({ length: 5 }).map((_, k) => (
                              <I key={k} e="★" className={k < r.rating ? "text-amber-400 drop-shadow-xs" : "text-gray-300"} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-[#3D3D3D] leading-relaxed">{r.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#6B7280]">Cet artisan n'a pas encore reçu d'avis. Soyez le premier à donner votre avis !</p>
                )}
              </div>
            )}

            {activeTab === "infos" && (
              <div className="flex flex-col gap-6">
                {a.bio && (
                  <div className="bg-[#F4F8F9] rounded-2xl p-5 border-2 border-[#E8F2F5]">
                    <h3 className="font-bold text-[#1D4E5B] mb-2 text-base">À propos</h3>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{a.bio}</p>
                  </div>
                )}
                {a.specialties.length > 0 && (
                  <div>
                    <h3 className="font-bold text-[#1D4E5B] mb-3 text-base">Spécialités</h3>
                    <div className="flex flex-wrap gap-2">{a.specialties.map((s) => <span key={s} className="text-sm bg-[#E8F2F5] text-[#1D4E5B] font-semibold px-4 py-2 rounded-xl">{s}</span>)}</div>
                  </div>
                )}
                {a.zones.length > 0 && (
                  <div>
                    <h3 className="font-bold text-[#1D4E5B] mb-3 text-base">Zones d'intervention</h3>
                    <div className="flex flex-wrap gap-2">{a.zones.map((c) => <span key={c} className="text-sm bg-[#FDE8D9] text-[#C84E10] font-semibold px-4 py-2 rounded-xl"><I e="📍" /> {c}</span>)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white border-2 border-[#1D4E5B] rounded-2xl p-6 sticky top-24">
            <p className="text-3xl font-bold text-[#1D4E5B] mb-1">{a.priceNumber || a.price} <span className="text-base font-normal text-[#6B7280]">{a.priceUnit}</span></p>
            <p className="text-sm text-[#6B7280] mb-6 flex items-center gap-1.5"><span><I e="⚡" /></span> Devis gratuit sous 24h</p>
            <div className="flex flex-col gap-3">
              <Link to={`/poster-offre?artisan=${a.id}`} className="flex items-center justify-center gap-2 w-full py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md"><I e="📋" /> Demander un devis</Link>
              <WhatsAppButton phone={a.phone} message={`Bonjour ${a.name}, je vous contacte via Proximo CI pour un devis !`} label="Contacter par WhatsApp" size="md" className="w-full justify-center" />
              <a href={`tel:+${a.phone}`} className="flex items-center justify-center gap-2 w-full py-4 border-2 border-[#1D4E5B] text-[#1D4E5B] rounded-xl font-bold text-base hover:bg-[#E8F2F5] transition-colors"><I e="📞" /> Appeler directement</a>
              <button
                type="button"
                onClick={openReviewForm}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#FFF2EB] text-[#F26522] border-2 border-[#F26522]/30 rounded-xl font-bold text-sm hover:bg-[#FDE8D9] transition-colors cursor-pointer shadow-xs"
              >
                <I e="✍️" /> Laisser un avis sur cet artisan
              </button>
            </div>
            <hr className="my-5 border-[#E8F2F5]" />
            <dl className="flex flex-col gap-3 text-sm">
              {[["Missions réalisées", String(a.missions)], ["Délai de réponse", "< 2h"], ["Membre depuis", String(a.memberSince)]].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center"><dt className="text-[#6B7280]">{label}</dt><dd className="font-bold text-[#1D4E5B]">{value}</dd></div>
              ))}
            </dl>
            <div className="mt-5 pt-5 border-t border-[#E8F2F5]"><p className="text-xs text-[#9CA3AF] text-center"><I e="🔒" /> Profil vérifié par Proximo CI</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
