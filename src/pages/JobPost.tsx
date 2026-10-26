import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import VoiceAssistant from "../components/VoiceAssistant";
import { ErrorBox, Field, inputClass, selectClass } from "../components/ui";
import { api, ApiError } from "../lib/api";
import CommuneSelect from "../components/CommuneSelect";

import { I, Rich } from "../components/Icon";
const contractTypes = ["CDI", "CDD", "Temps partiel", "Freelance / Mission", "Stage", "Apprentissage", "Journalier"];
const sectors = ["Bâtiment & Travaux", "Automobile", "Beauté & Bien-être", "Cuisine & Restauration", "Événementiel", "Transport & Logistique", "Services à la personne", "Commerce & Vente", "Informatique & Tech", "Santé", "Éducation & Formation", "Agriculture", "Autre"];
const communes = ["Cocody", "Yopougon", "Plateau", "Abobo", "Marcory", "Koumassi", "Treichville", "Adjamé", "Attécoubé", "Port-Bouët", "Bingerville", "Autre"];

const EMPTY = {
  company: "", contactName: "", phone: "", email: "", commune: "",
  title: "", sector: "", contractType: "", commune2: "", salary: "", nbPosts: "1",
  profile: "", experience: "", studies: "", skills: "", description: "", howToApply: "whatsapp",
};

export default function JobPost() {
  const [posterType, setPosterType] = useState<"entreprise" | "particulier">("entreprise");
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(""); };

  function next() {
    if (step === 1) {
      if (posterType === "entreprise" && !form.company.trim()) return setError("Le nom de l'entreprise est requis.");
      if (!form.contactName.trim() || !form.phone.trim()) return setError("Nom du contact et téléphone sont requis.");
    }
    if (step === 2 && (!form.title.trim() || !form.sector || !form.contractType || !form.commune2)) return setError("Titre, secteur, type de contrat et lieu sont requis.");
    setError("");
    setStep((s) => s + 1);
  }

  async function submit() {
    if (!form.profile.trim() || !form.description.trim()) return setError("Le profil souhaité et la description sont requis.");
    setBusy(true);
    try {
      await api.post("/jobs", { ...form, posterType });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inattendue.");
    } finally { setBusy(false); }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-5xl"><I e="✅" /></span></div>
        <h1 className="text-4xl text-[#1D4E5B] mb-3">Offre publiée !</h1>
        <p className="text-[#6B7280] mb-8 leading-relaxed">Votre offre d'emploi a été publiée avec succès. Les candidats vous contacteront directement.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="px-6 py-4 bg-[#F26522] text-white rounded-xl font-bold hover:bg-[#C84E10] transition-colors"><I e="🏠" /> Retour à l'accueil</Link>
          <button onClick={() => { setSubmitted(false); setStep(1); setForm(EMPTY); }} className="px-6 py-4 border-2 border-[#D1D9DC] text-[#1D4E5B] rounded-xl font-bold hover:bg-[#E8F2F5] transition-colors"><I e="📢" /> Publier une autre offre</button>
        </div>
      </div>
    );
  }

  const ctl = (id: string, k: keyof typeof EMPTY, props: Record<string, unknown> = {}): ReactNode => (
    <input id={id} value={form[k]} onChange={(e) => set(k, e.target.value)} className={inputClass} {...props} />
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <nav className="text-sm text-[#6B7280] mb-4 flex items-center gap-2">
          <Link to="/" className="hover:text-[#F26522]"><I e="🏠" /> Accueil</Link><span>/</span><span className="text-[#1D4E5B] font-semibold"><I e="📢" /> Publier une offre d'emploi</span>
        </nav>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-5xl text-[#1D4E5B] mb-2">Publier une offre</h1>
            <p className="text-[#6B7280]">Gratuit · Sans création de compte · Publication immédiate</p>
          </div>
          <VoiceAssistant label="Aide vocale" text="Remplissez ce formulaire pour publier votre offre d'emploi ou de recrutement sur Proximo CI. C'est gratuit et sans création de compte." />
        </div>
      </div>

      <div className="bg-[#E8F2F5] border-2 border-[#1D4E5B]/20 rounded-2xl px-6 py-4 mb-8 flex items-start gap-3">
        <span className="text-2xl"><I e="ℹ️" /></span>
        <div className="text-sm text-[#1D4E5B]"><strong>Pas besoin de compte !</strong> Toute personne ou entreprise peut publier une offre d'emploi gratuitement. Vos coordonnées restent privées — les candidats vous contacteront selon votre méthode de contact choisie.</div>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {[["1", "Qui publie ?"], ["2", "L'offre"], ["3", "Profil & contact"]].map(([n, label], idx) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${step > idx + 1 ? "bg-[#F26522] text-white" : step === idx + 1 ? "bg-[#1D4E5B] text-white ring-4 ring-[#E8F2F5]" : "bg-[#E8F2F5] text-[#9CA3AF]"}`}>{step > idx + 1 ? <Rich text={"✓"} /> : n}</div>
            <span className={`text-xs font-bold hidden sm:block ${step >= idx + 1 ? "text-[#1D4E5B]" : "text-[#9CA3AF]"}`}>{label}</span>
            {idx < 2 && <div className={`flex-1 h-[2px] rounded-full mx-2 ${step > idx + 1 ? "bg-[#F26522]" : "bg-[#E8F2F5]"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-8">
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-[#1D4E5B] mb-3">Vous êtes... <span className="text-[#F26522]">*</span></p>
              <div className="grid grid-cols-2 gap-4">
                {(["entreprise", "particulier"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setPosterType(t)} aria-pressed={posterType === t}
                    className={`py-6 px-4 rounded-2xl border-2 font-bold transition-all flex flex-col items-center gap-3 ${posterType === t ? (t === "entreprise" ? "border-[#1D4E5B] bg-[#E8F2F5] text-[#1D4E5B]" : "border-[#F26522] bg-[#FDE8D9] text-[#C84E10]") : "border-[#D1D9DC] text-[#6B7280] hover:border-[#1D4E5B]"}`}>
                    <span className="text-4xl">{t === "entreprise" ? <Rich text={"🏢"} /> : <Rich text={"👤"} />}</span>
                    <span className="text-base">{t === "entreprise" ? "Une entreprise" : "Un particulier"}</span>
                  </button>
                ))}
              </div>
            </div>
            {posterType === "entreprise" && <Field label="Nom de l'entreprise" id="company" required>{ctl("company", "company", { type: "text", placeholder: "Ex : SARL Bâtiment Moderne CI" })}</Field>}
            <Field label="Nom du contact" id="contactName" required>{ctl("contactName", "contactName", { type: "text", placeholder: "Votre nom complet" })}</Field>
            <Field label="Numéro WhatsApp / Téléphone" id="phone" required>{ctl("phone", "phone", { type: "tel", placeholder: "+225 07 XX XX XX XX" })}</Field>
            <Field label="Email" id="email">{ctl("email", "email", { type: "email", placeholder: "contact@entreprise.ci" })}</Field>
            <div>
              <label className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📍" /> Commune</label>
              <CommuneSelect
                variant="form"
                value={form.commune}
                onChange={(c) => set("commune", c)}
                placeholder="Sélectionnez votre commune..."
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <Field label="Titre du poste" id="title" required>{ctl("title", "title", { type: "text", placeholder: "Ex : Électricien qualifié, Cuisinier, Chauffeur..." })}</Field>
            <Field label="Secteur d'activité" id="sector" required>
              <select id="sector" value={form.sector} onChange={(e) => set("sector", e.target.value)} className={selectClass}>
                <option value="">Sélectionnez le secteur...</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type de contrat" id="contractType" required>
                <select id="contractType" value={form.contractType} onChange={(e) => set("contractType", e.target.value)} className={selectClass}>
                  <option value="">Type...</option>{contractTypes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Nombre de postes" id="nbPosts">{ctl("nbPosts", "nbPosts", { type: "number", min: 1, max: 99 })}</Field>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📍" /> Lieu de travail *</label>
              <CommuneSelect
                variant="form"
                value={form.commune2}
                onChange={(c) => set("commune2", c)}
                placeholder="Sélectionnez la commune ou zone..."
                hasError={!!error && !form.commune2}
              />
            </div>
            <Field label="Salaire / Rémunération (FCFA)" id="salary">{ctl("salary", "salary", { type: "text", placeholder: "Ex : 80 000 FCFA/mois, 15 000 FCFA/jour, À négocier" })}</Field>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <Field label="Profil souhaité" id="profile" required>
              <textarea id="profile" rows={3} placeholder="Ex : Homme ou femme, sérieux(se), ponctuel(le), avec au moins 2 ans d'expérience..." value={form.profile} onChange={(e) => set("profile", e.target.value)} className={`${inputClass} resize-none`} />
            </Field>
            <Field label="Expérience requise" id="experience">
              <select id="experience" value={form.experience} onChange={(e) => set("experience", e.target.value)} className={selectClass}>
                <option value="">Non requise / peu importe</option>{["Débutant accepté", "1–2 ans", "2–5 ans", "5+ ans", "Expert"].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Niveau d'études / Diplôme" id="studies">
              <select id="studies" value={form.studies} onChange={(e) => set("studies", e.target.value)} className={selectClass}>
                <option value="">Non requis / peu importe</option>{["Sans diplôme", "CEP / BEPC", "BAC", "BTS / DUT", "Licence", "Master & +", "Formation professionnelle"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Compétences / Qualités requises" id="skills">{ctl("skills", "skills", { type: "text", placeholder: "Ex : Maîtrise outil électrique, permis B, autonome, discret..." })}</Field>
            <Field label="Description complète du poste" id="description" required>
              <textarea id="description" rows={5} placeholder="Décrivez les missions, l'environnement de travail, les avantages..." value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputClass} resize-none`} />
            </Field>
            <fieldset>
              <legend className="block text-sm font-bold text-[#1D4E5B] mb-2"><I e="📨" /> Comment les candidats doivent-ils postuler ? <span className="text-[#F26522]">*</span></legend>
              <div className="flex flex-col gap-2">
                {[["whatsapp", "📱 Contacter par WhatsApp"], ["email", "✉️ Envoyer un email"], ["phone", "📞 Appeler directement"], ["presentiel", "🚶 Se présenter en personne"]].map(([val, label]) => (
                  <label key={val} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all ${form.howToApply === val ? "border-[#1D4E5B] bg-[#E8F2F5]" : "border-[#D1D9DC] hover:border-[#1D4E5B]"}`}>
                    <input type="radio" name="howToApply" value={val} checked={form.howToApply === val} onChange={(e) => set("howToApply", e.target.value)} className="accent-[#F26522]" />
                    <span className="font-semibold text-sm text-[#1D4E5B]"><Rich text={label} /></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">En publiant cette offre, vous acceptez nos <Link to="/mentions-legales" className="text-[#F26522] font-semibold hover:underline">CGU</Link>. Vos coordonnées ne seront visibles que selon votre méthode de contact choisie.</p>
          </div>
        )}

        {error && <div className="mt-6"><ErrorBox message={error} /></div>}

        <div className="flex justify-between mt-8 pt-6 border-t-2 border-[#E8F2F5]">
          {step > 1 ? <button type="button" onClick={() => { setError(""); setStep((s) => s - 1); }} className="flex items-center gap-2 px-6 py-4 border-2 border-[#D1D9DC] rounded-xl font-bold text-[#1D4E5B] hover:bg-[#E8F2F5] transition-colors"><I e="←" /> Retour</button> : <div />}
          {step < 3 ? (
            <button type="button" onClick={next} className="px-8 py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md">Continuer <I e="→" /></button>
          ) : (
            <button type="button" onClick={submit} disabled={busy} className="px-8 py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md disabled:opacity-60">{busy ? "Publication…" : <Rich text={"📢 Publier l'offre d'emploi"} />}</button>
          )}
        </div>
      </div>
    </div>
  );
}
