import { useState } from "react";
import { Link } from "react-router";
import WhatsAppButton from "../components/WhatsAppButton";
import VoiceAssistant from "../components/VoiceAssistant";
import { ErrorBox } from "../components/ui";
import { api, ApiError } from "../lib/api";

import { I, Rich } from "../components/Icon";
const faqs = [
  { category: "Compte & inscription", icon: "👤", items: [
    { q: "Comment créer un compte sur Proximo CI ?", a: "Cliquez sur 'Connexion' puis 'Inscription'. Renseignez simplement votre prénom, nom, téléphone et mot de passe. Votre compte est activé immédiatement, sans attente de SMS !" },
    { q: "Est-ce que Proximo CI est disponible dans ma ville ?", a: "Proximo CI est présent à Abidjan (toutes communes) et dans les villes de Bouaké, San-Pédro, Yamoussoukro, Daloa et Korhogo." } ] },
  { category: "Pour les clients", icon: "🏠", items: [
    { q: "Comment trouver un artisan dans ma commune ?", a: "Utilisez la recherche, sélectionnez votre commune (Cocody, Yopougon, Plateau, etc.) et filtrez par catégorie. Vous verrez les artisans disponibles avec leurs tarifs en FCFA." },
    { q: "Comment contacter un artisan ?", a: "Chaque profil dispose d'un bouton WhatsApp direct. Cliquez dessus pour démarrer une conversation immédiatement avec l'artisan." } ] },
  { category: "Pour les artisans", icon: "🔨", items: [
    { q: "Comment rejoindre Proximo CI en tant qu'artisan ?", a: "L'inscription est 100% gratuite ! Créez votre compte artisan, renseignez votre métier et vos communes d'intervention. Votre profil sera en ligne sous 48h." },
    { q: "Comment recevoir des missions ?", a: "Complétez votre profil avec des photos de vos réalisations et votre numéro WhatsApp. Répondez rapidement aux offres publiées dans vos communes." } ] },
  { category: "Paiements", icon: "💰", items: [
    { q: "Comment payer en Côte d'Ivoire ?", a: "Nous acceptons Orange Money, MTN Mobile Money, Wave, carte bancaire Visa/Mastercard et virement bancaire pour les entreprises." },
    { q: "Quelles sont les commissions de Proximo CI ?", a: "L'inscription est gratuite. Proximo CI prélève une commission de 8% uniquement sur les missions effectivement réalisées via la plateforme." } ] },
];

const input = "w-full border-2 border-[#D1D9DC] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4E5B] transition-colors";

export default function Contact() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", subject: "Question générale", message: "" });
  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(""); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/contact", form);
      setSent(true);
      setForm({ name: "", phone: "", subject: "Question générale", message: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur inattendue.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="bg-[#1D4E5B] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <nav className="text-sm text-[#8FAFB7] mb-6 flex items-center gap-2" aria-label="Fil d'Ariane">
            <Link to="/" className="hover:text-white transition-colors"><I e="🏠" /> Accueil</Link><span>/</span><span className="text-white font-semibold"><I e="💬" /> Contact & FAQ</span>
          </nav>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-6xl mb-4">Comment pouvons-nous vous aider ?</h1>
              <p className="text-[#B0D4DC] text-lg max-w-lg">Consultez notre FAQ ou contactez-nous directement sur WhatsApp — nous répondons en moins de 2h.</p>
            </div>
            <VoiceAssistant label="Écouter la page" text="Page d'aide et de contact Proximo CI. Consultez notre FAQ ou contactez-nous par WhatsApp, téléphone ou formulaire." />
          </div>
          <div className="flex flex-wrap gap-4 mt-10">
            <WhatsAppButton label="Écrire sur WhatsApp" message="Bonjour Proximo CI, j'ai besoin d'aide !" size="lg" />
            <a href="tel:+2250747002255" className="flex items-center gap-3 px-7 py-4 border-2 border-white/30 text-white rounded-full font-bold text-lg hover:bg-white/10 transition-colors"><I e="📞" /> +225 07 47 00 22 55</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-4xl text-[#1D4E5B] mb-8">Questions fréquentes</h2>
            <div className="flex flex-col gap-8">
              {faqs.map((section) => (
                <div key={section.category}>
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#F26522] mb-4" style={{ fontFamily: "var(--font-body)" }}><span className="text-xl"><I e={section.icon} /></span>{section.category}</h3>
                  <div className="flex flex-col gap-3">
                    {section.items.map((item) => (
                      <div key={item.q} className="border-2 border-[#E8F2F5] rounded-2xl overflow-hidden">
                        <button onClick={() => setOpenFaq(openFaq === item.q ? null : item.q)} aria-expanded={openFaq === item.q}
                          className="w-full flex items-center justify-between px-6 py-5 text-left font-bold text-[#1D4E5B] hover:bg-[#F4F8F9] transition-colors text-base gap-4">
                          <span>{item.q}</span>
                          <span className={`text-[#F26522] text-2xl font-black transition-transform flex-shrink-0 ${openFaq === item.q ? "rotate-45" : ""}`} aria-hidden="true">+</span>
                        </button>
                        {openFaq === item.q && <div className="px-6 pb-5 text-sm text-[#3D3D3D] leading-relaxed border-t-2 border-[#E8F2F5] pt-4 bg-[#F4F8F9]">{item.a}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6 sticky top-24">
              {sent ? (
                <div className="text-center py-10">
                  <span className="text-5xl block mb-4"><I e="✅" /></span>
                  <p className="font-bold text-[#1D4E5B] text-xl mb-2">Message envoyé !</p>
                  <p className="text-sm text-[#6B7280]">Notre équipe vous répondra sur WhatsApp sous 2h.</p>
                  <button onClick={() => setSent(false)} className="mt-5 text-sm text-[#F26522] hover:underline font-semibold">Envoyer un autre message</button>
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-[#1D4E5B] text-lg mb-1" style={{ fontFamily: "var(--font-body)" }}><I e="✉️" /> Nous écrire</h3>
                  <p className="text-xs text-[#6B7280] mb-5">Réponse garantie sous 2h sur WhatsApp.</p>
                  <form className="flex flex-col gap-4" onSubmit={submit}>
                    <div><label htmlFor="c-name" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Nom complet</label><input id="c-name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={input} placeholder="Coulibaly Mariam" /></div>
                    <div><label htmlFor="c-phone" className="block text-xs font-bold text-[#1D4E5B] mb-1.5"><I e="📱" /> Numéro WhatsApp *</label><input id="c-phone" type="tel" required value={form.phone} onChange={(e) => set("phone", e.target.value)} className={input} placeholder="+225 07 XX XX XX XX" /></div>
                    <div>
                      <label htmlFor="c-subject" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Sujet</label>
                      <select id="c-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} className={`${input} text-[#3D3D3D] bg-white`}>
                        {["Question générale", "Problème technique", "Facturation / Paiement", "Signalement", "Devenir artisan partenaire"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div><label htmlFor="c-msg" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Message *</label><textarea id="c-msg" rows={4} required value={form.message} onChange={(e) => set("message", e.target.value)} className={`${input} resize-none`} placeholder="Décrivez votre demande..." /></div>
                    {error && <ErrorBox message={error} />}
                    <button type="submit" disabled={busy} className="w-full py-4 bg-[#F26522] text-white rounded-xl text-base font-bold hover:bg-[#C84E10] transition-colors shadow-md disabled:opacity-60">{busy ? "Envoi…" : <Rich text={"📤 Envoyer le message"} />}</button>
                  </form>
                  <div className="mt-5 pt-5 border-t-2 border-[#E8F2F5]">
                    <WhatsAppButton label="Écrire directement sur WhatsApp" message="Bonjour Proximo CI, j'ai une question !" size="sm" className="w-full justify-center" />
                    <p className="text-xs text-[#9CA3AF] text-center mt-3"><I e="📍" /> Bureau : Cocody, Abidjan · Lun–Sam 8h–20h</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
