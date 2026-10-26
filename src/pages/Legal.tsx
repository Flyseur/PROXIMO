import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import WhatsAppIcon from "../components/WhatsAppIcon";

import { I } from "../components/Icon";
const sections = [
  { id: "mentions", icon: "📄", title: "Mentions légales", content: `
**Éditeur du site**
Proximo CI SARL — Société à responsabilité limitée au capital de 5 000 000 FCFA
Siège social : Cocody Angré, Abidjan, Côte d'Ivoire
RCCM : CI-ABJ-2024-B-12345
Directeur de la publication : Konan Alexandre

**Hébergement**
OVH SAS — 2 rue Kellermann, 59100 Roubaix, France

**Contact**
Email : contact@proximo.ci
WhatsApp / Tél. : +225 07 47 00 22 55
Horaires : Lundi–Samedi, 8h–20h` },
  { id: "cgv", icon: "📋", title: "Conditions générales de vente", content: `
**Article 1 – Objet**
Les présentes CGV régissent les relations entre Proximo CI SARL et ses utilisateurs (clients et artisans) en Côte d'Ivoire dans le cadre de l'utilisation de la plateforme www.proximo.ci.

**Article 2 – Services proposés**
Proximo CI est une plateforme de mise en relation entre particuliers et artisans en Côte d'Ivoire. Proximo CI n'intervient pas directement dans l'exécution des travaux.

**Article 3 – Inscription et compte**
L'accès aux services nécessite un compte. L'inscription est gratuite. L'utilisateur peut s'inscrire avec son numéro WhatsApp. Il garantit l'exactitude des informations fournies.

**Article 4 – Commissions**
Proximo CI prélève une commission de 8% HT sur chaque mission réalisée via la plateforme. Les paiements sont acceptés par Orange Money, MTN Mobile Money, Wave, carte bancaire ou virement.

**Article 5 – Responsabilité**
Proximo CI agit en qualité d'intermédiaire. Sa responsabilité ne peut être engagée pour les litiges entre clients et artisans concernant la qualité des travaux.` },
  { id: "privacy", icon: "🔒", title: "Politique de confidentialité", content: `
**Collecte des données**
Proximo CI collecte les données nécessaires au fonctionnement : nom, prénom, numéro de téléphone/WhatsApp, commune, et données de paiement Mobile Money.

**Finalités du traitement**
Les données sont traitées pour : la gestion des comptes, la mise en relation artisans/clients, l'amélioration du service, et les communications commerciales avec votre consentement.

**Base légale**
Le traitement est fondé sur l'exécution du contrat (CGV) et, pour les communications marketing, sur votre consentement explicite.

**Durée de conservation**
Les données sont conservées pendant la durée de la relation contractuelle, puis 3 ans maximum.

**Vos droits**
Vous disposez des droits d'accès, rectification, effacement et opposition. Contactez-nous : privacy@proximo.ci ou via WhatsApp.

**Cookies**
Nous utilisons uniquement des cookies techniques essentiels au fonctionnement du site, aucun cookie publicitaire tiers.` },
  { id: "cookies", icon: "🍪", title: "Politique de cookies", content: `
**Cookies essentiels uniquement**
Proximo CI utilise uniquement des cookies techniques nécessaires au bon fonctionnement du site (authentification, préférences de session). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.

**Gestion des cookies**
Vous pouvez supprimer les cookies via les paramètres de votre navigateur à tout moment. Cela peut affecter certaines fonctionnalités du site.` },
];

function renderContent(text: string) {
  return text.trim().split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold text-[#1D4E5B] mt-5 mb-1.5 text-base">{line.replace(/\*\*/g, "")}</p>;
    if (line.trim() === "") return null;
    return <p key={i} className="text-sm text-[#6B7280] leading-relaxed">{line}</p>;
  });
}

export default function Legal() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div>
      <div className="bg-[#1D4E5B] text-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="text-sm text-[#8FAFB7] mb-6 flex items-center gap-2" aria-label="Fil d'Ariane">
            <Link to="/" className="hover:text-white transition-colors"><I e="🏠" /> Accueil</Link><span>/</span><span className="text-white font-semibold"><I e="📄" /> Mentions légales</span>
          </nav>
          <h1 className="text-6xl mb-3">Informations légales</h1>
          <p className="text-[#8FAFB7]">Dernière mise à jour : 1er septembre 2026 · <I e="🇨🇮" /> Droit ivoirien applicable</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <nav className="hidden lg:block" aria-label="Navigation de la page">
            <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-4">Sur cette page</p>
            <ul className="flex flex-col gap-2 sticky top-24">
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F26522] transition-colors py-1 font-medium"><span aria-hidden="true"><I e={s.icon} /></span>{s.title}</a></li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3 flex flex-col gap-12">
            {sections.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="flex items-center gap-3 text-3xl text-[#1D4E5B] mb-6 pb-4 border-b-2 border-[#E8F2F5]"><span aria-hidden="true"><I e={s.icon} /></span>{s.title}</h2>
                <div className="flex flex-col gap-1">{renderContent(s.content)}</div>
              </div>
            ))}
            <div className="bg-[#F4F8F9] border-2 border-[#E8F2F5] rounded-2xl p-8">
              <h3 className="font-bold text-[#1D4E5B] text-lg mb-2" style={{ fontFamily: "var(--font-body)" }}>Des questions sur vos droits ?</h3>
              <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">Notre équipe est disponible sur WhatsApp pour répondre à vos questions sur la protection de vos données personnelles.</p>
              <div className="flex flex-wrap gap-3">
                <Link to="/contact" className="flex items-center gap-2 px-6 py-4 bg-[#1D4E5B] text-white rounded-xl font-bold text-sm hover:bg-[#163A43] transition-colors"><I e="💬" /> Contacter l'équipe</Link>
                <a href="https://wa.me/2250747002255?text=Bonjour%20Proximo%20CI%2C%20j%27ai%20une%20question%20sur%20mes%20donn%C3%A9es%20personnelles" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-4 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1EB85A] transition-colors"><WhatsAppIcon className="w-4 h-4" />WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
