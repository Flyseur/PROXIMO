import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import Logo from "../components/Logo";
import { api, ApiError, userToken, type AuthChallenge, type PublicUser } from "../lib/api";
import { I, Rich } from "../components/Icon";

type Stored = AuthChallenge & { purpose: "login" | "signup" };

export default function TwoFA() {
  const navigate = useNavigate();
  const [challenge] = useState<Stored | null>(() => {
    try { return JSON.parse(sessionStorage.getItem("prx_challenge") ?? "null"); } catch { return null; }
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Si l'utilisateur est déjà connecté, aller directement au tableau de bord
    if (userToken.get()) {
      navigate("/tableau-de-bord", { replace: true });
      return;
    }
    // Si aucun challenge n'est présent, rediriger vers la connexion
    if (!challenge) {
      navigate("/connexion", { replace: true });
    }
  }, [challenge, navigate]);

  async function handleDirectAccess() {
    if (!challenge) {
      navigate("/connexion", { replace: true });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ token: string; user: PublicUser }>("/auth/verify", {
        challengeId: challenge.challengeId,
        bypass: true,
      });
      userToken.set(res.token);
      sessionStorage.removeItem("prx_challenge");
      navigate("/tableau-de-bord", { replace: true });
    } catch {
      sessionStorage.removeItem("prx_challenge");
      navigate("/connexion", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (!challenge) return null;

  return (
    <div className="min-h-screen bg-[#F4F8F9] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/"><Logo size="md" className="mx-auto justify-center" /></Link>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-[#E8F2F5]">
          <div className="w-20 h-20 bg-[#E8F2F5] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl"><I e="🔓" /></span>
          </div>
          <h1 className="text-2xl text-[#1D4E5B] font-bold text-center mb-2">Authentification simplifiée</h1>
          <p className="text-[#6B7280] text-sm text-center mb-1">Compte associé au</p>
          <p className="text-[#F26522] font-bold text-center text-sm mb-6">{challenge.maskedPhone}</p>

          <div className="bg-[#EBF7F2] border border-[#A6E1CA] rounded-xl px-4 py-3 text-xs text-[#1D6F42] text-center mb-6">
            <span className="font-semibold block mb-1">✨ Le code par SMS n'est plus requis !</span>
            <span>Pour votre confort, l'accès se fait désormais directement avec vos identifiants sans attendre de SMS.</span>
          </div>

          <button
            onClick={handleDirectAccess}
            disabled={busy}
            className="w-full py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md disabled:opacity-50 mb-6 flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? "Connexion en cours…" : <Rich text="✓ Accéder à mon compte sans code" />}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center mb-4" role="alert">
              <I e="⚠️" /> {error}
            </div>
          )}

          <div className="border-t border-[#E8F2F5] pt-5 text-center">
            <Link
              to="/connexion"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D4E5B] hover:text-[#F26522] transition-colors"
            >
              <I e="←" /> Revenir à la page de connexion
            </Link>
          </div>
        </div>
        <p className="text-xs text-[#9CA3AF] text-center mt-6">
          <I e="🔒" /> Connexion directe et sécurisée · Proximo CI
        </p>
      </div>
    </div>
  );
}
