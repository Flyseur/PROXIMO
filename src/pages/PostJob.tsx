import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import VoiceAssistant from "../components/VoiceAssistant";
import { ErrorBox } from "../components/ui";
import { api, ApiError, type ArtisanDetail } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import CommuneSelect from "../components/CommuneSelect";
import WhatsAppIcon from "../components/WhatsAppIcon";

import { I, Rich } from "../components/Icon";
const categories = ["Menuiserie", "Électricité", "Plomberie", "Peinture", "Maçonnerie", "Jardinage", "Toiture", "Climatisation", "Autre"];
const urgencies = [
  { label: "⏳ Pas urgent (+ 1 mois)", value: "not_urgent" },
  { label: "📅 Sous 1 mois", value: "month" },
  { label: "⚡ Sous 2 semaines", value: "two_weeks" },
  { label: "🚨 Urgent (cette semaine)", value: "urgent" },
];
const budgets = ["< 50 000 FCFA", "50 000 – 200 000 FCFA", "200 000 – 500 000 FCFA", "> 500 000 FCFA"];
const communes = ["Cocody", "Yopougon", "Plateau", "Abobo", "Marcory", "Koumassi", "Treichville", "Adjamé", "Attécoubé", "Port-Bouët", "Autre"];
const input = "w-full border-2 border-[#D1D9DC] rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[#1D4E5B] transition-colors";

export default function PostJob() {
  const [sp] = useSearchParams();
  const artisanId = sp.get("artisan");
  const { data: targetArtisan } = useFetch<ArtisanDetail>(artisanId ? `/artisans/${artisanId}` : null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: "", category: "", description: "", budget: "", urgency: "", commune: "", firstName: "", lastName: "", phone: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(""); };

  function next() {
    if (step === 1 && (!form.title.trim() || !form.category || !form.description.trim())) return setError("Renseignez le titre, la catégorie et la description.");
    if (step === 2 && !form.commune) return setError("Sélectionnez votre commune.");
    setError("");
    setStep((s) => s + 1);
  }

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) return setError("Prénom, nom et téléphone sont requis.");
    setBusy(true);
    try {
      await api.post("/requests", { ...form, artisanId: sp.get("artisan") ? Number(sp.get("artisan")) : undefined });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inattendue.");
    } finally { setBusy(false); }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-5xl"><I e="✅" /></span></div>
        <h1 className="text-4xl text-[#1D4E5B] mb-3">{targetArtisan ? "Demande de devis envoyée !" : "Offre publiée !"}</h1>
        <p className="text-[#6B7280] mb-8 leading-relaxed">
          {targetArtisan
            ? `Votre demande a été transmise directement à ${targetArtisan.name}. Pour accélérer la prise en charge, vous pouvez également lui envoyer un message direct sur WhatsApp ci-dessous.`
            : "Votre offre a été soumise avec succès. Les artisans disponibles dans votre commune vous contacteront directement sur WhatsApp dans les 24h."}
        </p>

        {targetArtisan && (
          <div className="mb-8 p-4 bg-[#F4F8F9] rounded-2xl border-2 border-[#E8F2F5] flex items-center gap-4 text-left">
            <img src={targetArtisan.img} alt={targetArtisan.name} className="w-14 h-14 rounded-xl object-cover bg-white shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#1D4E5B] text-base truncate">{targetArtisan.name}</p>
              <p className="text-xs text-[#6B7280] font-medium">{targetArtisan.trade} · {targetArtisan.commune}</p>
              <p className="text-xs text-[#F26522] font-semibold mt-0.5"><I e="⚡" /> Réponse habituelle en moins de 2h</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 justify-center">
          {targetArtisan && (
            <a
              href={`https://wa.me/${targetArtisan.phone}?text=${encodeURIComponent(
                `Bonjour ${targetArtisan.name}, je viens de déposer une demande de devis sur Proximo CI :\n\n📋 *Projet :* ${form.title}\n📍 *Commune :* ${form.commune}\n💰 *Budget :* ${form.budget || "À convenir"}\n\nPouvons-nous en discuter ? Merci !`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 bg-[#25D366] text-white rounded-xl font-bold text-base hover:bg-[#1EBE5D] transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <WhatsAppIcon /> Discuter avec {targetArtisan.name.split(" ")[0]} sur WhatsApp
            </a>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/tableau-de-bord" className="flex-1 px-6 py-3.5 bg-[#1D4E5B] text-white rounded-xl font-bold text-sm hover:bg-[#163A43] transition-colors"><I e="📊" /> Mon tableau de bord</Link>
            <Link to="/" className="flex-1 px-6 py-3.5 border-2 border-[#E8F2F5] text-[#1D4E5B] rounded-xl font-bold text-sm hover:bg-[#E8F2F5] transition-colors"><I e="🏠" /> Accueil</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <nav className="text-sm text-[#6B7280] mb-4 flex items-center gap-2" aria-label="Fil d'Ariane">
          <Link to="/" className="hover:text-[#F26522] transition-colors"><I e="🏠" /> Accueil</Link><span>/</span>
          {targetArtisan ? (
            <>
              <Link to={`/artisan/${targetArtisan.id}`} className="hover:text-[#F26522] transition-colors">{targetArtisan.name}</Link><span>/</span>
              <span className="text-[#1D4E5B] font-semibold">Demande de devis</span>
            </>
          ) : (
            <span className="text-[#1D4E5B] font-semibold"><I e="📋" /> Poster une offre</span>
          )}
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl text-[#1D4E5B] mb-2">{targetArtisan ? `Demande de devis à ${targetArtisan.name}` : "Poster une offre"}</h1>
            <p className="text-[#6B7280]">{targetArtisan ? `Recevez un devis personnalisé de ${targetArtisan.name} sous 24h.` : "Décrivez votre besoin et recevez des devis en FCFA sous 24h."}</p>
          </div>
          <VoiceAssistant label="Aide vocale" text={targetArtisan ? `Formulaire de demande de devis direct pour ${targetArtisan.name}.` : "Bienvenue dans le formulaire de publication d'offre."} />
        </div>
      </div>

      {targetArtisan && (
        <div className="mb-8 p-4 bg-orange-50/70 border-2 border-orange-200/80 rounded-2xl flex items-center gap-4">
          <img src={targetArtisan.img} alt={targetArtisan.name} className="w-14 h-14 rounded-xl object-cover bg-white shrink-0 border border-orange-200" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[#F26522] uppercase tracking-wider inline-block mb-1">
              Devis ciblé
            </span>
            <p className="font-bold text-[#1D4E5B] text-base truncate">{targetArtisan.name} · {targetArtisan.trade}</p>
            <p className="text-xs text-[#6B7280]">Tarif indicatif : <strong className="text-[#1D4E5B]">{targetArtisan.price}</strong> · Basé à {targetArtisan.commune}</p>
          </div>
        </div>
      )}

      <div className="flex items-center mb-10" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={`Étape ${step} sur 3`}>
        {[1, 2, 3].map((s, idx) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${step > s ? "bg-[#F26522] text-white" : step === s ? "bg-[#1D4E5B] text-white ring-4 ring-[#E8F2F5]" : "bg-[#E8F2F5] text-[#9CA3AF]"}`}>{step > s ? <Rich text={"✓"} /> : s}</div>
            <div className="ml-3 flex-1"><p className={`text-sm font-bold ${step >= s ? "text-[#1D4E5B]" : "text-[#9CA3AF]"}`}>{s === 1 ? "Votre besoin" : s === 2 ? "Détails & localisation" : "Vos coordonnées"}</p></div>
            {idx < 2 && <div className={`h-[2px] w-6 mx-2 rounded-full transition-colors ${step > s ? "bg-[#F26522]" : "bg-[#E8F2F5]"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-8">
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📝" /> Titre de l'offre *</label>
              <input id="title" type="text" maxLength={160} placeholder="Ex : Rénovation salle de bain complète à Cocody" value={form.title} onChange={(e) => set("title", e.target.value)} className={input} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1D4E5B] mb-3"><I e="🛠️" /> Catégorie de service *</p>
              <div className="grid grid-cols-3 gap-2">
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => set("category", c)} aria-pressed={form.category === c}
                    className={`py-3 px-3 rounded-xl text-sm font-bold transition-all text-center ${form.category === c ? "bg-[#1D4E5B] text-white ring-2 ring-[#1D4E5B]" : "bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white"}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="desc" className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📋" /> Description détaillée *</label>
              <textarea id="desc" rows={5} maxLength={3000} placeholder="Décrivez votre projet : superficie, matériaux, contraintes particulières, accès..." value={form.description} onChange={(e) => set("description", e.target.value)} className={`${input} resize-none`} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-[#1D4E5B] mb-3"><I e="💰" /> Budget estimé (FCFA)</p>
              <div className="grid grid-cols-2 gap-3">
                {budgets.map((b) => (
                  <button key={b} type="button" onClick={() => set("budget", b)} aria-pressed={form.budget === b}
                    className={`py-3.5 px-4 rounded-xl text-sm font-bold transition-all text-left ${form.budget === b ? "bg-[#F26522] text-white" : "bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#F26522] hover:text-white"}`}>{b}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-[#1D4E5B] mb-3"><I e="⏱️" /> Urgence</p>
              <div className="flex flex-col gap-2">
                {urgencies.map((u) => (
                  <button key={u.value} type="button" onClick={() => set("urgency", u.value)} aria-pressed={form.urgency === u.value}
                    className={`py-3.5 px-4 rounded-xl text-sm font-bold text-left transition-all ${form.urgency === u.value ? "bg-[#1D4E5B] text-white" : "bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white"}`}><Rich text={u.label} /></button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📍" /> Commune *</label>
              <CommuneSelect
                variant="form"
                value={form.commune}
                onChange={(c) => set("commune", c)}
                placeholder="Sélectionnez votre commune..."
                hasError={!!error && !form.commune}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="firstName" className="block text-sm font-bold text-[#1D4E5B] mb-2">Prénom *</label><input id="firstName" type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={input} /></div>
              <div><label htmlFor="lastName" className="block text-sm font-bold text-[#1D4E5B] mb-2">Nom *</label><input id="lastName" type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={input} /></div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📱" /> Numéro WhatsApp / Téléphone *</label>
              <input id="phone" type="tel" placeholder="+225 07 XX XX XX XX" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={input} />
              <p className="text-xs text-[#6B7280] mt-1.5 flex items-center gap-1"><span className="text-[#25D366]"><I e="📲" /></span> Les artisans vous contacteront directement par WhatsApp.</p>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="✉️" /> Adresse email</label>
              <input id="email" type="email" placeholder="votre@email.ci" value={form.email} onChange={(e) => set("email", e.target.value)} className={input} />
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              En soumettant, vous acceptez nos <Link to="/mentions-legales" className="text-[#F26522] hover:underline font-semibold">mentions légales</Link> et notre <Link to="/mentions-legales#privacy" className="text-[#F26522] hover:underline font-semibold">politique de confidentialité</Link>.
            </p>
          </div>
        )}

        {error && <div className="mt-6"><ErrorBox message={error} /></div>}

        <div className="flex justify-between mt-8 pt-6 border-t-2 border-[#E8F2F5]">
          {step > 1 ? <button type="button" onClick={() => { setError(""); setStep((s) => s - 1); }} className="flex items-center gap-2 px-6 py-3.5 border-2 border-[#D1D9DC] rounded-xl text-base font-bold text-[#1D4E5B] hover:bg-[#E8F2F5] transition-colors"><I e="←" /> Retour</button> : <div />}
          {step < 3 ? (
            <button type="button" onClick={next} className="flex items-center gap-2 px-8 py-3.5 bg-[#F26522] text-white rounded-xl text-base font-bold hover:bg-[#C84E10] transition-colors shadow-md">Continuer <I e="→" /></button>
          ) : (
            <button type="button" onClick={submit} disabled={busy} className="flex items-center gap-2 px-8 py-3.5 bg-[#F26522] text-white rounded-xl text-base font-bold hover:bg-[#C84E10] transition-colors shadow-md disabled:opacity-60">{busy ? "Envoi…" : <Rich text={"✓ Publier mon offre"} />}</button>
          )}
        </div>
      </div>
    </div>
  );
}
