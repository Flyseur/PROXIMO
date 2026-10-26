import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import Logo from "../components/Logo";
import { api, ApiError, userToken, type AuthChallenge, type PublicUser } from "../lib/api";

import { I, Rich } from "../components/Icon";
type Stored = AuthChallenge & { purpose: "login" | "signup" };

export default function TwoFA() {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Stored | null>(() => {
    try { return JSON.parse(sessionStorage.getItem("prx_challenge") ?? "null"); } catch { return null; }
  });
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!challenge) { navigate("/connexion", { replace: true }); return; }
    inputs.current[0]?.focus();
    const timer = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [challenge, navigate]);

  function handleChange(idx: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    // Collage d'un code complet
    if (val.length > 1) {
      val.slice(0, 6).split("").forEach((d, i) => { next[i] = d; });
      setCode(next);
      inputs.current[Math.min(val.length, 5)]?.focus();
      return;
    }
    next[idx] = val;
    setCode(next);
    setError("");
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[idx] && idx > 0) inputs.current[idx - 1]?.focus();
  }

  async function handleVerify() {
    const full = code.join("");
    if (full.length < 6) { setError("Veuillez saisir le code complet à 6 chiffres."); return; }
    if (!challenge) return;
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: PublicUser }>("/auth/verify", { challengeId: challenge.challengeId, code: full });
      userToken.set(res.token);
      sessionStorage.removeItem("prx_challenge");
      navigate("/tableau-de-bord", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inattendue.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally { setBusy(false); }
  }

  async function handleResend() {
    if (!challenge) return;
    try {
      const ch = await api.post<AuthChallenge>("/auth/resend", { challengeId: challenge.challengeId });
      const next = { ...ch, purpose: challenge.purpose };
      sessionStorage.setItem("prx_challenge", JSON.stringify(next));
      setChallenge(next);
      setResent(true); setError(""); setCountdown(60); setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de renvoyer le code.");
    }
  }

  if (!challenge) return null;

  return (
    <div className="min-h-screen bg-[#F4F8F9] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><Link to="/"><Logo size="md" className="mx-auto justify-center" /></Link></div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-[#E8F2F5]">
          <div className="w-20 h-20 bg-[#E8F2F5] rounded-2xl flex items-center justify-center mx-auto mb-6"><span className="text-4xl"><I e="🔐" /></span></div>
          <h1 className="text-3xl text-[#1D4E5B] text-center mb-2">Vérification 2FA</h1>
          <p className="text-[#6B7280] text-sm text-center mb-1">Un code de vérification à 6 chiffres a été envoyé au</p>
          <p className="text-[#F26522] font-bold text-center text-sm mb-8">{challenge.maskedPhone}</p>

          <div className="bg-[#EBF7F2] border border-[#A6E1CA] rounded-xl px-4 py-3 text-xs text-[#1D6F42] text-center mb-6 flex items-center justify-center gap-2">
            <span>📲</span>
            <span>Un code de sécurité confidentiel a été expédié par SMS.</span>
          </div>

          <div className="flex gap-2 justify-center mb-6" role="group" aria-label="Code de vérification à 6 chiffres">
            {code.map((digit, idx) => (
              <input key={idx} ref={(el) => { inputs.current[idx] = el; }} type="text" inputMode="numeric" autoComplete={idx === 0 ? "one-time-code" : "off"} maxLength={6} value={digit}
                onChange={(e) => handleChange(idx, e.target.value)} onKeyDown={(e) => handleKeyDown(idx, e)} aria-label={`Chiffre ${idx + 1}`}
                className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none ${error ? "border-red-400 bg-red-50" : digit ? "border-[#F26522] bg-[#FDE8D9]" : "border-[#D1D9DC] focus:border-[#1D4E5B]"}`} />
            ))}
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center mb-4" role="alert"><I e="⚠️" /> {error}</div>}
          {resent && !error && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 text-center mb-4"><I e="✅" /> Un nouveau code a été envoyé !</div>}

          <button onClick={handleVerify} disabled={code.join("").length < 6 || busy}
            className="w-full py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">{busy ? "Vérification…" : <Rich text={"✓ Vérifier le code"} />}</button>

          <div className="text-center mt-5">
            {countdown > 0 ? (
              <p className="text-sm text-[#9CA3AF]">Renvoyer le code dans <strong className="text-[#1D4E5B]">{countdown}s</strong></p>
            ) : (
              <button onClick={handleResend} className="text-sm text-[#F26522] font-bold hover:underline"><I e="🔄" /> Renvoyer le code</button>
            )}
          </div>

          <div className="text-center mt-6"><Link to="/connexion" className="text-xs text-[#9CA3AF] hover:text-[#F26522] transition-colors"><I e="←" /> Retour à la connexion</Link></div>
        </div>
        <p className="text-xs text-[#9CA3AF] text-center mt-6"><I e="🔒" /> Code valable 10 minutes · Protégé par chiffrement</p>
      </div>
    </div>
  );
}
