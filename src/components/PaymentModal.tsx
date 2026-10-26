import { useState, useEffect } from "react";
import { api, fmtFcfa, fmtDate, type PaymentReceipt } from "../lib/api";
import { I } from "./Icon";
import { ErrorBox, Field, inputClass } from "./ui";

export interface PaymentTargetRequest {
  id: number;
  title: string;
  category?: string;
  commune?: string;
  amount?: number | null;
  artisanName?: string;
  artisanPhone?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: PaymentTargetRequest | null;
  defaultPhone?: string;
  defaultName?: string;
  receiptReference?: string | null;
  onPaymentSuccess?: (receipt: PaymentReceipt) => void;
}

type Operator = "wave" | "orange_money" | "mtn_momo";

const OPERATORS: { id: Operator; label: string; sub: string; color: string; border: string; bg: string; badge: string; icon: string }[] = [
  {
    id: "wave",
    label: "Wave Côte d'Ivoire",
    sub: "Frais 1% · Sans frais de retrait",
    color: "text-[#0096E6]",
    border: "border-[#0096E6]",
    bg: "bg-[#E6F5FC]",
    badge: "bg-[#0096E6] text-white",
    icon: "🌊",
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
  },
];

export default function PaymentModal({
  isOpen,
  onClose,
  request,
  defaultPhone = "",
  defaultName = "",
  receiptReference = null,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [operator, setOperator] = useState<Operator>("wave");
  const [phone, setPhone] = useState(defaultPhone);
  const [customerName, setCustomerName] = useState(defaultName);
  const [amount, setAmount] = useState<number>(() => {
    if (request?.amount && request.amount > 0) {
      return Math.round(request.amount * 0.3); // 30% d'acompte par défaut
    }
    return 15000;
  });
  const [customAmountStr, setCustomAmountStr] = useState<string>("");
  const [amountMode, setAmountMode] = useState<"30" | "50" | "custom">("30");

  const [step, setStep] = useState<"form" | "processing" | "receipt">(receiptReference ? "receipt" : "form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);

  // Synchroniser état lors de l'ouverture
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (receiptReference) {
      setStep("receipt");
      setLoading(true);
      api.get<PaymentReceipt>(`/payments/receipt/${receiptReference}`)
        .then((res) => { setReceipt(res); })
        .catch((err) => { setError(err.message || "Impossible de charger le reçu."); })
        .finally(() => { setLoading(false); });
    } else {
      setStep("form");
      setReceipt(null);
      if (defaultPhone) setPhone(defaultPhone);
      if (defaultName) setCustomerName(defaultName);
      if (request?.amount && request.amount > 0) {
        setAmount(Math.round(request.amount * 0.3));
        setAmountMode("30");
      }
    }
  }, [isOpen, receiptReference, request, defaultPhone, defaultName]);

  if (!isOpen) return null;

  const currentOp = OPERATORS.find((o) => o.id === operator) || OPERATORS[0];

  function handleAmountPreset(pct: "30" | "50" | "custom") {
    setAmountMode(pct);
    if (!request?.amount || request.amount <= 0) {
      if (pct === "30") setAmount(15000);
      else if (pct === "50") setAmount(25000);
      return;
    }
    if (pct === "30") setAmount(Math.round(request.amount * 0.3));
    else if (pct === "50") setAmount(Math.round(request.amount * 0.5));
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    setError(null);

    const payAmount = amountMode === "custom" ? parseInt(customAmountStr, 10) : amount;
    if (isNaN(payAmount) || payAmount < 1000 || payAmount > 2000000) {
      setError("Le montant doit être compris entre 1 000 et 2 000 000 FCFA.");
      return;
    }

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("Veuillez renseigner un numéro Mobile Money ivoirien valide (10 chiffres).");
      return;
    }

    setStep("processing");

    try {
      const res = await api.post<{
        id: number;
        reference: string;
        amount: number;
        operator: string;
        phone: string;
        customerName: string;
        requestId: number;
        status: string;
        date: string;
      }>("/payments", {
        requestId: request.id,
        operator,
        phone,
        amount: payAmount,
        customerName: customerName || undefined,
      }, "user");

      // Charger le reçu complet
      const fullReceipt = await api.get<PaymentReceipt>(`/payments/receipt/${res.reference}`);
      setReceipt(fullReceipt);
      setStep("receipt");
      if (onPaymentSuccess) {
        onPaymentSuccess(fullReceipt);
      }
    } catch (err: any) {
      setError(err?.message || "Échec de l'initiation du paiement.");
      setStep("form");
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  const artisanPhone = receipt?.artisan?.phone || request?.artisanPhone || "";
  const waLink = artisanPhone
    ? `https://wa.me/${artisanPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Bonjour, j'ai effectué le versement de l'acompte de ${fmtFcfa(receipt?.amount || amount)} via ${receipt?.operator?.toUpperCase()} (Réf: ${receipt?.reference}) pour la demande : "${receipt?.request?.title || request?.title}".`
      )}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border-2 border-[#E8F2F5]">
        
        {/* En-tête modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#1D4E5B] to-[#2B6D7F] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl">
              {step === "receipt" ? "🧾" : "💳"}
            </span>
            <div>
              <h3 className="font-bold text-lg leading-tight">
                {step === "receipt" ? "Reçu officiel de paiement" : "Paiement d'acompte sécurisé"}
              </h3>
              <p className="text-xs text-white/80">
                {step === "receipt" ? "Garantie de séquestre Proximo CI" : "Wave · Orange Money · MTN MoMo"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && <ErrorBox message={error} />}

          {/* ÉTAPE 1 : FORMULAIRE DE PAIEMENT */}
          {step === "form" && request && (
            <form onSubmit={handleSubmitPayment} className="space-y-5">
              
              {/* Récapitulatif demande */}
              <div className="bg-[#F4F8F9] border border-[#E8F2F5] rounded-2xl p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Demande associée</span>
                <p className="font-bold text-[#1D4E5B] text-base mt-0.5">{request.title}</p>
                <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-1 flex-wrap">
                  {request.category && <span>🏷️ {request.category}</span>}
                  {request.commune && <span>📍 {request.commune}</span>}
                  {request.artisanName && <span className="font-semibold text-[#1D4E5B]">👤 Artisan : {request.artisanName}</span>}
                </div>
              </div>

              {/* Sélection de l'opérateur */}
              <div>
                <label className="block text-sm font-bold text-[#1D4E5B] mb-2.5">
                  1. Choisissez votre compte Mobile Money <span className="text-[#F26522]">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {OPERATORS.map((op) => {
                    const isSelected = operator === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOperator(op.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between ${
                          isSelected
                            ? `${op.border} ${op.bg} shadow-sm ring-1 ring-offset-1`
                            : "border-[#E8F2F5] hover:border-[#D1D9DC] bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{op.icon}</span>
                          <div>
                            <p className="font-bold text-[#1D4E5B] text-sm">{op.label}</p>
                            <p className="text-xs text-[#6B7280]">{op.sub}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? `${op.border} bg-[#1D4E5B]` : "border-[#D1D9DC]"
                            }`}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Choix du montant de l'acompte */}
              <div>
                <label className="block text-sm font-bold text-[#1D4E5B] mb-2">
                  2. Montant de l'acompte à bloquer <span className="text-[#F26522]">*</span>
                </label>
                
                {request.amount && request.amount > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => handleAmountPreset("30")}
                      className={`p-2.5 rounded-xl text-center border-2 text-xs font-bold transition-all ${
                        amountMode === "30"
                          ? "border-[#F26522] bg-[#FFF2EB] text-[#F26522]"
                          : "border-[#E8F2F5] hover:border-[#D1D9DC] text-[#1D4E5B]"
                      }`}
                    >
                      <span>30% (Matériaux)</span>
                      <p className="text-sm font-black mt-0.5">{fmtFcfa(Math.round(request.amount * 0.3))}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAmountPreset("50")}
                      className={`p-2.5 rounded-xl text-center border-2 text-xs font-bold transition-all ${
                        amountMode === "50"
                          ? "border-[#F26522] bg-[#FFF2EB] text-[#F26522]"
                          : "border-[#E8F2F5] hover:border-[#D1D9DC] text-[#1D4E5B]"
                      }`}
                    >
                      <span>50% (Démarrage)</span>
                      <p className="text-sm font-black mt-0.5">{fmtFcfa(Math.round(request.amount * 0.5))}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAmountPreset("custom")}
                      className={`p-2.5 rounded-xl text-center border-2 text-xs font-bold transition-all ${
                        amountMode === "custom"
                          ? "border-[#F26522] bg-[#FFF2EB] text-[#F26522]"
                          : "border-[#E8F2F5] hover:border-[#D1D9DC] text-[#1D4E5B]"
                      }`}
                    >
                      <span>Libre</span>
                      <p className="text-sm font-black mt-0.5">Autre somme</p>
                    </button>
                  </div>
                ) : null}

                {amountMode === "custom" || (!request.amount) ? (
                  <div className="relative">
                    <input
                      id="customAmount"
                      type="number"
                      min={1000}
                      max={2000000}
                      step={500}
                      placeholder="Ex: 20000"
                      value={customAmountStr}
                      onChange={(e) => setCustomAmountStr(e.target.value)}
                      className={inputClass}
                      required
                    />
                    <span className="absolute right-4 top-3.5 text-sm font-bold text-[#6B7280]">FCFA</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 bg-[#FFF2EB] border border-[#F26522]/30 rounded-xl">
                    <span className="text-xs font-semibold text-[#1D4E5B]">Montant sélectionné :</span>
                    <span className="text-lg font-black text-[#F26522]">{fmtFcfa(amount)}</span>
                  </div>
                )}
              </div>

              {/* Coordonnées payeur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Numéro Mobile Money" id="payPhone" required>
                  <input
                    id="payPhone"
                    type="tel"
                    placeholder="07 01 02 03 04"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Nom sur le compte" id="payName">
                  <input
                    id="payName"
                    type="text"
                    placeholder="Ex: Kouamé Jean"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* Message de garantie et sécurité */}
              <div className="bg-[#EBF7F2] border border-[#A6E1CA] rounded-2xl p-4 text-xs text-[#1D6F42] flex items-start gap-2.5">
                <span className="text-base">🛡️</span>
                <p>
                  <strong>Garantie Proximo CI :</strong> L'acompte est versé sur un compte de séquestre sécurisé. Les fonds ne sont libérés auprès de l'artisan qu'après le démarrage effectif de vos travaux.
                </p>
              </div>

              {/* Bouton de confirmation */}
              <button
                type="submit"
                className="w-full py-4 bg-[#F26522] hover:bg-[#C84E10] text-white font-bold rounded-2xl text-base shadow-lg shadow-[#F26522]/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Payer l'acompte avec {currentOp.label}</span>
                <I e="→" />
              </button>
            </form>
          )}

          {/* ÉTAPE 2 : ATTENTE VALIDATION USSD / PUSH */}
          {step === "processing" && (
            <div className="py-10 text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-[#E8F2F5] border-t-[#F26522] animate-spin" />
                <div className="absolute inset-2 rounded-full bg-[#FFF2EB] flex items-center justify-center text-2xl">
                  {currentOp.icon}
                </div>
              </div>
              <div>
                <h4 className="text-xl font-bold text-[#1D4E5B]">Confirmation push en cours...</h4>
                <p className="text-sm text-[#6B7280] max-w-sm mx-auto mt-2">
                  Une notification de validation a été envoyée sur votre compte <strong>{currentOp.label}</strong> au numéro <strong>{phone}</strong>.
                </p>
              </div>
              <div className="bg-[#F4F8F9] border border-[#E8F2F5] rounded-2xl p-4 max-w-sm mx-auto text-xs text-[#6B7280]">
                <p>Composez votre code secret sur votre téléphone pour valider le transfert sécurisé de <strong>{fmtFcfa(amountMode === "custom" ? parseInt(customAmountStr, 10) : amount)}</strong>.</p>
              </div>
              <p className="text-xs text-[#9CA3AF]">Sécurisation du flux par protocole TLS 1.3 & API Mobile Money CI</p>
            </div>
          )}

          {/* ÉTAPE 3 : REÇU OFFICIEL DE PAIEMENT */}
          {step === "receipt" && receipt && (
            <div className="space-y-6">
              <div id="proximo-printable-receipt" className="border-2 border-[#1D4E5B] rounded-3xl p-6 bg-gradient-to-b from-white to-[#F7FAFA] relative overflow-hidden">
                {/* Filigrane / Tampon officiel */}
                <div className="absolute right-4 top-4 border-2 border-emerald-500 text-emerald-600 font-black text-[10px] uppercase px-3 py-1 rounded-lg tracking-widest rotate-6 bg-emerald-50/80">
                  ✓ Acompte Vérifié & Séquestré
                </div>

                {/* En-tête du reçu */}
                <div className="border-b border-[#E8F2F5] pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-[#1D4E5B]">Proximo<span className="text-[#F26522]">.ci</span></span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">Reçu officiel de versement d'acompte travaux</p>
                </div>

                {/* Montant principal */}
                <div className="text-center py-4 bg-white rounded-2xl border border-[#E8F2F5] mb-5 shadow-sm">
                  <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">Montant réglé</p>
                  <p className="text-3xl font-black text-[#1D4E5B] mt-1">{fmtFcfa(receipt.amount)}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E6F5FC] text-[#0096E6]">
                    <span>📱 {receipt.operator.toUpperCase()}</span>
                    <span>· Réf : {receipt.reference}</span>
                  </div>
                </div>

                {/* Détails de la transaction */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#9CA3AF] uppercase font-bold tracking-wider block">Payeur</span>
                    <span className="font-bold text-[#1D4E5B] block mt-0.5">{receipt.customerName || "Client vérifié"}</span>
                    <span className="text-[#6B7280]">{receipt.phone}</span>
                  </div>
                  <div>
                    <span className="text-[#9CA3AF] uppercase font-bold tracking-wider block">Date & Heure</span>
                    <span className="font-bold text-[#1D4E5B] block mt-0.5">{fmtDate(receipt.date, true)}</span>
                    <span className="text-emerald-600 font-semibold">Statut : En séquestre</span>
                  </div>

                  {receipt.request && (
                    <div className="col-span-2 pt-2 border-t border-[#E8F2F5]">
                      <span className="text-[#9CA3AF] uppercase font-bold tracking-wider block">Objet de la demande</span>
                      <span className="font-bold text-[#1D4E5B] block mt-0.5">{receipt.request.title}</span>
                      <span className="text-[#6B7280]">{receipt.request.category} · {receipt.request.commune}</span>
                    </div>
                  )}

                  {receipt.artisan && (
                    <div className="col-span-2 pt-2 border-t border-[#E8F2F5]">
                      <span className="text-[#9CA3AF] uppercase font-bold tracking-wider block">Artisan bénéficiaire</span>
                      <span className="font-bold text-[#1D4E5B] block mt-0.5">{receipt.artisan.name} ({receipt.artisan.trade})</span>
                      <span className="text-[#6B7280]">Tél : {receipt.artisan.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-[#E8F2F5] text-[11px] text-[#6B7280] text-center">
                  Ce reçu atteste la réception des fonds sous séquestre par Proximo CI. En cas de litige, contactez le support au 07 00 00 00 00.
                </div>
              </div>

              {/* Actions Reçu */}
              <div className="space-y-3">
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>💬 Transmettre la preuve à l'artisan sur WhatsApp</span>
                  </a>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    className="flex-1 py-3 border-2 border-[#1D4E5B] text-[#1D4E5B] hover:bg-[#E8F2F5] font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🖨️ Imprimer / PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 bg-[#1D4E5B] hover:bg-[#2B6D7F] text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    Terminer
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "receipt" && loading && (
            <div className="py-12 text-center text-[#6B7280]">
              <span className="inline-block w-8 h-8 border-2 border-[#E8F2F5] border-t-[#F26522] rounded-full animate-spin mb-3" />
              <p className="text-sm font-semibold">Chargement du reçu sécurisé...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
