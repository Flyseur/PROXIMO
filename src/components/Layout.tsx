import { Link, Outlet, useLocation } from "react-router";
import { useState, useEffect } from "react";
import Logo from "./Logo";
import ContactChooser from "./ContactChooser";
import { userToken, adminToken } from "../lib/api";

import { I, Rich } from "./Icon";
import {
  RiHome5Fill,
  RiHome5Line,
  RiToolsFill,
  RiToolsLine,
  RiSearch2Line,
  RiSearch2Fill,
  RiAddLine,
  RiApps2Fill,
  RiApps2Line,
  RiUser3Fill,
  RiLockPasswordFill,
  RiPriceTag3Fill,
  RiFileList3Fill,
  RiChatSmile2Fill,
  RiCloseLine,
  RiArrowRightSLine,
  RiPhoneFill,
  RiLogoutBoxRFill,
} from "react-icons/ri";
import { FaWhatsapp } from "react-icons/fa6";
function PromoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-gradient-to-r from-[#F26522] via-[#e05510] to-[#1D4E5B] text-white py-2 px-3 sm:px-4 pr-8 flex items-center justify-center gap-2 sm:gap-3 relative w-full overflow-hidden">
      <span className="hidden sm:inline text-base shrink-0" aria-hidden="true"><I e="🇨🇮" /></span>
      <p className="text-center leading-snug text-xs sm:text-sm">
        <strong>Proximo CI</strong> — Trouvez un artisan en CI en 5 min.
        <Link to="/recherche" className="ml-1.5 underline underline-offset-2 font-bold hover:text-[#FFD9C4] transition-colors whitespace-nowrap">Essayer <I e="→" /></Link>
      </p>
      <button onClick={() => setDismissed(true)} aria-label="Fermer la bannière" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity text-base leading-none p-1"><I e="✕" /></button>
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
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
      {adminLoggedIn && (
        <div className="bg-[#0E2A31] text-white text-xs py-1.5 px-4 sm:px-6 flex items-center justify-between border-b border-white/10 z-50 w-full overflow-x-hidden">
          <span className="flex items-center gap-2 text-amber-300 font-semibold truncate text-[11px] sm:text-xs">
            <span>🛡️</span>
            <span>Admin actif</span>
            {loggedIn && <span className="text-white/60 font-normal hidden sm:inline">· (Client ouvert)</span>}
          </span>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {loggedIn && (
              <button
                type="button"
                onClick={() => { userToken.clear(); window.location.reload(); }}
                className="text-[11px] sm:text-xs text-red-300 hover:text-white underline transition-colors cursor-pointer"
              >
                Déconnexion
              </button>
            )}
            <Link
              to="/backoffice-secret"
              className="px-2.5 sm:px-3 py-1 bg-[#F26522] hover:bg-[#C84E10] text-white font-bold rounded-lg text-[11px] sm:text-xs transition-colors whitespace-nowrap"
            >
              Backoffice →
            </Link>
          </div>
        </div>
      )}
      <PromoBanner />
      <div className="bg-[#163A43] text-white text-xs py-1.5 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 w-full">
        <span className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
          <I e="📍" /> <span className="hidden sm:inline">Côte d'Ivoire ·</span> Abidjan & régions
        </span>
        <div className="flex items-center gap-3 shrink-0 text-[11px] sm:text-xs">
          <a href="tel:+2250747002255" className="hover:text-[#F26522] transition-colors flex items-center gap-1 whitespace-nowrap"><I e="📞" /> 07 47 00 22 55</a>
          <ContactChooser phone="2250747002255" name="Proximo CI" message="Bonjour Proximo CI, je souhaite contacter un prestataire !" variant="link" />
        </div>
      </div>

      <header className={`sticky top-0 z-50 border-b-2 shadow-sm transition-colors duration-300 w-full ${scrolled ? "bg-[#F26522] border-[#C84E10]" : "bg-white border-[#E8F2F5]"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-4 w-full">
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
        </div>
      </header>

      {/* Main Content (with bottom padding on mobile so fixed Flutter navbar never overlaps content) */}
      <main className="flex-1 pb-24 md:pb-0 w-full max-w-full overflow-x-hidden"><Outlet /></main>

      {/* Flutter-style Bottom Navigation Bar (Mobile only) */}
      <nav
        aria-label="Navigation mobile Flutter"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="max-w-md mx-auto grid grid-cols-5 items-end justify-items-center relative">
          {/* 1. Accueil */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center py-1 w-full transition-all group ${
              location.pathname === "/" ? "text-[#F26522]" : "text-slate-500 hover:text-[#1D4E5B]"
            }`}
          >
            <div
              className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                location.pathname === "/" ? "bg-[#F26522]/15 scale-105" : "group-active:scale-90"
              }`}
            >
              {location.pathname === "/" ? (
                <RiHome5Fill className="text-xl text-[#F26522]" />
              ) : (
                <RiHome5Line className="text-xl" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight mt-0.5">Accueil</span>
          </Link>

          {/* 2. Services */}
          <Link
            to="/services"
            className={`flex flex-col items-center justify-center py-1 w-full transition-all group ${
              location.pathname.startsWith("/services") ? "text-[#F26522]" : "text-slate-500 hover:text-[#1D4E5B]"
            }`}
          >
            <div
              className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                location.pathname.startsWith("/services") ? "bg-[#F26522]/15 scale-105" : "group-active:scale-90"
              }`}
            >
              {location.pathname.startsWith("/services") ? (
                <RiToolsFill className="text-xl text-[#F26522]" />
              ) : (
                <RiToolsLine className="text-xl" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight mt-0.5">Services</span>
          </Link>

          {/* 3. Central Raised FAB (Flutter style) */}
          <Link
            to="/publier-offre"
            className="relative -top-4 flex flex-col items-center group -mt-1"
            aria-label="Publier une offre de mission"
          >
            <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#F26522] via-[#FF7A3D] to-[#F26522] text-white flex items-center justify-center shadow-lg shadow-[#F26522]/40 ring-4 ring-white active:scale-90 transition-all duration-200">
              <RiAddLine className="text-3xl font-black transition-transform group-hover:rotate-90 duration-300" />
            </div>
            <span className="text-[10px] font-extrabold text-[#F26522] tracking-tight mt-0.5">Publier</span>
          </Link>

          {/* 4. Trouver un pro */}
          <Link
            to="/recherche"
            className={`flex flex-col items-center justify-center py-1 w-full transition-all group ${
              location.pathname.startsWith("/recherche") || location.pathname.startsWith("/artisan")
                ? "text-[#F26522]"
                : "text-slate-500 hover:text-[#1D4E5B]"
            }`}
          >
            <div
              className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                location.pathname.startsWith("/recherche") || location.pathname.startsWith("/artisan")
                  ? "bg-[#F26522]/15 scale-105"
                  : "group-active:scale-90"
              }`}
            >
              {location.pathname.startsWith("/recherche") || location.pathname.startsWith("/artisan") ? (
                <RiSearch2Fill className="text-xl text-[#F26522]" />
              ) : (
                <RiSearch2Line className="text-xl" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight mt-0.5">Trouver</span>
          </Link>

          {/* 5. Plus (Bouton qui regroupe les éléments hors de la barre du bas) */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex flex-col items-center justify-center py-1 w-full transition-all group cursor-pointer ${
              menuOpen
                ? "text-[#F26522]"
                : "text-slate-500 hover:text-[#1D4E5B]"
            }`}
            aria-label="Plus d'options"
            aria-expanded={menuOpen}
          >
            <div
              className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                menuOpen
                  ? "bg-[#F26522]/15 scale-105"
                  : "group-active:scale-90"
              }`}
            >
              {menuOpen ? (
                <RiApps2Fill className="text-xl text-[#F26522] rotate-90 transition-transform duration-300" />
              ) : (
                <RiApps2Line className="text-xl transition-transform group-hover:scale-110" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight mt-0.5">
              Plus
            </span>
          </button>
        </div>
      </nav>

      {/* Volet Flottant Style Flutter (Sort directement au-dessus de la barre de nav) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop avec flou et clic pour fermer */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panneau Flottant au-dessus de la barre de navigation */}
          <div className="relative z-10 mx-3 mb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] bg-white/98 backdrop-blur-2xl rounded-3xl shadow-[0_12px_45px_rgba(0,0,0,0.25)] border border-slate-200/90 max-h-[75vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
            {/* En-tête */}
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F26522] animate-pulse" />
                <span className="text-xs font-black text-[#1D4E5B] uppercase tracking-wider">
                  Plus d'options & Compte
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer text-base"
                aria-label="Fermer"
              >
                <RiCloseLine />
              </button>
            </div>

            {/* Contenu - Regroupe SEULEMENT les éléments hors de la barre du bas */}
            <div className="p-4 overflow-y-auto space-y-3.5">
              {/* Compte & Authentification */}
              {loggedIn ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1D4E5B] to-[#163A43] text-white shadow-sm">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-base">
                        <RiUser3Fill />
                      </div>
                      <div>
                        <p className="font-bold text-xs">Mon Espace Proximo</p>
                        <p className="text-[10px] text-white/70">Connecté</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/tableau-de-bord"
                      className="py-2 px-2.5 rounded-xl bg-white text-[#1D4E5B] text-xs font-bold text-center hover:bg-slate-100 transition-colors"
                    >
                      Tableau de bord →
                    </Link>
                    <button
                      type="button"
                      onClick={() => { userToken.clear(); window.location.reload(); }}
                      className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium text-center transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <RiLogoutBoxRFill className="text-xs" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/connexion?mode=signup"
                    className="py-3 px-3 rounded-2xl border-2 border-[#1D4E5B] text-[#1D4E5B] font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 hover:bg-[#E8F2F5] active:scale-98 transition-all"
                  >
                    <RiUser3Fill className="text-sm opacity-80" />
                    S'INSCRIRE
                  </Link>
                  <Link
                    to="/connexion"
                    className="py-3 px-3 rounded-2xl bg-gradient-to-r from-[#F26522] to-[#FF7A3D] text-white font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-md shadow-[#F26522]/30 active:scale-98 transition-all"
                  >
                    <RiLockPasswordFill className="text-sm opacity-90" />
                    SE CONNECTER
                  </Link>
                </div>
              )}

              {/* Éléments qui NE SONT PAS dans la barre du bas */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Rubriques complémentaires
                </p>

                <Link
                  to="/tarifs"
                  className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#F4F8F9] hover:bg-[#E8F2F5] text-[#1D4E5B] transition-all border border-slate-100/80 active:scale-98 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                      <RiPriceTag3Fill className="text-base" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#1D4E5B]">Tarifs & Abonnements</p>
                      <p className="text-[10px] text-slate-500">Transparence des forfaits et prix</p>
                    </div>
                  </div>
                  <RiArrowRightSLine className="text-slate-400 text-lg group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/poster-offre"
                  className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#F4F8F9] hover:bg-[#E8F2F5] text-[#1D4E5B] transition-all border border-slate-100/80 active:scale-98 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                      <RiFileList3Fill className="text-base" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#1D4E5B]">Demander un devis</p>
                      <p className="text-[10px] text-slate-500">Estimation rapide pour vos travaux</p>
                    </div>
                  </div>
                  <RiArrowRightSLine className="text-slate-400 text-lg group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/contact"
                  className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#F4F8F9] hover:bg-[#E8F2F5] text-[#1D4E5B] transition-all border border-slate-100/80 active:scale-98 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                      <RiChatSmile2Fill className="text-base" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#1D4E5B]">Contact & Support</p>
                      <p className="text-[10px] text-slate-500">FAQ, assistance et réclamations</p>
                    </div>
                  </div>
                  <RiArrowRightSLine className="text-slate-400 text-lg group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Assistance directe */}
              <div className="pt-2 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://wa.me/2250747002255?text=Bonjour%20Proximo%20CI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FaWhatsapp className="text-sm text-[#25D366]" />
                    WhatsApp
                  </a>
                  <a
                    href="tel:+2250747002255"
                    className="py-2.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1D4E5B] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RiPhoneFill className="text-sm text-[#F26522]" />
                    07 47 00 22 55
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
