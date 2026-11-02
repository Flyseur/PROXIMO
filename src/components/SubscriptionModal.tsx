import { useState, useEffect } from "react";
import { api, fmtFcfa, fmtDate, userToken, type PublicUser } from "../lib/api";
import { I } from "./Icon";
import { ErrorBox, Field, inputClass } from "./ui";

export interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: "Pro" | "Entreprise";
  initialBillingCycle?: "monthly" | "yearly";
  userPhone?: string;
  onSuccess?: (sub: { plan: string; reference: string; expiresAt: string; billingCycle?: string }) => void;
}

type Operator = "wave" | "orange_money" | "mtn_momo";

const OPERATORS: { id: Operator; label: string; sub: string; color: string; border: string; bg: string; badge: string; icon: string; logo: string }[] = [
  {
    id: "wave",
    label: "Wave Côte d'Ivoire",
    sub: "0% frais de retrait · Débit immédiat",
    color: "text-[#0096E6]",
    border: "border-[#0096E6]",
    bg: "bg-[#E6F5FC]",
    badge: "bg-[#0096E6] text-white",
    icon: "🌊",
    logo: "/payments/wave.jpg",
  },
  {
    id: "orange_money",
    label: "Orange Money CI",
    sub: "Validation via application Max it ou #144#",
    color: "text-[#FF7900]",
    border: "border-[#FF7900]",
    bg: "bg-[#FFF3E6]",
    badge: "bg-[#FF7900] text-white",
    icon: "🍊",
    logo: "/payments/orange-money.png",
  },
  {
    id: "mtn_momo",
    label: "MTN Mobile Money",
    sub: "MoMo Pay · Validation via *133#",
    color: "text-[#D99B00]",
    border: "border-[#FFCC00]",
    bg: "bg-[#FFFDE6]",
    badge: "bg-[#FFCC00] text-[#1D4E5B]",
    icon: "🟡",
    logo: "/payments/mtn-momo.jpg",
  },
];

export default function SubscriptionModal({
  isOpen,
  onClose,
  initialPlan = "Pro",
  initialBillingCycle = "monthly",
  userPhone = "",
  onSuccess,
}: SubscriptionModalProps) {
  const [plan, setPlan] = useState<"Pro" | "Entreprise">(initialPlan);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(initialBillingCycle);
  const [operator, setOperator] = useState<Operator>("wave");
  const [phone, setPhone] = useState(userPhone);
  const [customerName, setCustomerName] = useState("");
  const [step, setStep] = useState<"form" | "processing" | "payment_pending" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reference: string;
    plan: string;
    amount: number;
    operator: string;
    phone: string;
    startsAt: string;
    expiresAt: string;
    message: string;
    billingCycle?: string;
    paymentUrl?: string | null;
    checkoutUrl?: string | null;
    status?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPlan(initialPlan);
      setBillingCycle(initialBillingCycle || "monthly");
      setPhone(userPhone);
      setStep("form");
      setError(null);
      setResult(null);
    }
  }, [isOpen, initialPlan, initialBillingCycle, userPhone]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !loading) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  // Polling automatique de vérification de paiement GeniusPay (toutes les 3s)
  useEffect(() => {
    if (step !== "payment_pending" || !result?.reference) return;

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const verifyRes = await api.get<{ success: boolean; data: { status: string } }>(
          `/geniuspay/verify/${encodeURIComponent(result.reference)}`
        );
        if (verifyRes?.data?.status === "completed") {
          stopped = true;
          clearInterval(interval);
          setStep("success");
        }
      } catch {
        // En attente
      }
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [step, result]);

  if (!isOpen) return null;

  const isYearly = billingCycle === "yearly";
  const amount = plan === "Pro" ? (isYearly ? 25000 : 2500) : (isYearly ? 50000 : 5000);
  const currentOp = OPERATORS.find((o) => o.id === operator) || OPERATORS[0];

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || (cleanPhone.length !== 10 && !cleanPhone.startsWith("225"))) {
      setError("Veuillez saisir un numéro de téléphone ivoirien valide à 10 chiffres (ex: 07 00 00 00 00).");
      return;
    }

    setStep("processing");
    setLoading(true);

    try {
      const hasUser = !!userToken.get();
      const res = await api.post<{
        ok: boolean;
        reference: string;
        plan: string;
        amount: number;
        operator: string;
        phone: string;
        startsAt: string;
        expiresAt: string;
        message: string;
        billingCycle?: string;
        status?: string;
        checkoutUrl?: string | null;
        paymentUrl?: string | null;
        token?: string;
        user: PublicUser;
      }>("/subscriptions", {
        plan,
        billingCycle,
        operator,
        phone: cleanPhone,
        customerName: customerName.trim() || undefined,
      }, hasUser ? "user" : false);

      if (res.token) {
        userToken.set(res.token);
      }

      setResult(res);

      const targetUrl = res.paymentUrl || res.checkoutUrl || null;
      if (targetUrl) {
        setStep("payment_pending");
        try {
          window.open(targetUrl, "_blank");
        } catch {
          // Popup bloqué : l'utilisateur cliquera sur le bouton dédié
        }
      } else {
        setStep("success");
      }
    } catch (err: any) {
      setStep("form");
      setError(err.message || "Une erreur est survenue lors de l'activation de l'abonnement.");
    } finally {
      setLoading(false);
    }
  }

  async function checkPaymentStatusNow() {
    if (!result?.reference) return;
    setLoading(true);
    setError(null);
    try {
      const verifyRes = await api.get<{ success: boolean; data: { status: string } }>(
        `/geniuspay/verify/${encodeURIComponent(result.reference)}`
      );
      if (verifyRes?.data?.status === "completed") {
        setStep("success");
      } else {
        setError("Le paiement est toujours en attente de validation sur votre téléphone.");
      }
    } catch (err: any) {
      setError(err.message || "Impossible de vérifier le paiement.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulateSuccess() {
    if (!result?.reference) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/geniuspay/simulate-success/${encodeURIComponent(result.reference)}`);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation simulée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-modal-title"
      >
        {/* En-tête modal */}
        <div className="bg-gradient-to-r from-[#1D4E5B] to-[#2B6D7F] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl"><I e="⭐" /></span>
            <div>
              <h2 id="sub-modal-title" className="text-xl font-bold tracking-tight">
                {step === "success" ? "Abonnement Activé !" : "Souscrire à Proximo CI"}
              </h2>
              <p className="text-xs text-[#B0D4DC]">
                {step === "success" ? "Validation instantanée via GeniusPay CI" : "Paiement sécurisé GeniusPay CI · Offres illimitées"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-9 h-9 flex items-center justify-center transition-colors disabled:opacity-50 text-xl font-bold"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Corps */}
        <div className="p-6">
          {step === "form" && (
            <form onSubmit={handleSubscribe} className="space-y-5">
              {/* Choix de la périodicité : Mensuel vs Annuel */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1D4E5B] mb-2">
                  Périodicité de facturation
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#F4F8F9] p-1.5 rounded-2xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      billingCycle === "monthly"
                        ? "bg-white text-[#1D4E5B] shadow-sm border border-gray-200"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Mensuel (30 jours)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      billingCycle === "yearly"
                        ? "bg-white text-[#1D4E5B] shadow-sm border border-gray-200"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    <span>Annuel (1 an)</span>
                    <span className="bg-[#F26522] text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">2 mois offerts</span>
                  </button>
                </div>
              </div>

              {/* Choix de la formule */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1D4E5B] mb-2">
                  Formule choisie
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlan("Pro")}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      plan === "Pro"
                        ? "border-[#F26522] bg-[#FFF5EE] ring-2 ring-[#F26522]/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#1D4E5B]">Plan Pro</span>
                      <span className="text-xs bg-[#F26522] text-white px-2 py-0.5 rounded-full font-bold">Populaire</span>
                    </div>
                    <p className="text-xl font-extrabold text-[#F26522]">
                      {isYearly ? "25 000" : "2 500"}{" "}
                      <span className="text-xs font-normal">FCFA/{isYearly ? "an" : "mois"}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {isYearly ? "Offres illimitées (2 mois gratuits)" : "Offres illimitées + mise en avant"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan("Entreprise")}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      plan === "Entreprise"
                        ? "border-[#1D4E5B] bg-[#E8F2F5] ring-2 ring-[#1D4E5B]/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#1D4E5B]">Entreprise</span>
                      <span className="text-xs bg-[#1D4E5B] text-white px-2 py-0.5 rounded-full font-bold">PME</span>
                    </div>
                    <p className="text-xl font-extrabold text-[#1D4E5B]">
                      {isYearly ? "50 000" : "5 000"}{" "}
                      <span className="text-xs font-normal">FCFA/{isYearly ? "an" : "mois"}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {isYearly ? "Badge vérifié (2 mois gratuits)" : "Badge vérifié + support dédié"}
                    </p>
                  </button>
                </div>
              </div>

              {/* Sélection opérateur Mobile Money */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1D4E5B] mb-2">
                  Opérateur Mobile Money Côte d'Ivoire
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {OPERATORS.map((op) => {
                    const isSelected = operator === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOperator(op.id)}
                        className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                          isSelected
                            ? `${op.border} ${op.bg} shadow-sm font-bold`
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={op.logo}
                          alt={op.label}
                          className="h-8 w-auto max-w-[65px] object-contain rounded shrink-0"
                        />
                        <span className="text-xs font-bold text-gray-800 line-clamp-1">
                          {op.id === "orange_money" ? "Orange Money" : op.id === "mtn_momo" ? "MTN MoMo" : "Wave"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
                  <span><I e="ℹ️" /></span> {currentOp.sub}
                </p>
              </div>

              {/* Nom du client si non connecté */}
              {!userToken.get() && (
                <Field label="Votre nom complet" id="sub-name">
                  <input
                    id="sub-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Kouamé Jean"
                    className={inputClass}
                  />
                </Field>
              )}

              {/* Numéro de téléphone */}
              <Field label="Votre numéro Mobile Money (Côte d'Ivoire)" id="sub-phone" required>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                    +225
                  </span>
                  <input
                    id="sub-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07 00 00 00 00"
                    className={`${inputClass} pl-16`}
                  />
                </div>
              </Field>

              {/* Récapitulatif montant */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">
                    {isYearly ? "Montant annuel débité (365 jours)" : "Montant mensuel débité (30 jours)"}
                  </p>
                  <p className="text-sm font-bold text-[#1D4E5B]">
                    {plan === "Pro"
                      ? (isYearly ? "Formule Pro Annuelle" : "Formule Pro Mensuelle")
                      : (isYearly ? "Formule Entreprise Annuelle" : "Formule Entreprise Mensuelle")}
                  </p>
                  {isYearly && (
                    <p className="text-[11px] text-[#F26522] font-bold mt-0.5">
                      ✓ 2 mois gratuits inclus ({plan === "Pro" ? "5 000 FCFA" : "10 000 FCFA"} d'économie)
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#F26522]">{fmtFcfa(amount)}</p>
                  <p className="text-[11px] text-emerald-600 font-bold">{isYearly ? "Valable 1 an" : "Sans engagement"}</p>
                </div>
              </div>

              {error && <ErrorBox message={error} />}

              {/* Boutons d'action */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-3.5 px-6 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-xl text-sm font-black shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                >
                  <span>Confirmer le paiement ({fmtFcfa(amount)})</span>
                  <span><I e="→" /></span>
                </button>
              </div>
            </form>
          )}

          {step === "processing" && (
            <div className="py-12 px-4 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-[#F26522] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#1D4E5B]">Initiation sécurisée GeniusPay CI...</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Connexion avec la passerelle GeniusPay pour générer votre ordre de débit {currentOp.label}.
              </p>
              <div className="inline-flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-4 py-2 rounded-full border border-amber-200">
                <span className="animate-pulse">●</span> Préparation de la transaction
              </div>
            </div>
          )}

          {step === "payment_pending" && result && (
            <div className="py-6 px-2 text-center space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-[#E6F5FC] border border-[#0096E6]/30 flex items-center justify-center mx-auto shadow-sm">
                <img
                  src={currentOp.logo}
                  alt={currentOp.label}
                  className="h-10 w-auto object-contain rounded"
                />
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#1D4E5B]">Finaliser votre paiement sécurisé</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Transaction GeniusPay CI · Référence : <span className="font-mono font-bold text-[#1D4E5B]">{result.reference}</span>
                </p>
              </div>

              {/* Bouton d'ouverture du lien de paiement */}
              {(result.paymentUrl || result.checkoutUrl) && (
                <div className="space-y-2">
                  <a
                    href={result.paymentUrl || result.checkoutUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 bg-[#0096E6] hover:bg-[#0085CC] text-white rounded-2xl text-base font-black shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                  >
                    <span>Ouvrir le paiement {operator === "wave" ? "Wave" : "Mobile Money"} ({fmtFcfa(result.amount)})</span>
                    <span><I e="→" /></span>
                  </a>
                  <p className="text-[11px] text-gray-400">
                    Cliquez sur ce bouton pour ouvrir l'application Wave ou finaliser sur le portail sécurisé GeniusPay.
                  </p>
                </div>
              )}

              {/* Statut d'attente animé */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5 text-left">
                <div className="flex items-center gap-2 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span>En attente de votre confirmation...</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Dès que vous validez la transaction sur votre téléphone ({phone}), votre abonnement {plan} s'active automatiquement en temps réel.
                </p>
              </div>

              {error && <ErrorBox message={error} />}

              {/* Actions de vérification & démo */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={checkPaymentStatusNow}
                  disabled={loading}
                  className="w-full sm:flex-1 py-3 px-4 border-2 border-[#1D4E5B] text-[#1D4E5B] hover:bg-[#E8F2F5] rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {loading ? "Vérification..." : "Vérifier le statut"}
                </button>
                <button
                  type="button"
                  onClick={handleSimulateSuccess}
                  disabled={loading}
                  className="w-full sm:flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Valide immédiatement la transaction pour les tests de développement"
                >
                  Simuler validation (Test)
                </button>
              </div>
            </div>
          )}

          {step === "success" && result && (
            <div className="space-y-5 animate-fade-in text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-md">
                ✓
              </div>
              <div>
                <h3 className="text-2xl font-black text-[#1D4E5B] mb-1">Félicitations !</h3>
                <p className="text-sm text-gray-600">{result.message}</p>
              </div>

              {/* Reçu d'abonnement */}
              <div className="bg-[#F8FAFC] border-2 border-dashed border-gray-200 rounded-2xl p-5 text-left text-xs space-y-2.5">
                <div className="flex justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-500">Référence transaction</span>
                  <span className="font-mono font-bold text-[#1D4E5B]">{result.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Formule activée</span>
                  <span className="font-bold text-[#F26522] uppercase tracking-wider">
                    {result.plan} {result.billingCycle === "yearly" ? "Annuel (1 an)" : "Mensuel (30 jours)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Montant réglé</span>
                  <span className="font-bold text-gray-800">{fmtFcfa(result.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Opérateur</span>
                  <span className="font-bold text-gray-800 capitalize">{result.operator.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date d'expiration</span>
                  <span className="font-bold text-emerald-600">{fmtDate(result.expiresAt)}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccess && result) {
                      onSuccess({ plan: result.plan, reference: result.reference, expiresAt: result.expiresAt, billingCycle: result.billingCycle });
                    }
                    onClose();
                  }}
                  className="w-full py-3.5 px-6 bg-[#1D4E5B] hover:bg-[#163A43] text-white rounded-xl text-sm font-bold shadow-md transition-colors"
                >
                  Terminer & Profiter de mes avantages
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
