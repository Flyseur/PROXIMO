import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import Logo from "../components/Logo";
import { api, ApiError, adminToken } from "../lib/api";
import { validatePassword } from "../lib/admin";

import { I, Rich } from "../components/Icon";
type Step = "credentials" | "2fa" | "locked";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pwdCheck = validatePassword(password);
  const strengthScore = 5 - pwdCheck.errors.length;
  const strengthColor = strengthScore <= 1 ? "bg-red-500" : strengthScore <= 3 ? "bg-amber-400" : "bg-green-500";
  const strengthLabel = strengthScore <= 1 ? "Très faible" : strengthScore <= 3 ? "Moyen" : strengthScore === 5 ? "Fort" : "Bon";

  useEffect(() => { if (step === "2fa") otpRefs.current[0]?.focus(); }, [step]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await api.post<{ challenge: string }>("/admin/login", { username, password });
      setChallenge(r.challenge);
      setPassword("");
      setStep("2fa");
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) setStep("locked");
      else setError(err instanceof ApiError ? err.message : "Erreur inattendue.");
    } finally { setLoading(false); }
  }

  async function verify(code: string) {
    setError(""); setLoading(true);
    try {
      const r = await api.post<{ token: string }>("/admin/verify-otp", { challenge, code });
      adminToken.set(r.token);
      navigate("/backoffice-secret");
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) { setStep("locked"); return; }
      if (err instanceof ApiError && err.status === 401 && err.message.startsWith("Étape expirée")) { setStep("credentials"); }
      setOtp(["", "", "", "", "", ""]);
      setError(err instanceof ApiError ? err.message : "Erreur inattendue.");
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  }

  async function handleDevFill() {
    setError(""); setLoading(true);
    try {
      const res = await api.post<{ code: string }>("/admin/dev-totp", { challenge });
      if (res.code) {
        const digits = res.code.split("");
        setOtp(digits);
        void verify(res.code);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la récupération du code.");
    } finally { setLoading(false); }
  }

  function handleOtpInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    if (val.length > 1) {
      val.slice(0, 6).split("").forEach((d, k) => { next[k] = d; });
      setOtp(next);
      if (next.every(Boolean)) void verify(next.join(""));
      return;
    }
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  }

  return (
    <div className="min-h-screen bg-[#0E2A31] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[#8FAFB7] text-xs font-semibold">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />{location.protocol === "https:" ? "Connexion chiffrée TLS" : "Connexion locale (HTTP)"}
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4"><Logo size="md" className="brightness-0 invert" /></div>
          <p className="text-[#8FAFB7] text-sm font-semibold uppercase tracking-widest mt-2">Espace d'administration sécurisé</p>
        </div>

        {step === "locked" && (
          <div className="bg-red-950/60 border-2 border-red-800 rounded-2xl p-8 text-center">
            <span className="text-5xl block mb-4"><I e="🔒" /></span>
            <h2 className="text-white font-bold text-xl mb-2" style={{ fontFamily: "var(--font-body)" }}>Accès bloqué</h2>
            <p className="text-red-300 text-sm leading-relaxed mb-6">Trop de tentatives échouées. Votre accès est temporairement bloqué pour des raisons de sécurité. Contactez l'administrateur système.</p>
            <p className="text-red-400 text-xs font-mono">Code: ERR_AUTH_MAX_ATTEMPTS_EXCEEDED</p>
          </div>
        )}

        {step === "credentials" && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#F26522]/20 rounded-xl flex items-center justify-center text-xl"><I e="🔐" /></div>
              <div><h2 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-body)" }}>Authentification</h2><p className="text-[#8FAFB7] text-xs">Étape 1 / 2 — Identifiants</p></div>
            </div>
            <form onSubmit={handleCredentials} className="flex flex-col gap-5">
              <div>
                <label htmlFor="a-user" className="block text-xs font-bold text-[#8FAFB7] uppercase tracking-widest mb-2">Identifiant</label>
                <input id="a-user" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nom d'utilisateur" autoComplete="username" required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-[#F26522] transition-colors font-mono" />
              </div>
              <div>
                <label htmlFor="a-pwd" className="block text-xs font-bold text-[#8FAFB7] uppercase tracking-widest mb-2">Mot de passe</label>
                <div className="relative">
                  <input id="a-pwd" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" autoComplete="current-password" required
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-[#F26522] transition-colors font-mono pr-12" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-sm" aria-label={showPwd ? "Masquer" : "Afficher"}>{showPwd ? <Rich text={"🙈"} /> : <Rich text={"👁️"} />}</button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-300 ${strengthColor}`} style={{ width: `${(strengthScore / 5) * 100}%` }} /></div>
                    <p className="text-xs text-white/40 mt-1">{strengthLabel}</p>
                  </div>
                )}
              </div>
              {error && <div className="flex items-start gap-2 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm" role="alert"><span><I e="⚠️" /></span><span>{error}</span></div>}
              <button type="submit" disabled={loading} className="w-full py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-900/30">
                {loading ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Rich text={"Continuer →"} />}
              </button>
            </form>
            <div className="mt-6 pt-5 border-t border-white/10"><p className="text-[#8FAFB7] text-xs text-center leading-relaxed">Accès restreint au personnel autorisé.<br />Toute tentative non autorisée est enregistrée et signalée.</p></div>
          </div>
        )}

        {step === "2fa" && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#1D4E5B]/50 rounded-xl flex items-center justify-center text-xl"><I e="📱" /></div>
              <div><h2 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-body)" }}>Double authentification</h2><p className="text-[#8FAFB7] text-xs">Étape 2 / 2 — Code OTP</p></div>
            </div>
            <p className="text-[#8FAFB7] text-sm mb-6 leading-relaxed">Saisissez le code à 6 chiffres affiché dans votre application d'authentification (Google Authenticator, Authy…).</p>
            <form onSubmit={(e) => { e.preventDefault(); void verify(otp.join("")); }} className="flex flex-col gap-6">
              <div className="flex gap-3 justify-center" aria-label="Code OTP à 6 chiffres">
                {otp.map((digit, i) => (
                  <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                    className="w-12 h-14 bg-white/10 border-2 border-white/20 text-white text-center text-2xl font-mono font-bold rounded-xl focus:outline-none focus:border-[#F26522] transition-colors" aria-label={`Chiffre ${i + 1}`} />
                ))}
              </div>
              {error && <div className="flex items-start gap-2 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm" role="alert"><span><I e="⚠️" /></span><span>{error}</span></div>}
              <button type="submit" disabled={otp.some((d) => !d) || loading} className="w-full py-4 bg-[#1D4E5B] text-white rounded-xl font-bold text-base hover:bg-[#163A43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Rich text={"✓ Valider l'accès"} />}
              </button>
            </form>
            <details className="mt-5 pt-4 border-t border-white/10 text-xs text-[#8FAFB7] group">
              <summary className="font-bold text-amber-300 hover:text-amber-200 cursor-pointer list-none flex items-center justify-between">
                <span>🔑 Configurer Google Authenticator / Authy</span>
                <span className="text-xs text-[#8FAFB7] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 p-3.5 bg-white/5 rounded-xl border border-white/10 space-y-2 text-left leading-relaxed">
                <p>1. Dans votre application (Google Authenticator, Authy...), appuyez sur <strong>+</strong> puis <strong>« Saisir une clé fournie »</strong>.</p>
                <p>2. Nom du compte : <strong className="text-white">Proximo Super Admin</strong></p>
                <p>3. Clé secrète :</p>
                <div className="bg-black/30 p-2 rounded-lg font-mono text-amber-300 text-center select-all tracking-wider text-xs border border-white/10">
                  QVNPQMMMLMSRD3BQ7UC3UGHTVPGWREWW
                </div>
                <p className="text-[11px] text-[#9CA3AF]">4. Type : Basée sur l'heure (TOTP 30s). Le code à 6 chiffres apparaîtra automatiquement.</p>
                <p className="text-[11px] text-[#9CA3AF] border-t border-white/10 pt-2">
                  Astuce console : lancez <code className="text-white bg-white/10 px-1 py-0.5 rounded font-mono">npm run admin:totp</code> pour afficher le code en direct.
                </p>
              </div>
            </details>

            <div className="mt-5 text-xs"><button onClick={() => { setStep("credentials"); setOtp(["", "", "", "", "", ""]); setError(""); }} className="text-[#8FAFB7] hover:text-white transition-colors"><I e="←" /> Retour</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
