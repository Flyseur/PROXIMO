import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Logo from "../components/Logo";
import { ErrorBox } from "../components/ui";
import { api, ApiError, COMMUNES, userToken, type PublicUser } from "../lib/api";
import CommuneSelect from "../components/CommuneSelect";
import { I, Rich } from "../components/Icon";

const metiers = [
  "Menuisier", "Électricien", "Plombier", "Peintre", "Maçon", "Jardinier",
  "Toiturier", "Climatiseur", "Coiffeur/Coiffeuse", "Mécanicien", "Carrossier",
  "Nounou / Garde d'enfants", "Chauffeur", "Agent de nettoyage",
  "Serveur/Serveuse", "Cuisinier/Cuisinière", "Photographe", "Autre"
];

type Mode = "login" | "signup";
type SignupRole = "artisan" | "client";

const base = "w-full border-2 rounded-xl px-4 py-3.5 text-base focus:outline-none transition-colors";
const cls = (err?: string) => `${base} ${err ? "border-red-400 bg-red-50/40" : "border-[#D1D9DC] focus:border-[#1D4E5B] bg-white"}`;
const selCls = (err?: string) => `${cls(err)} text-[#1D4E5B] font-semibold`;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [signupRole, setSignupRole] = useState<SignupRole>("artisan");
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    identifier: "", password: "",
    firstName: "", lastName: "", phone: "", email: "", metier: "", commune: "", passwordNew: "", passwordConfirm: "",
    diplome: "", ecole: "", annees: "", certification: "", description: "",
  });

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setFormError("");
  };

  function validateClientSignup() {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Prénom requis";
    if (!form.lastName.trim()) errs.lastName = "Nom requis";
    if (!form.phone.trim()) errs.phone = "Numéro de téléphone requis";
    else if (!/^\+?[\d\s-]{8,16}$/.test(form.phone)) errs.phone = "Numéro invalide (format CI 10 chiffres)";
    if (!form.commune) errs.commune = "Précisez votre commune";
    if (!form.passwordNew) errs.passwordNew = "Mot de passe requis";
    else if (form.passwordNew.length < 6) errs.passwordNew = "6 caractères minimum";
    if (form.passwordNew !== form.passwordConfirm) errs.passwordConfirm = "Les mots de passe ne correspondent pas";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateArtisanStep1() {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Prénom requis";
    if (!form.lastName.trim()) errs.lastName = "Nom requis";
    if (!form.phone.trim()) errs.phone = "Numéro de téléphone requis";
    else if (!/^\+?[\d\s-]{8,16}$/.test(form.phone)) errs.phone = "Numéro invalide (format CI 10 chiffres)";
    if (!form.metier) errs.metier = "Précisez votre métier";
    if (!form.commune) errs.commune = "Précisez votre commune";
    if (!form.passwordNew) errs.passwordNew = "Mot de passe requis";
    else if (form.passwordNew.length < 6) errs.passwordNew = "6 caractères minimum";
    if (form.passwordNew !== form.passwordConfirm) errs.passwordConfirm = "Les mots de passe ne correspondent pas";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignupSubmit() {
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        role: signupRole,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        commune: form.commune,
        password: form.passwordNew,
        ...(signupRole === "artisan" ? {
          metier: form.metier,
          annees: form.annees,
          diplome: form.diplome,
          ecole: form.ecole,
          certification: form.certification,
          description: form.description,
        } : {}),
      };

      const res = await api.post<{ token: string; user: PublicUser }>("/auth/signup", payload);
      if (res.token) {
        userToken.set(res.token);
        sessionStorage.removeItem("prx_challenge");
        navigate("/tableau-de-bord");
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const field = e.data.field as string | undefined;
        if (field) {
          setErrors((er) => ({ ...er, [field]: e.message }));
          if (signupRole === "artisan") setStep(1);
        } else {
          setFormError(e.message);
        }
      } else {
        setFormError("Une erreur inattendue est survenue.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.identifier.trim()) errs.identifier = "Numéro de téléphone requis";
    if (!form.password.trim()) errs.password = "Mot de passe requis";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError("");
    try {
      const res = await api.post<{ token: string; user: PublicUser }>("/auth/login", { identifier: form.identifier, password: form.password });
      if (res.token) {
        userToken.set(res.token);
        sessionStorage.removeItem("prx_challenge");
        navigate("/tableau-de-bord");
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Identifiant ou mot de passe incorrect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Panneau latéral gauche */}
      <div className="hidden lg:flex lg:w-5/12 relative bg-[#1D4E5B] text-white flex-col justify-between p-12">
        <img
          src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&h=1200&fit=crop&auto=format"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative">
          <Link to="/" aria-label="Retour à l'accueil">
            <Logo size="md" className="brightness-0 invert" />
          </Link>
        </div>
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#F26522] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
            <I e="🇨🇮" /> Plateforme officielle CI
          </div>
          <h2 className="text-4xl leading-tight font-black">
            L'écosystème de confiance pour vos travaux et prestations.
          </h2>
          <ul className="space-y-3 text-[#B0D4DC] text-sm">
            {[
              "✓ Inscription rapide et sécurisée",
              "✓ Acomptes protégés sous séquestre Mobile Money",
              "✓ Vérification d'identité et avis certifiés",
              "✓ Échanges directs par WhatsApp",
              "✓ Connexion simple et sécurisée par mot de passe",
            ].map((f) => (
              <li key={f}><Rich text={f} /></li>
            ))}
          </ul>
          <div className="pt-4 border-t border-white/20">
            <p className="text-[#8FAFB7] text-xs mb-3">Besoin immédiat d'un artisan qualifié ?</p>
            <Link
              to="/recherche"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-xl font-bold text-sm transition-all shadow-md"
            >
              <I e="🔍" /> Trouver un artisan sans compte <I e="→" />
            </Link>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex items-start justify-center px-6 py-10 bg-[#F4F8F9] overflow-y-auto min-h-screen">
        <div className="w-full max-w-lg">
          <div className="lg:hidden mb-6">
            <Link to="/"><Logo size="sm" /></Link>
          </div>

          {/* Onglets Connexion / Inscription */}
          <div className="flex bg-white rounded-2xl p-1.5 mb-6 border-2 border-[#E8F2F5] shadow-xs">
            <button
              onClick={() => { setMode("login"); setStep(1); setFormError(""); }}
              aria-pressed={mode === "login"}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                mode === "login" ? "bg-[#1D4E5B] text-white shadow-sm" : "text-[#6B7280] hover:text-[#1D4E5B]"
              }`}
            >
              <I e="🔐" /> Connexion
            </button>
            <button
              onClick={() => { setMode("signup"); setStep(1); setFormError(""); }}
              aria-pressed={mode === "signup"}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                mode === "signup" ? "bg-[#F26522] text-white shadow-sm" : "text-[#6B7280] hover:text-[#F26522]"
              }`}
            >
              <I e="✨" /> Créer un compte
            </button>
          </div>

          {/* MODE CONNEXION */}
          {mode === "login" && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#E8F2F5]">
              <h1 className="text-3xl text-[#1D4E5B] mb-1 font-bold">Bon retour !</h1>
              <p className="text-[#6B7280] text-sm mb-6">Connectez-vous avec votre numéro de téléphone et mot de passe.</p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="identifier" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                    <Rich text={"📱 Numéro de téléphone"} />
                  </label>
                  <input
                    id="identifier"
                    type="tel"
                    autoComplete="username"
                    placeholder="07 01 02 03 04 ou +225..."
                    value={form.identifier}
                    onChange={(e) => set("identifier", e.target.value)}
                    className={cls(errors.identifier)}
                  />
                  {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier}</p>}
                </div>
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label htmlFor="password" className="text-xs font-bold text-[#1D4E5B]">
                      <I e="🔒" /> Mot de passe
                    </label>
                    <Link to="/contact" className="text-xs text-[#F26522] hover:underline font-semibold">
                      Oublié ?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    className={cls(errors.password)}
                    placeholder="••••••••"
                  />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                {formError && <ErrorBox message={formError} />}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-4 bg-[#F26522] text-white rounded-2xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {busy ? "Vérification…" : <Rich text={"🔐 Se connecter"} />}
                </button>
              </form>

              <p className="text-xs text-[#9CA3AF] text-center mt-6">
                Vous n'avez pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setStep(1); }}
                  className="text-[#F26522] font-bold hover:underline"
                >
                  Inscrivez-vous ici <I e="→" />
                </button>
              </p>
            </div>
          )}

          {/* MODE INSCRIPTION : CHOIX DU PROFIL */}
          {mode === "signup" && (
            <div className="space-y-6">
              
              {/* Sélecteur de rôle : Artisan ou Client */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setSignupRole("artisan"); setStep(1); setFormError(""); }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    signupRole === "artisan"
                      ? "border-[#F26522] bg-[#FFF2EB] ring-1 ring-[#F26522]"
                      : "border-[#E8F2F5] bg-white hover:border-[#D1D9DC]"
                  }`}
                >
                  <span className="text-2xl mb-1 block">🔨</span>
                  <p className="font-bold text-sm text-[#1D4E5B]">Je suis Artisan</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Recevoir des chantiers & devis</p>
                </button>

                <button
                  type="button"
                  onClick={() => { setSignupRole("client"); setStep(1); setFormError(""); }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    signupRole === "client"
                      ? "border-[#1D4E5B] bg-[#E8F2F5] ring-1 ring-[#1D4E5B]"
                      : "border-[#E8F2F5] bg-white hover:border-[#D1D9DC]"
                  }`}
                >
                  <span className="text-2xl mb-1 block">👤</span>
                  <p className="font-bold text-sm text-[#1D4E5B]">Je suis Particulier</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Commander des travaux & acomptes</p>
                </button>
              </div>

              {/* FORMULAIRE INSCRIPTION CLIENT */}
              {signupRole === "client" && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#E8F2F5]">
                  <div className="mb-6">
                    <h1 className="text-2xl text-[#1D4E5B] font-bold">Compte Particulier / Client</h1>
                    <p className="text-[#6B7280] text-xs mt-1">Créez votre compte gratuit pour suivre vos commandes et acomptes sécurisés.</p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); if (validateClientSignup()) handleSignupSubmit(); }} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="cFirstName" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Prénom *</label>
                        <input id="cFirstName" type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={cls(errors.firstName)} placeholder="Koffi" />
                        {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                      </div>
                      <div>
                        <label htmlFor="cLastName" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Nom *</label>
                        <input id="cLastName" type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={cls(errors.lastName)} placeholder="Stephane" />
                        {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cPhone" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="📱" /> Numéro de téléphone Mobile Money *
                      </label>
                      <input
                        id="cPhone"
                        type="tel"
                        placeholder="07 01 02 03 04"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        className={cls(errors.phone)}
                      />
                      {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="📍" /> Votre commune *
                      </label>
                      <CommuneSelect
                        variant="form"
                        value={form.commune}
                        onChange={(c) => set("commune", c)}
                        placeholder="Sélectionnez votre commune..."
                        hasError={!!errors.commune}
                      />
                      {errors.commune && <p className="text-red-500 text-xs mt-1">{errors.commune}</p>}
                    </div>

                    <div>
                      <label htmlFor="cPasswordNew" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🔒" /> Mot de passe * <span className="text-[#9CA3AF] font-normal">(6 caractères minimum)</span>
                      </label>
                      <input
                        id="cPasswordNew"
                        type="password"
                        autoComplete="new-password"
                        maxLength={64}
                        value={form.passwordNew}
                        onChange={(e) => set("passwordNew", e.target.value)}
                        className={cls(errors.passwordNew)}
                        placeholder="••••••••"
                      />
                      {errors.passwordNew && <p className="text-red-500 text-xs mt-1">{errors.passwordNew}</p>}
                    </div>

                    <div>
                      <label htmlFor="cPasswordConfirm" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🔒" /> Confirmer le mot de passe *
                      </label>
                      <input
                        id="cPasswordConfirm"
                        type="password"
                        autoComplete="new-password"
                        maxLength={64}
                        value={form.passwordConfirm}
                        onChange={(e) => set("passwordConfirm", e.target.value)}
                        className={cls(errors.passwordConfirm)}
                        placeholder="••••••••"
                      />
                      {errors.passwordConfirm && <p className="text-red-500 text-xs mt-1">{errors.passwordConfirm}</p>}
                    </div>

                    {formError && <ErrorBox message={formError} />}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-4 bg-[#1D4E5B] hover:bg-[#2B6D7F] text-white rounded-2xl font-bold text-base transition-colors shadow-md mt-2 disabled:opacity-60"
                    >
                      {busy ? "Création du compte…" : <Rich text={"✓ Créer mon compte client"} />}
                    </button>

                    <p className="text-xs text-[#9CA3AF] text-center">
                      En créant un compte, vous acceptez nos <Link to="/mentions-legales" className="text-[#F26522] font-semibold hover:underline">CGU</Link>.
                    </p>
                  </form>
                </div>
              )}

              {/* FORMULAIRE INSCRIPTION ARTISAN (ÉTAPE 1) */}
              {signupRole === "artisan" && step === 1 && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#E8F2F5]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-[#F26522] text-white flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h1 className="text-2xl text-[#1D4E5B] font-bold">Espace Artisan — Identité</h1>
                      <p className="text-[#6B7280] text-xs">Ces informations serviront à créer votre vitrine professionnelle.</p>
                    </div>
                    <span className="ml-auto text-xs text-[#9CA3AF] font-semibold">1 / 2</span>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="firstName" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Prénom *</label>
                        <input id="firstName" type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={cls(errors.firstName)} placeholder="Jean-Baptiste" />
                        {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Nom *</label>
                        <input id="lastName" type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={cls(errors.lastName)} placeholder="Kouassi" />
                        {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="📱" /> Numéro WhatsApp / Téléphone *
                      </label>
                      <input id="phone" type="tel" placeholder="+225 07 XX XX XX XX" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={cls(errors.phone)} />
                      {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label htmlFor="metier" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🛠️" /> Votre métier principal *
                      </label>
                      <select id="metier" value={form.metier} onChange={(e) => set("metier", e.target.value)} className={selCls(errors.metier)}>
                        <option value="">Sélectionnez votre métier...</option>
                        {metiers.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      {errors.metier && <p className="text-red-500 text-xs mt-1">{errors.metier}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="📍" /> Commune d'intervention principale *
                      </label>
                      <CommuneSelect
                        variant="form"
                        value={form.commune}
                        onChange={(c) => set("commune", c)}
                        placeholder="Sélectionnez votre commune..."
                        hasError={!!errors.commune}
                      />
                      {errors.commune && <p className="text-red-500 text-xs mt-1">{errors.commune}</p>}
                    </div>

                    <div>
                      <label htmlFor="passwordNew" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🔒" /> Mot de passe * <span className="text-[#9CA3AF] font-normal">(6 caractères min)</span>
                      </label>
                      <input id="passwordNew" type="password" autoComplete="new-password" maxLength={64} value={form.passwordNew} onChange={(e) => set("passwordNew", e.target.value)} className={cls(errors.passwordNew)} placeholder="••••••••" />
                      {errors.passwordNew && <p className="text-red-500 text-xs mt-1">{errors.passwordNew}</p>}
                    </div>

                    <div>
                      <label htmlFor="passwordConfirm" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🔒" /> Confirmer le mot de passe *
                      </label>
                      <input id="passwordConfirm" type="password" autoComplete="new-password" maxLength={64} value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} className={cls(errors.passwordConfirm)} placeholder="••••••••" />
                      {errors.passwordConfirm && <p className="text-red-500 text-xs mt-1">{errors.passwordConfirm}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => validateArtisanStep1() && setStep(2)}
                      className="w-full py-4 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-2xl font-bold text-base transition-colors shadow-md mt-2 flex items-center justify-center gap-2"
                    >
                      <span>Continuer — Étape 2 / 2</span>
                      <I e="→" />
                    </button>

                    <p className="text-xs text-[#9CA3AF] text-center">
                      En créant un compte, vous acceptez nos <Link to="/mentions-legales" className="text-[#F26522] font-semibold hover:underline">CGU</Link>.
                    </p>
                  </div>
                </div>
              )}

              {/* FORMULAIRE INSCRIPTION ARTISAN (ÉTAPE 2) */}
              {signupRole === "artisan" && step === 2 && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#E8F2F5]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#1D4E5B] text-white flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h1 className="text-2xl text-[#1D4E5B] font-bold">Compétences & Expérience</h1>
                      <p className="text-[#6B7280] text-xs">Ces informations renforcent la confiance de vos futurs clients.</p>
                    </div>
                    <span className="ml-auto text-xs text-[#9CA3AF] font-semibold">2 / 2</span>
                  </div>

                  <div className="bg-[#EBF7F2] border border-[#A6E1CA] rounded-2xl px-4 py-3 mb-6 flex items-start gap-2.5 text-xs text-[#1D6F42]">
                    <span className="text-base">🛡️</span>
                    <p>Ces détails permettront à l'équipe Proximo CI de valider votre profil sous 48h et de vous attribuer le badge vérifié.</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="annees" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="⏱️" /> Années d'expérience professionnelle
                      </label>
                      <select id="annees" value={form.annees} onChange={(e) => set("annees", e.target.value)} className={selCls()}>
                        <option value="">Sélectionnez...</option>
                        {["Moins d'1 an", "1–3 ans", "3–5 ans", "5–10 ans", "Plus de 10 ans"].map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="diplome" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🎓" /> Diplôme ou certificat (optionnel)
                      </label>
                      <input id="diplome" type="text" placeholder="Ex: CAP Menuiserie, Certificat FDFP..." value={form.diplome} onChange={(e) => set("diplome", e.target.value)} className={cls()} />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="📝" /> Courte bio / Présentation de vos services
                      </label>
                      <textarea id="description" rows={3} placeholder="Présentez votre savoir-faire et vos engagements de ponctualité..." value={form.description} onChange={(e) => set("description", e.target.value)} className={`${cls()} resize-none text-sm`} />
                    </div>

                    {formError && <ErrorBox message={formError} />}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex-1 py-4 border-2 border-[#D1D9DC] text-[#1D4E5B] rounded-2xl font-bold text-sm hover:bg-[#E8F2F5] transition-colors"
                      >
                        <I e="←" /> Retour
                      </button>
                      <button
                        type="button"
                        onClick={handleSignupSubmit}
                        disabled={busy}
                        className="flex-2 py-4 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-2xl font-bold text-base transition-colors shadow-md disabled:opacity-60"
                      >
                        {busy ? "Finalisation…" : <Rich text={"✓ Valider mon inscription"} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
