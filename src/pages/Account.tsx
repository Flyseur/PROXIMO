import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import { api, userToken, formatPhone, fmtDate, fmtFcfa, type PublicUser, type PaymentRecord, type PaymentReceipt } from "../lib/api";
import { I, Rich } from "../components/Icon";
import PaymentModal, { type PaymentTargetRequest } from "../components/PaymentModal";

interface Me {
  user: PublicUser;
  artisan: { trade: string; price: string | null; available: number; rating: number; reviews_count: number; missions: number; years_experience: number | null; bio: string | null } | null;
  requests: { id: number; title: string; category: string; commune: string; status: string; amount: number | null; date: string }[];
  payments?: PaymentRecord[];
}

const badge: Record<string, string> = {
  "Actif": "bg-green-50 text-green-700 border-green-200",
  "En attente": "bg-amber-50 text-amber-700 border-amber-200",
  "Suspendu": "bg-red-50 text-red-600 border-red-200",
  "En cours": "bg-blue-50 text-blue-700 border-blue-200",
  "Acompte versé": "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
  "Terminé": "bg-green-50 text-green-700 border-green-200",
  "Annulé": "bg-red-50 text-red-600 border-red-200",
};

const opBadges: Record<string, { label: string; icon: string; cls: string }> = {
  wave: { label: "Wave", icon: "🌊", cls: "bg-[#E6F5FC] text-[#0096E6] border-[#0096E6]/30" },
  orange_money: { label: "Orange Money", icon: "🍊", cls: "bg-[#FFF3E6] text-[#FF7900] border-[#FF7900]/30" },
  mtn_momo: { label: "MTN MoMo", icon: "🟡", cls: "bg-[#FFFDE6] text-[#D99B00] border-[#FFCC00]/40" },
};

export default function Account() {
  const navigate = useNavigate();
  const hasToken = !!userToken.get();
  const { data, error, loading, setData } = useFetch<Me>(hasToken ? "/me" : null, "user");
  const [toggling, setToggling] = useState(false);

  // Payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PaymentTargetRequest | null>(null);
  const [activeReceiptRef, setActiveReceiptRef] = useState<string | null>(null);

  useEffect(() => { if (!hasToken) navigate("/connexion", { replace: true }); }, [hasToken, navigate]);
  useEffect(() => { if (error?.status === 401) { userToken.clear(); navigate("/connexion", { replace: true }); } }, [error, navigate]);

  if (!hasToken || loading) return <Spinner />;
  if (error || !data) return <div className="max-w-xl mx-auto px-6 py-20"><ErrorBox message={error?.message ?? "Erreur de chargement."} /></div>;

  const { user, artisan, requests, payments = [] } = data;

  async function toggleAvailability() {
    if (!artisan) return;
    setToggling(true);
    try {
      const r = await api.patch<{ available: boolean }>("/me/availability", { available: !artisan.available }, "user");
      setData({ ...data!, artisan: { ...artisan, available: r.available ? 1 : 0 } });
    } finally { setToggling(false); }
  }

  function logout() { userToken.clear(); navigate("/"); }

  function openPaymentForRequest(r: { id: number; title: string; category: string; commune: string; amount: number | null }) {
    setActiveReceiptRef(null);
    setPayTarget({
      id: r.id,
      title: r.title,
      category: r.category,
      commune: r.commune,
      amount: r.amount,
    });
    setPayModalOpen(true);
  }

  function openReceiptModal(reference: string) {
    setActiveReceiptRef(reference);
    setPayTarget(null);
    setPayModalOpen(true);
  }

  function handlePaymentSuccess(receipt: PaymentReceipt) {
    // Mettre à jour l'état local pour refléter le changement immédiatement
    const updatedRequests = requests.map((rq) =>
      rq.id === receipt.request?.id ? { ...rq, status: "Acompte versé", amount: receipt.amount } : rq
    );
    const newPayment: PaymentRecord = {
      id: Date.now(),
      request_id: receipt.request?.id || 0,
      operator: receipt.operator as any,
      phone: receipt.phone,
      amount: receipt.amount,
      fee: 0,
      reference: receipt.reference,
      status: receipt.status,
      customer_name: receipt.customerName,
      created_at: receipt.date,
      request_title: receipt.request?.title,
    };
    setData({
      ...data!,
      requests: updatedRequests,
      payments: [newPayment, ...payments],
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-5xl text-[#1D4E5B] mb-2">Bonjour {user.firstName} <I e="👋" /></h1>
          <p className="text-[#6B7280]">{user.role === "artisan" ? "Espace artisan" : "Espace client"} · <I e="📱" /> {formatPhone(user.phone)}</p>
        </div>
        <button onClick={logout} className="px-5 py-3 border-2 border-[#D1D9DC] text-[#1D4E5B] rounded-xl font-bold text-sm hover:bg-[#E8F2F5] transition-colors"><I e="🚪" /> Déconnexion</button>
      </div>

      {user.status === "En attente" && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-6 py-4 mb-8 text-sm text-amber-800">
          <I e="⏳" /> <strong>Votre compte est en cours de validation</strong> par notre équipe (sous 48h). Votre profil sera visible dans la recherche dès son approbation.
        </div>
      )}
      {user.status === "Suspendu" && <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-6 py-4 mb-8 text-sm text-red-700"><I e="🚫" /> Votre compte est suspendu. <Link to="/contact" className="font-bold underline">Contactez le support</Link>.</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Statut du compte</p>
          <span className={`text-sm px-3 py-1.5 rounded-full font-bold border ${badge[user.status] || "bg-gray-100 text-gray-700"}`}>{user.status}</span>
          {user.verified && <span className="ml-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-full font-bold"><I e="✓" /> Vérifié</span>}
          <p className="text-sm text-[#6B7280] mt-4"><I e="📍" /> {user.commune ?? "—"}</p>
        </div>
        {artisan && (
          <>
            <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Mon activité</p>
              <p className="font-bold text-[#1D4E5B]">{artisan.trade}</p>
              <p className="text-sm text-[#6B7280] mt-1"><I e="★" /> {artisan.rating || "—"} · {artisan.reviews_count} avis · {artisan.missions} missions</p>
              <Link to={`/artisan/${user.id}`} className="inline-block mt-4 text-sm text-[#F26522] font-bold hover:underline">Voir mon profil public <I e="→" /></Link>
            </div>
            <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Disponibilité</p>
              <button onClick={toggleAvailability} disabled={toggling} role="switch" aria-checked={!!artisan.available}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-colors ${artisan.available ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"}`}>
                {artisan.available ? <Rich text={"✓ Disponible"} /> : <Rich text={"✗ Occupé"} />}
              </button>
              <p className="text-xs text-[#9CA3AF] mt-3">Cliquez pour changer votre statut dans les résultats.</p>
            </div>
          </>
        )}
      </div>

      {/* SECTION DEMANDES */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-3xl text-[#1D4E5B]">{user.role === "artisan" ? "Demandes qui me concernent" : "Mes demandes de travaux"}</h2>
        {user.role === "client" && (
          <Link to="/poster-offre" className="text-sm px-4 py-2 bg-[#F26522] hover:bg-[#C84E10] text-white font-bold rounded-xl transition-colors">
            + Nouvelle demande
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-[#F4F8F9] border-2 border-[#E8F2F5] rounded-2xl p-10 text-center mb-12">
          <p className="text-[#6B7280] mb-4">Aucune demande pour le moment.</p>
          <Link to="/poster-offre" className="inline-block px-6 py-3.5 bg-[#F26522] text-white rounded-xl font-bold hover:bg-[#C84E10] transition-colors"><I e="📋" /> Poster une offre</Link>
        </div>
      ) : (
        <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl overflow-hidden divide-y divide-[#E8F2F5] mb-12 shadow-sm">
          {requests.map((r) => {
            const linkedPayment = payments.find((p) => p.request_id === r.id);
            const isDepositPaid = r.status === "Acompte versé" || !!linkedPayment;

            return (
              <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap hover:bg-[#FAFDFD] transition-colors">
                <div>
                  <p className="font-bold text-[#1D4E5B] text-base">{r.title}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{r.category} · <I e="📍" /> {r.commune} · {fmtDate(r.date)}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {r.amount != null && <span className="text-sm font-bold text-[#F26522]">{fmtFcfa(r.amount)}</span>}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${badge[r.status] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                    {r.status}
                  </span>

                  {/* Actions de paiement & reçu */}
                  {user.role === "client" && !isDepositPaid && (
                    <button
                      type="button"
                      onClick={() => openPaymentForRequest(r)}
                      className="px-3.5 py-1.5 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>💳 Verser l'acompte</span>
                    </button>
                  )}

                  {isDepositPaid && linkedPayment && (
                    <button
                      type="button"
                      onClick={() => openReceiptModal(linkedPayment.reference)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <span>🧾 Voir le reçu</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION PAIEMENTS & SÉQUESTRE MOBILE MONEY */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold text-[#1D4E5B] flex items-center gap-2">
              <span>Séquestre & Transactions Mobile Money</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                Wave · Orange · MTN
              </span>
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Historique des acomptes sécurisés par Proximo CI pour protéger vos chantiers.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="bg-[#F4F8F9] border-2 border-dashed border-[#D1D9DC] rounded-2xl p-8 text-center text-sm text-[#6B7280]">
            <p className="mb-1 font-semibold text-[#1D4E5B]">Aucun paiement d'acompte enregistré</p>
            <p className="text-xs text-[#9CA3AF]">
              Dès qu'un acompte est versé sur une demande par Wave, Orange Money ou MTN, il apparaît ici avec son reçu officiel téléchargeable.
            </p>
          </div>
        ) : (
          <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F4F8F9] text-xs font-bold uppercase tracking-wider text-[#9CA3AF] border-b border-[#E8F2F5]">
                  <tr>
                    <th className="px-6 py-3.5">Référence & Date</th>
                    <th className="px-6 py-3.5">Opérateur</th>
                    <th className="px-6 py-3.5">Demande</th>
                    <th className="px-6 py-3.5 text-right">Montant</th>
                    <th className="px-6 py-3.5 text-center">Statut</th>
                    <th className="px-6 py-3.5 text-right">Reçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F2F5]">
                  {payments.map((p) => {
                    const op = opBadges[p.operator] || { label: p.operator, icon: "📱", cls: "bg-gray-100 text-gray-700" };
                    return (
                      <tr key={p.id} className="hover:bg-[#FAFDFD] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-mono font-bold text-[#1D4E5B] text-xs">{p.reference}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{fmtDate(p.created_at, true)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${op.cls}`}>
                            <span>{op.icon}</span>
                            <span>{op.label}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[#1D4E5B] font-semibold text-xs truncate max-w-xs">{p.request_title || `Demande #${p.request_id}`}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{p.customer_name || "Client"}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[#1D4E5B]">
                          {fmtFcfa(p.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                            ✓ En séquestre
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openReceiptModal(p.reference)}
                            className="px-3 py-1 bg-[#1D4E5B] hover:bg-[#2B6D7F] text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Reçu
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE PAIEMENT & REÇU */}
      <PaymentModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        request={payTarget}
        defaultPhone={user.phone}
        defaultName={`${user.firstName} ${user.lastName}`}
        receiptReference={activeReceiptRef}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
