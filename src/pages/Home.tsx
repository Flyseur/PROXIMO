import { Link } from "react-router";
import { useState } from "react";
import VoiceAssistant from "../components/VoiceAssistant";
import WhatsAppButton from "../components/WhatsAppButton";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import { COMMUNES, type Artisan } from "../lib/api";
import CommuneSelect from "../components/CommuneSelect";

import { I, Rich } from "../components/Icon";
export default function Home() {
  const [search, setSearch] = useState("");
  const [commune, setCommune] = useState("");
  const { data, error, loading } = useFetch<{
    categories: { icon: string; label: string; count: number }[];
    featured: Artisan[];
    stats?: { users: number; artisans: number; missions: number; rating: string; communesCount: number; categoriesCount: number; delai: string };
  }>("/home");

  const statItems = [
    { value: data?.stats ? `${data.stats.artisans} pros` : "—", label: "Artisans actifs en BD", icon: "👷", bg: "bg-orange-50", border: "border-orange-200/60", iconColor: "text-[#F26522]" },
    { value: data?.stats ? `${data.stats.missions.toLocaleString("fr-FR")}` : "—", label: "Missions réalisées", icon: "✅", bg: "bg-emerald-50", border: "border-emerald-200/60", iconColor: "text-emerald-600" },
    { value: data?.stats ? `${data.stats.rating}/5` : "—", label: "Note moyenne réelle", icon: "⭐", bg: "bg-amber-50", border: "border-amber-200/60", iconColor: "text-amber-500" },
    { value: data?.stats ? `${data.stats.users} membres` : "—", label: "Comptes enregistrés", icon: "👥", bg: "bg-sky-50", border: "border-sky-200/60", iconColor: "text-sky-600" },
  ];

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (commune) params.set("commune", commune);
  const searchUrl = `/recherche${params.toString() ? `?${params}` : ""}`;

  return (
    <>
      <section className="relative bg-[#1D4E5B] text-white z-20" style={{ minHeight: "618px" }} aria-labelledby="hero-heading">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&h=900&fit=crop&auto=format" alt="" aria-hidden="true" className="w-full h-full object-cover opacity-20" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-36">
          <div className="flex items-center gap-3 mb-5">
            <span className="bg-[#F26522] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5"><I e="🇨🇮" /> Côte d'Ivoire</span>
            <span className="text-[#8FAFB7] text-sm">Plateforme #1 des artisans</span>
          </div>
          <h1 id="hero-heading" className="text-5xl md:text-7xl leading-tight mb-6 max-w-3xl">
            Trouvez l'artisan qu'il vous faut,<em className="text-[#F26522] not-italic"> partout en CI.</em>
          </h1>
          <p className="text-lg text-[#B0D4DC] max-w-xl mb-10 font-light leading-relaxed">
            Proximo CI connecte particuliers et professionnels avec des artisans qualifiés et disponibles à Abidjan et dans toute la Côte d'Ivoire.
          </p>

          <div className="bg-white rounded-2xl p-2.5 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 w-full max-w-3xl shadow-2xl border border-white/40 ring-1 ring-black/5" role="search">
            <div className="flex-1 flex items-center gap-2.5 px-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-orange-50 text-[#F26522] flex items-center justify-center shrink-0 text-lg shadow-xs" aria-hidden="true">
                <I e="🔍" />
              </span>
              <input
                type="search"
                placeholder="Quel artisan cherchez-vous ?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-[#1A1A1A] text-base py-2 focus:outline-none placeholder-[#9CA3AF] bg-transparent min-w-0"
                aria-label="Rechercher un artisan"
              />
              <VoiceAssistant iconOnly label="Recherche vocale" text="Bienvenue sur Proximo CI ! Dites le nom d'un métier ou d'une commune." />
            </div>

            <div className="hidden md:block w-px h-8 bg-[#E8F2F5] shrink-0" />

            <div className="px-1 py-1 md:py-0 border-t md:border-t-0 border-[#E8F2F5] shrink-0">
              <CommuneSelect
                value={commune}
                onChange={setCommune}
                placeholder="Toutes communes..."
              />
            </div>

            <Link
              to={searchUrl}
              className="px-7 py-3.5 bg-gradient-to-r from-[#F26522] to-[#E05312] text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-orange-500/25 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 whitespace-nowrap shadow-xs"
              aria-label="Lancer la recherche"
            >
              <I e="🔍" className="text-base text-white" /> Rechercher
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <span className="text-sm text-[#8FAFB7]">Recherches populaires :</span>
            {["Plombier Yopougon", "Électricien Plateau", "Menuisier Cocody"].map((s) => (
              <Link key={s} to={`/recherche?q=${encodeURIComponent(s)}`} className="text-sm text-white/80 underline hover:text-[#F26522] transition-colors">{s}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-[#E8F2F5] bg-[#F4F8F9]/80 py-10" aria-label="Chiffres clés">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {statItems.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-6 border-2 border-[#E8F2F5] shadow-xs hover:shadow-md hover:border-[#1D4E5B]/20 transition-all text-center group flex flex-col items-center">
              <div className={`w-14 h-14 rounded-2xl ${s.bg} border ${s.border} ${s.iconColor} flex items-center justify-center text-2xl mb-3 shadow-xs group-hover:scale-110 transition-transform duration-200`}>
                <I e={s.icon} />
              </div>
              <p className="text-3xl font-black text-[#1D4E5B] group-hover:text-[#F26522] transition-colors" style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
              <p className="text-xs sm:text-sm font-semibold text-[#6B7280] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-xl bg-orange-50 text-[#F26522] flex items-center justify-center text-sm shadow-xs"><I e="📍" /></span>
              <h2 className="text-4xl text-[#1D4E5B]">Votre commune</h2>
            </div>
            <p className="text-[#6B7280]">Interventions rapides garanties dans toutes les communes d'Abidjan et au-delà.</p>
          </div>
          <span className="text-xs font-bold text-[#8FAFB7] bg-[#E8F2F5] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
            <I e="🇨🇮" /> {data?.stats?.communesCount ?? COMMUNES.length} communes couvertes
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          {COMMUNES.map((c) => (
            <Link
              key={c}
              to={`/recherche?commune=${encodeURIComponent(c)}`}
              className="group bg-white rounded-2xl p-4 border-2 border-[#E8F2F5] hover:border-[#F26522] hover:shadow-md transition-all flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-50 group-hover:bg-[#F26522] text-[#F26522] group-hover:text-white flex items-center justify-center text-base transition-colors shrink-0 shadow-xs">
                  <I e="📍" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#1D4E5B] group-hover:text-[#F26522] transition-colors truncate">{c}</p>
                  <p className="text-[11px] text-[#8FAFB7] font-medium">Abidjan</p>
                </div>
              </div>
              <span className="text-xs text-[#8FAFB7] group-hover:text-[#F26522] group-hover:translate-x-1 transition-all shrink-0">
                <I e="→" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {loading && <Spinner />}
      {error && <div className="max-w-7xl mx-auto px-6"><ErrorBox message={error.message} /></div>}

      {data && (
        <>
          <section className="bg-[#F4F8F9] py-16" aria-labelledby="categories-heading">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex justify-between items-end mb-10">
                <div>
                  <h2 id="categories-heading" className="text-4xl text-[#1D4E5B]">Nos catégories</h2>
                  <p className="text-[#6B7280] mt-1">{data.categories.length} corps de métier en ligne</p>
                </div>
                <Link to="/services" className="text-sm text-[#F26522] font-bold hover:underline flex items-center gap-1">Voir tout <I e="→" /></Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                {data.categories.map((c) => (
                  <Link key={c.label} to={`/recherche?categorie=${encodeURIComponent(c.label)}`}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white border-2 border-[#E8F2F5] hover:border-[#F26522] hover:bg-[#FDE8D9]/40 group transition-all shadow-xs hover:shadow-md">
                    <div className="w-14 h-14 rounded-2xl bg-[#E8F2F5] group-hover:bg-[#F26522] text-[#1D4E5B] group-hover:text-white flex items-center justify-center text-2xl shadow-xs group-hover:scale-110 transition-all duration-200">
                      <I e={c.icon} />
                    </div>
                    <span className="text-xs font-bold text-[#1D4E5B] text-center group-hover:text-[#C84E10] transition-colors">{c.label}</span>
                    <span className="text-[10px] font-medium text-[#6B7280] bg-[#F4F8F9] px-2 py-0.5 rounded-full">{c.count} pros</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-7xl mx-auto px-6 py-16" aria-labelledby="featured-heading">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 id="featured-heading" className="text-4xl text-[#1D4E5B]">Artisans en vedette</h2>
                <p className="text-[#6B7280] mt-1">Vérifiés, notés et disponibles</p>
              </div>
              <Link to="/recherche" className="text-sm text-[#F26522] font-bold hover:underline">Voir tous <I e="→" /></Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.featured.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl border-2 border-[#E8F2F5] hover:border-[#1D4E5B] transition-all hover:shadow-lg flex flex-col gap-4 p-6">
                  <div className="flex items-center gap-4">
                    <img src={a.img} alt={`Photo de ${a.name}`} className="w-16 h-16 rounded-xl object-cover bg-[#E8F2F5]" />
                    <div>
                      <p className="font-bold text-[#1D4E5B] text-base">{a.name}</p>
                      <p className="text-sm text-[#6B7280]">{a.trade}</p>
                      <p className="text-xs text-[#F26522] font-semibold flex items-center gap-1"><I e="📍" /> {a.commune}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold flex items-center gap-1"><I e="★" /> {a.rating}</span>
                    <span className="text-xs text-[#9CA3AF]">({a.reviews} avis)</span>
                    <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${a.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{a.available ? <Rich text={"✓ Disponible"} /> : <Rich text={"✗ Occupé"} />}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-[#E8F2F5]">
                    <Link to={`/artisan/${a.id}`} className="flex-1 text-center py-3 rounded-xl bg-[#1D4E5B] text-white font-bold text-sm hover:bg-[#163A43] transition-colors"><I e="👤" /> Voir le profil</Link>
                    <WhatsAppButton phone={a.phone} message={`Bonjour ${a.name}, je vous contacte via Proximo CI !`} label="WhatsApp" size="sm" className="flex-1 justify-center" />
                  </div>
                </div>
              ))}
              {data.featured.length < 3 && (
                <div className="bg-gradient-to-br from-orange-50/70 to-amber-50/40 rounded-2xl border-2 border-dashed border-[#F26522]/40 p-6 flex flex-col justify-between gap-4">
                  <div>
                    <span className="w-12 h-12 rounded-2xl bg-[#F26522] text-white flex items-center justify-center text-xl mb-3 shadow-xs">
                      <I e="🚀" />
                    </span>
                    <h3 className="text-lg font-bold text-[#1D4E5B] mb-1">Votre profil ici ?</h3>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      Rejoignez Proximo CI dès aujourd'hui. L'inscription est 100% gratuite et votre fiche artisan sera visible par des clients à Abidjan et partout en Côte d'Ivoire.
                    </p>
                  </div>
                  <Link
                    to="/connexion?mode=signup"
                    className="w-full text-center py-3 rounded-xl bg-[#F26522] text-white font-bold text-sm hover:bg-[#C84E10] transition-colors shadow-xs"
                  >
                    + Créer mon profil artisan
                  </Link>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="bg-[#F4F8F9] py-16" aria-labelledby="how-heading">
        <div className="max-w-7xl mx-auto px-6">
          <h2 id="how-heading" className="text-4xl text-center text-[#1D4E5B] mb-3">Comment ça marche ?</h2>
          <p className="text-center text-[#6B7280] mb-14 max-w-xl mx-auto">Trois étapes simples pour trouver votre artisan en Côte d'Ivoire.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: "📋", title: "Décrivez votre besoin", desc: "Postez une offre gratuite ou cherchez directement un artisan dans votre commune." },
              { step: "02", icon: "🛡️", title: "Comparez les profils", desc: "Consultez les avis, certifications et tarifs en FCFA. Choisissez en toute confiance." },
              { step: "03", icon: "📲", title: "Contactez par WhatsApp", desc: "Échangez directement avec l'artisan via WhatsApp et démarrez votre projet rapidement." },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl p-8 border-2 border-[#E8F2F5] hover:border-[#F26522] hover:shadow-lg transition-all flex flex-col gap-4 group">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-[#E8F2F5] group-hover:bg-[#F26522] text-[#1D4E5B] group-hover:text-white flex items-center justify-center text-2xl shadow-xs transition-all duration-300">
                    <I e={s.icon} />
                  </div>
                  <span className="text-4xl font-black text-[#D1D9DC] group-hover:text-[#F26522]/30 transition-colors" style={{ fontFamily: "var(--font-display)" }}>{s.step}</span>
                </div>
                <h3 className="text-xl font-bold text-[#1D4E5B]">{s.title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F26522]" aria-labelledby="cta-heading">
        <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 id="cta-heading" className="text-4xl text-white mb-2">Prêt à démarrer votre projet ?</h2>
            <p className="text-white/80 text-lg">Rejoignez les clients et artisans déjà actifs sur Proximo CI.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
            <Link to="/connexion?mode=signup" className="px-8 py-4 bg-white text-[#F26522] rounded-xl font-bold text-base hover:bg-[#F4F8F9] transition-colors shadow-md"><I e="🔐" /> Créer un compte gratuit</Link>
            <WhatsAppButton label="Nous écrire maintenant" message="Bonjour Proximo CI, je voudrais trouver un artisan !" size="md" />
          </div>
        </div>
      </section>
    </>
  );
}
