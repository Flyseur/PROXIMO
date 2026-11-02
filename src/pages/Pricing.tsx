import { useState } from "react";
import { Link, useNavigate } from "react-router";
import WhatsAppButton from "../components/WhatsAppButton";
import SubscriptionModal from "../components/SubscriptionModal";
import { userToken } from "../lib/api";

import { I, Rich } from "../components/Icon";
const plans = [
  { name: "Gratuit", price: { monthly: 0, annual: 0, annualTotal: 0 }, desc: "Pour découvrir la plateforme",
    features: ["3 offres par mois", "Accès au catalogue artisans", "Messagerie basique", "Contact WhatsApp artisans", "Support par email"],
    missing: ["Mise en avant des offres", "Statistiques avancées", "Support prioritaire", "Badge vérifié"], cta: "Commencer gratuitement", ctaLink: "/connexion?mode=signup", highlight: false },
  { name: "Pro", price: { monthly: 2500, annual: 2083, annualTotal: 25000 }, desc: "Pour les particuliers actifs",
    features: ["Offres illimitées", "Mise en avant des offres", "Messagerie avancée", "Statistiques détaillées", "Support prioritaire 24h/7j"],
    missing: ["Badge vérifié", "Accès API"], cta: "Souscrire à Pro (2 500 FCFA/mois)", ctaLink: "#subscribe-pro", highlight: true },
  { name: "Entreprise", price: { monthly: 5000, annual: 4167, annualTotal: 50000 }, desc: "Pour les professionnels & PME",
    features: ["Tout le plan Pro", "Badge vérifié", "Accès API", "Manager dédié", "Facturation mensuelle", "Contrats sur mesure"],
    missing: [] as string[], cta: "Souscrire à Entreprise (5 000 FCFA/mois)", ctaLink: "#subscribe-entreprise", highlight: false },
];

const paymentMethods = [
  { name: "Orange Money", logo: "/payments/orange-money.png", alt: "Orange Money Côte d'Ivoire" },
  { name: "MTN Mobile Money", logo: "/payments/mtn-momo.jpg", alt: "MTN Mobile Money" },
  { name: "Wave", logo: "/payments/wave.jpg", alt: "Wave Côte d'Ivoire" },
  { name: "Visa / Mastercard", logo: "/payments/visa-mastercard.svg?v=3", alt: "Visa et Mastercard" },
  { name: "Virement bancaire", logo: "/payments/bank-transfer.svg?v=2", alt: "Virement bancaire" },
];

const faqItems = [
  { q: "Comment payer en Côte d'Ivoire ?", a: "Nous acceptons Orange Money, MTN Mobile Money, Wave, carte bancaire (Visa/Mastercard) et virement bancaire pour les entreprises." },
  { q: "Puis-je changer de plan à tout moment ?", a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment sans frais. La facturation est proratisée." },
  { q: "Y a-t-il un engagement ?", a: "Non, tous nos plans sont sans engagement. Annulez à tout moment, aucune question posée." },
  { q: "Les artisans paient-ils pour être sur la plateforme ?", a: "Non ! L'inscription est gratuite pour les artisans. Proximo CI prélève une commission de 8% uniquement sur les missions réalisées." },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"Pro" | "Entreprise">("Pro");
  const [subscribedMessage, setSubscribedMessage] = useState<string | null>(null);

  function handlePlanClick(p: typeof plans[0]) {
    if (p.name === "Gratuit") {
      navigate(p.ctaLink);
      return;
    }
    setSelectedPlan(p.name as "Pro" | "Entreprise");
    setSubModalOpen(true);
  }

  return (
    <div>
      <div className="bg-[#1D4E5B] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <nav className="text-sm text-[#8FAFB7] mb-6 flex items-center gap-2 justify-center" aria-label="Fil d'Ariane">
            <Link to="/" className="hover:text-white transition-colors"><I e="🏠" /> Accueil</Link><span>/</span><span className="text-white font-semibold"><I e="💰" /> Tarifs</span>
          </nav>
          <h1 className="text-6xl mb-4">Tarifs simples et transparents</h1>
          <p className="text-[#B0D4DC] text-lg mb-8 max-w-lg mx-auto">Tout en FCFA. Aucun frais caché. Paiement par Mobile Money, Wave ou carte.</p>
          <div className="inline-flex items-center gap-1 bg-[#163A43] rounded-xl p-1.5">
            <button onClick={() => setAnnual(false)} aria-pressed={!annual} className={`px-6 py-3 rounded-lg text-sm font-bold transition-all ${!annual ? "bg-white text-[#1D4E5B] shadow-md" : "text-[#8FAFB7] hover:text-white"}`}>Mensuel</button>
            <button onClick={() => setAnnual(true)} aria-pressed={annual} className={`px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${annual ? "bg-white text-[#1D4E5B] shadow-md" : "text-[#8FAFB7] hover:text-white"}`}>Annuel <span className="text-[#F26522] text-xs font-black">2 mois offerts</span></button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {subscribedMessage && (
          <div className="mb-8 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">✓</span>
              <span className="font-bold text-sm">{subscribedMessage}</span>
            </div>
            <Link to="/publier-offre" className="px-4 py-2 bg-[#F26522] text-white text-xs font-bold rounded-xl hover:bg-[#C84E10]">
              Publier une offre maintenant →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {plans.map((p) => {
            const isFree = p.price.monthly === 0;
            const displayMonthly = isFree ? "Gratuit" : (annual ? p.price.annual : p.price.monthly).toLocaleString("fr-FR");
            const ctaText = isFree
              ? p.cta
              : annual
              ? `Souscrire (${p.price.annualTotal.toLocaleString("fr-FR")} FCFA/an)`
              : `Souscrire (${p.price.monthly.toLocaleString("fr-FR")} FCFA/mois)`;

            return (
              <div key={p.name} className={`rounded-2xl p-8 flex flex-col gap-6 ${p.highlight ? "bg-[#1D4E5B] text-white ring-4 ring-[#F26522] scale-[1.02]" : "bg-white border-2 border-[#E8F2F5]"}`}>
                {p.highlight && <span className="inline-flex self-start items-center gap-1 bg-[#F26522] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest"><I e="⭐" /> Recommandé</span>}
                <div>
                  <p className={`text-xs font-black uppercase tracking-widest mb-2 ${p.highlight ? "text-[#B0D4DC]" : "text-[#1D4E5B]"}`}>{p.name}</p>
                  <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    {displayMonthly}
                    {!isFree && <span className={`text-sm font-normal ml-1.5 ${p.highlight ? "text-[#8FAFB7]" : "text-[#6B7280]"}`}>FCFA/mois</span>}
                  </p>
                  {annual && p.price.annualTotal > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F26522]/15 text-[#F26522] border border-[#F26522]/30">
                      <span>⚡ Facturé {p.price.annualTotal.toLocaleString("fr-FR")} FCFA/an (2 mois offerts)</span>
                    </div>
                  )}
                  <p className={`text-sm mt-2 ${p.highlight ? "text-[#8FAFB7]" : "text-[#6B7280]"}`}>{p.desc}</p>
                </div>
                <ul className="flex flex-col gap-3">
                  {p.features.map((f) => <li key={f} className="flex items-start gap-2.5 text-sm"><span className="text-green-400 font-bold mt-0.5"><I e="✓" /></span><span>{f}</span></li>)}
                  {p.missing.map((f) => <li key={f} className={`flex items-start gap-2.5 text-sm ${p.highlight ? "text-[#4A6A72]" : "text-[#C0C0C0]"}`}><span className="mt-0.5"><I e="✕" /></span><span>{f}</span></li>)}
                </ul>
                {isFree ? (
                  <Link to={p.ctaLink} className="mt-auto flex items-center justify-center py-4 rounded-xl font-bold text-base transition-colors bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white">
                    {p.cta} <I e="→" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlanClick(p)}
                    className={`mt-auto flex items-center justify-center py-4 rounded-xl font-bold text-base transition-colors ${p.highlight ? "bg-[#F26522] text-white hover:bg-[#C84E10] shadow-lg" : "bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white"}`}
                  >
                    {ctaText} <I e="→" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <SubscriptionModal
          isOpen={subModalOpen}
          onClose={() => setSubModalOpen(false)}
          initialPlan={selectedPlan}
          initialBillingCycle={annual ? "yearly" : "monthly"}
          onSuccess={(sub) => {
            setSubModalOpen(false);
            setSubscribedMessage(`Votre abonnement ${sub.plan} a été activé avec succès (Réf: ${sub.reference}). Vous pouvez désormais publier vos offres d'emploi en illimité.`);
          }}
        />

        <div className="bg-[#F4F8F9] border-2 border-[#E8F2F5] rounded-2xl p-8 mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-[#1D4E5B]/10 text-[#1D4E5B] text-xs font-bold px-3.5 py-1 rounded-full mb-3">
            <span>🛡️ Paiements sécurisés en direct via GeniusPay CI</span>
          </div>
          <h3 className="text-2xl font-bold text-[#1D4E5B] mb-2">Moyens de paiement acceptés en Côte d'Ivoire</h3>
          <p className="text-sm text-[#6B7280] mb-6">Paiements sécurisés instantanés par Mobile Money (Wave, Orange Money, MTN MoMo), cartes bancaires et checkout GeniusPay</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {paymentMethods.map((m) => (
              <div
                key={m.name}
                className="bg-white border-2 border-[#E8F2F5] hover:border-[#1D4E5B]/40 hover:shadow-md transition-all rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs"
              >
                <img
                  src={m.logo}
                  alt={m.alt}
                  className="h-9 w-auto max-w-[85px] object-contain rounded-md shrink-0"
                  loading="lazy"
                />
                <span className="font-semibold text-sm text-[#1D4E5B]">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl text-[#1D4E5B] text-center mb-10">Questions fréquentes</h2>
          <div className="flex flex-col gap-4">
            {faqItems.map((f) => (
              <div key={f.q} className="border-2 border-[#E8F2F5] rounded-2xl p-6">
                <p className="font-bold text-[#1D4E5B] mb-2 text-base">{f.q}</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="px-6 py-3.5 bg-[#1D4E5B] text-white rounded-xl font-bold text-sm hover:bg-[#163A43] transition-colors"><I e="💬" /> Voir toute la FAQ</Link>
            <WhatsAppButton label="Nous écrire sur WhatsApp" message="Bonjour, j'ai une question sur les tarifs Proximo CI !" />
          </div>
        </div>
      </div>
    </div>
  );
}
