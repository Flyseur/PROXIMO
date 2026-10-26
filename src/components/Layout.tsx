import { Link, Outlet, useLocation } from "react-router";
import { useState, useEffect } from "react";
import Logo from "./Logo";
import ContactChooser from "./ContactChooser";
import { userToken, adminToken } from "../lib/api";

import { I, Rich } from "./Icon";
function PromoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-gradient-to-r from-[#F26522] via-[#e05510] to-[#1D4E5B] text-white text-sm py-2.5 px-4 flex items-center justify-center gap-3 relative">
      <span className="hidden sm:inline text-base" aria-hidden="true"><I e="🇨🇮" /></span>
      <p className="text-center leading-snug">
        <strong>Proximo CI</strong> — Trouvez un artisan qualifié en Côte d'Ivoire en moins de 5 minutes.
        <Link to="/recherche" className="ml-2 underline underline-offset-2 font-bold hover:text-[#FFD9C4] transition-colors">Essayer maintenant <I e="→" /></Link>
      </p>
      <button onClick={() => setDismissed(true)} aria-label="Fermer la bannière" className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"><I e="✕" /></button>
    </div>
  );
}

const navLinks = [
  { to: "/services", label: "Services", icon: "🛠️" },
  { to: "/recherche", label: "Trouver un pro", icon: "🔍" },
  { to: "/tarifs", label: "Tarifs", icon: "💰" },
  { to: "/publier-offre", label: "Publier une offre", icon: "📢" },
  { to: "/contact", label: "Contact", icon: "💬" },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const loggedIn = !!userToken.get();
  const adminLoggedIn = !!adminToken.get();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      {adminLoggedIn && (
        <div className="bg-[#0E2A31] text-white text-xs py-1.5 px-6 flex items-center justify-between border-b border-white/10 z-50">
          <span className="flex items-center gap-2 text-amber-300 font-semibold">
            <span>🛡️</span>
            <span>Session Super Admin active</span>
            {loggedIn && <span className="text-white/60 font-normal hidden sm:inline">· (Compte client également ouvert)</span>}
          </span>
          <div className="flex items-center gap-3">
            {loggedIn && (
              <button
                type="button"
                onClick={() => { userToken.clear(); window.location.reload(); }}
                className="text-xs text-red-300 hover:text-white underline transition-colors cursor-pointer"
              >
                Déconnecter la session client
              </button>
            )}
            <Link
              to="/backoffice-secret"
              className="px-3 py-1 bg-[#F26522] hover:bg-[#C84E10] text-white font-bold rounded-lg text-xs transition-colors"
            >
              Retour au Backoffice →
            </Link>
          </div>
        </div>
      )}
      <PromoBanner />
      <div className="bg-[#163A43] text-white text-xs py-1.5 px-6 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5"><I e="📍" /> Côte d'Ivoire · Abidjan & régions</span>
        <div className="flex items-center gap-4">
          <a href="tel:+2250747002255" className="hover:text-[#F26522] transition-colors flex items-center gap-1"><I e="📞" /> +225 07 47 00 22 55</a>
          <ContactChooser phone="2250747002255" name="Proximo CI" message="Bonjour Proximo CI, je souhaite contacter un prestataire !" variant="link" />
        </div>
      </div>

      <header className={`sticky top-0 z-50 border-b-2 shadow-sm transition-colors duration-300 ${scrolled ? "bg-[#F26522] border-[#C84E10]" : "bg-white border-[#E8F2F5]"}`}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Proximo CI – Accueil"><Logo size="sm" className={scrolled ? "brightness-0 invert" : ""} /></Link>

          <nav className="hidden lg:flex items-center gap-1.5" aria-label="Navigation principale">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to}
                className={`group flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  location.pathname === l.to
                    ? (scrolled ? "bg-white/20 text-white shadow-xs" : "bg-[#1D4E5B] text-white shadow-xs")
                    : (scrolled ? "text-white hover:bg-white/20" : "text-[#1D4E5B] hover:bg-[#E8F2F5]")}`}>
                <span className="text-base transition-transform duration-200 group-hover:scale-110">
                  <I e={l.icon} />
                </span>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            {loggedIn ? (
              <Link to="/tableau-de-bord" className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-md whitespace-nowrap bg-[#1D4E5B] text-white hover:bg-[#163A43] transition-all flex items-center gap-2"><I e="👤" /> MON ESPACE</Link>
            ) : (
              <>
                <Link to="/connexion?mode=signup" className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold whitespace-nowrap transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95 flex items-center gap-1.5 ${scrolled ? "border-white text-white hover:bg-white/20" : "border-[#1D4E5B] text-[#1D4E5B] hover:bg-[#E8F2F5]"}`}><I e="👤" className="text-sm opacity-80" /> S'INSCRIRE</Link>
                <Link to="/connexion" className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-md whitespace-nowrap transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95 flex items-center gap-1.5 ${scrolled ? "bg-[#1D4E5B] text-white hover:bg-[#163A43]" : "bg-[#F26522] text-white hover:bg-[#C84E10]"}`}><I e="🔐" className="text-sm opacity-90" /> SE CONNECTER</Link>
              </>
            )}
          </div>

          <button className="md:hidden p-3 rounded-xl hover:bg-[#E8F2F5] transition-colors" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen}>
            <div className="w-6 flex flex-col gap-1.5">
              <span className={`block h-0.5 bg-[#1D4E5B] rounded transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
              <span className={`block h-0.5 bg-[#1D4E5B] rounded transition-all ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 bg-[#1D4E5B] rounded transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </div>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t-2 border-[#E8F2F5] bg-white px-6 py-5 flex flex-col gap-2">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#F4F8F9] text-[#1D4E5B] font-semibold text-base">
                <I e={l.icon} className="text-xl" />{l.label}
              </Link>
            ))}
            <hr className="border-[#E8F2F5] my-1" />
            {loggedIn ? (
              <Link to="/tableau-de-bord" className="flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1D4E5B] text-white font-bold text-base"><I e="👤" /> MON ESPACE</Link>
            ) : (
              <>
                <Link to="/connexion?mode=signup" className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-[#1D4E5B] text-[#1D4E5B] font-bold text-base">S'INSCRIRE</Link>
                <Link to="/connexion" className="flex items-center justify-center gap-2 py-4 rounded-xl bg-[#F26522] text-white font-bold text-base shadow-md">SE CONNECTER</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-[#163A43] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="mb-5"><Logo size="md" className="brightness-0 invert" /></div>
            <p className="text-sm text-[#8FAFB7] leading-relaxed mb-5">La plateforme qui connecte particuliers et professionnels avec les meilleurs prestataires de Côte d'Ivoire.</p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#8FAFB7] mb-4">Navigation</h4>
            <ul className="space-y-2.5">
              {[["/", "🏠 Accueil"], ["/services", "🛠️ Services"], ["/recherche", "🔍 Trouver un pro"], ["/tarifs", "💰 Tarifs"], ["/publier-offre", "📢 Publier une offre"]].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-sm text-[#8FAFB7] hover:text-white transition-colors"><Rich text={label} /></Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#8FAFB7] mb-4">Espace Pro</h4>
            <ul className="space-y-2.5">
              {[["/connexion", "🔐 Connexion"], ["/tableau-de-bord", "📊 Mon tableau de bord"], ["/poster-offre", "📋 Poster un service"], ["/contact", "💬 Contact & FAQ"]].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-sm text-[#8FAFB7] hover:text-white transition-colors"><Rich text={label} /></Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#8FAFB7] mb-4">Communes</h4>
            <div className="flex flex-wrap gap-2 mb-5">
              {["Cocody", "Yopougon", "Plateau", "Abobo", "Marcory", "Koumassi", "Treichville", "Adjamé"].map((c) => (
                <Link key={c} to={`/recherche?commune=${c}`} className="text-xs bg-[#1D4E5B] text-[#B0D4DC] px-2.5 py-1 rounded-full hover:bg-[#2A6E80] transition-colors"><I e="📍" /> {c}</Link>
              ))}
            </div>
            <div className="pt-4 border-t border-[#1D4E5B] space-y-1.5">
              <Link to="/mentions-legales" className="text-xs text-[#8FAFB7] hover:text-white transition-colors block"><I e="📄" /> Mentions légales</Link>
              <Link to="/mentions-legales#privacy" className="text-xs text-[#8FAFB7] hover:text-white transition-colors block"><I e="🔒" /> Confidentialité</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-[#1D4E5B]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-[#5A7A82]">© 2026 Proximo CI SARL. Tous droits réservés.</p>
            <p className="text-xs text-[#5A7A82]"><I e="🇨🇮" /> Fait avec <I e="♥" /> en Côte d'Ivoire</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
