import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import {
  api,
  ApiError,
  userToken,
  formatPhone,
  fmtDate,
  fmtFcfa,
  METIERS,
  type PublicUser,
  type PaymentRecord,
  type PaymentReceipt,
} from "../lib/api";
import { I, Rich } from "../components/Icon";
import PaymentModal, { type PaymentTargetRequest } from "../components/PaymentModal";
import CommuneSelect from "../components/CommuneSelect";

interface Me {
  user: PublicUser;
  artisan: {
    trade: string;
    price: string | null;
    available: number;
    rating: number;
    reviews_count: number;
    missions: number;
    years_experience: number | null;
    bio: string | null;
    img?: string | null;
    specialties?: string[];
    zones?: string[];
    diplome?: string | null;
    ecole?: string | null;
    certification?: string | null;
  } | null;
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

  // Modal édition de profil
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editCommune, setEditCommune] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTrade, setEditTrade] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editYears, setEditYears] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editDiplome, setEditDiplome] = useState("");
  const [editCertification, setEditCertification] = useState("");
  const [editImg, setEditImg] = useState("");

  // Payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PaymentTargetRequest | null>(null);
  const [activeReceiptRef, setActiveReceiptRef] = useState<string | null>(null);

  useEffect(() => { if (!hasToken) navigate("/connexion", { replace: true }); }, [hasToken, navigate]);
  useEffect(() => { if (error?.status === 401) { userToken.clear(); navigate("/connexion", { replace: true }); } }, [error, navigate]);

  if (!hasToken || loading) return <Spinner />;
  if (error || !data) return <div className="max-w-xl mx-auto px-6 py-20"><ErrorBox message={error?.message ?? "Erreur de chargement."} /></div>;

  const { user, artisan, requests, payments = [] } = data;

  function openEditProfile() {
    setProfileError("");
    setProfileSuccess("");
    setEditFirstName(user.firstName || "");
    setEditLastName(user.lastName || "");
    setEditCommune(user.commune || "");
    setEditEmail(user.email || "");
    if (artisan) {
      setEditTrade(artisan.trade || "");
      setEditPrice(artisan.price || "");
      setEditYears(artisan.years_experience != null ? String(artisan.years_experience) : "");
      setEditBio(artisan.bio || "");
      setEditDiplome(artisan.diplome || "");
      setEditCertification(artisan.certification || "");
      setEditImg(artisan.img || "");
    }
    setEditModalOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 500;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setEditImg(compressed);
          if (!editModalOpen) {
            openEditProfile();
            setEditImg(compressed);
          }
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const payload: Record<string, unknown> = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        commune: editCommune.trim(),
        email: editEmail.trim() || null,
      };
      if (user.role === "artisan") {
        payload.trade = editTrade.trim();
        payload.price = editPrice.trim();
        payload.years_experience = editYears ? Number(editYears) : null;
        payload.bio = editBio.trim() || null;
        payload.diplome = editDiplome.trim() || null;
        payload.certification = editCertification.trim() || null;
        payload.img = editImg.trim() || null;
      }
      const res = await api.patch<{ user: PublicUser; artisan: any }>("/me/profile", payload, "user");
      setData({
        ...data!,
        user: res.user,
        artisan: res.artisan ? { ...data!.artisan, ...res.artisan } : data!.artisan,
      });
      setProfileSuccess("Profil mis à jour avec succès !");
      setTimeout(() => {
        setEditModalOpen(false);
        setProfileSuccess("");
      }, 1400);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Erreur lors de la mise à jour.");
    } finally {
      setSavingProfile(false);
    }
  }

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

  const userInitials = `${user.firstName[0] || ""}${user.lastName[0] || ""}`.toUpperCase() || "PRO";

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Profil Header & Photo */}
      <div className="bg-white border-2 border-[#E8F2F5] rounded-3xl p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar & Photo Picker */}
            <div className="relative group shrink-0">
              {artisan?.img ? (
                <img
                  src={artisan.img}
                  alt={`Photo de profil de ${user.firstName}`}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-[#1D4E5B]/20 shadow-md bg-[#F4F8F9]"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1D4E5B] to-[#2B6D7F] text-white flex items-center justify-center text-3xl font-black shadow-md border-2 border-[#1D4E5B]/20">
                  {userInitials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 bg-[#F26522] hover:bg-[#C84E10] text-white p-2.5 rounded-xl shadow-md transition-transform hover:scale-110 cursor-pointer"
                title="Changer la photo de profil"
                aria-label="Changer la photo de profil"
              >
                <I e="📷" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Infos identité */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1D4E5B]">
                  {user.firstName} {user.lastName}
                </h1>
                <span className={`text-xs px-3 py-1 rounded-full font-bold border ${badge[user.status] || "bg-gray-100 text-gray-700"}`}>
                  {user.status}
                </span>
                {user.verified && (
                  <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                    <I e="✓" /> Vérifié
                  </span>
                )}
              </div>
              <p className="text-sm text-[#6B7280] mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#1D4E5B]">
                  {user.role === "artisan" ? (artisan?.trade || "Artisan Proximo CI") : "Client Proximo CI"}
                </span>
                <span>•</span>
                <span><I e="📍" /> {user.commune || "Commune non spécifiée"}</span>
                <span>•</span>
                <span><I e="📱" /> {formatPhone(user.phone)}</span>
              </p>
              {artisan?.bio && (
                <p className="text-xs text-[#4B5563] mt-2 line-clamp-2 max-w-xl italic">
                  « {artisan.bio} »
                </p>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
            <button
              type="button"
              onClick={openEditProfile}
              className="flex-1 md:flex-none px-5 py-3 rounded-xl bg-[#1D4E5B] hover:bg-[#163A43] text-white font-bold text-sm transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <I e="✏️" /> Modifier mon profil
            </button>
            {artisan && (
              <Link
                to={`/artisan/${user.id}`}
                className="flex-1 md:flex-none px-5 py-3 rounded-xl border-2 border-[#F26522] text-[#F26522] hover:bg-[#FFF2EB] font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <I e="👁️" /> Profil public
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="px-4 py-3 rounded-xl border-2 border-[#D1D9DC] text-[#6B7280] hover:bg-[#F4F8F9] font-bold text-sm transition-colors cursor-pointer"
              title="Se déconnecter"
            >
              <I e="🚪" />
            </button>
          </div>
        </div>
      </div>

      {user.status === "En attente" && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-6 py-4 mb-8 text-sm text-amber-800">
          <I e="⏳" /> <strong>Votre compte est en cours de validation</strong> par notre équipe (sous 48h). Votre profil sera visible dans la recherche dès son approbation.
        </div>
      )}
      {user.status === "Suspendu" && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-6 py-4 mb-8 text-sm text-red-700">
          <I e="🚫" /> Votre compte est suspendu. <Link to="/contact" className="font-bold underline">Contactez le support</Link>.
        </div>
      )}

      {/* Cartes d'activité et disponibilité */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Statut du compte</p>
          <span className={`text-sm px-3 py-1.5 rounded-full font-bold border ${badge[user.status] || "bg-gray-100 text-gray-700"}`}>
            {user.status}
          </span>
          {user.verified && (
            <span className="ml-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-full font-bold">
              <I e="✓" /> Vérifié
            </span>
          )}
          <p className="text-sm text-[#6B7280] mt-4"><I e="📍" /> {user.commune ?? "—"}</p>
        </div>

        {artisan && (
          <>
            <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Mon activité</p>
              <p className="font-bold text-[#1D4E5B]">{artisan.trade}</p>
              <p className="text-sm text-[#6B7280] mt-1">
                <I e="★" /> {artisan.rating || "—"} · {artisan.reviews_count} avis · {artisan.missions} missions
              </p>
              <p className="text-xs text-[#F26522] font-semibold mt-2">
                Tarif : {artisan.price || "Sur devis"}
              </p>
            </div>
            <div className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6">
              <p className="text-xs font-black uppercase tracking-widest text-[#9CA3AF] mb-3">Disponibilité</p>
              <button
                onClick={toggleAvailability}
                disabled={toggling}
                role="switch"
                aria-checked={!!artisan.available}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer ${
                  artisan.available
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                }`}
              >
                {artisan.available ? <Rich text={"✓ Disponible"} /> : <Rich text={"✗ Occupé"} />}
              </button>
              <p className="text-xs text-[#9CA3AF] mt-3">Cliquez pour changer votre statut dans les résultats.</p>
            </div>
          </>
        )}
      </div>

      {/* SECTION DEMANDES */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-3xl text-[#1D4E5B]">
          {user.role === "artisan" ? "Demandes qui me concernent" : "Mes demandes de travaux"}
        </h2>
        {user.role === "client" && (
          <Link
            to="/poster-offre"
            className="text-sm px-4 py-2 bg-[#F26522] hover:bg-[#C84E10] text-white font-bold rounded-xl transition-colors"
          >
            + Nouvelle demande
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-[#F4F8F9] border-2 border-[#E8F2F5] rounded-2xl p-10 text-center mb-12">
          <p className="text-[#6B7280] mb-4">Aucune demande pour le moment.</p>
          <Link
            to="/poster-offre"
            className="inline-block px-6 py-3.5 bg-[#F26522] text-white rounded-xl font-bold hover:bg-[#C84E10] transition-colors"
          >
            <I e="📋" /> Poster une offre
          </Link>
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
                      className="px-3.5 py-1.5 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>💳 Verser l'acompte</span>
                    </button>
                  )}

                  {isDepositPaid && linkedPayment && (
                    <button
                      type="button"
                      onClick={() => openReceiptModal(linkedPayment.reference)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
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
                            className="px-3 py-1 bg-[#1D4E5B] hover:bg-[#2B6D7F] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
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

      {/* MODAL ÉDITION DU PROFIL & PHOTO */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border-2 border-[#1D4E5B]/20 shadow-2xl my-8 relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#E8F2F5] mb-6">
              <h2 className="text-2xl font-bold text-[#1D4E5B] flex items-center gap-2">
                <I e="✏️" /> Modifier mon profil
              </h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#1D4E5B] p-2 text-xl font-bold rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {profileSuccess && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 animate-in fade-in">
                <I e="✅" /> {profileSuccess}
              </div>
            )}

            {profileError && <div className="mb-4"><ErrorBox message={profileError} /></div>}

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              {/* Photo de profil */}
              <div className="p-4 bg-[#F4F8F9] rounded-2xl border border-[#E8F2F5] flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  {editImg ? (
                    <img
                      src={editImg}
                      alt="Aperçu photo"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-[#1D4E5B]/20 shadow-sm bg-white"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1D4E5B] to-[#2B6D7F] text-white flex items-center justify-center text-2xl font-black">
                      {userInitials}
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm font-bold text-[#1D4E5B] mb-1">Photo de profil / vitrine</p>
                  <p className="text-xs text-[#6B7280] mb-3">Une photo professionnelle claire augmente les demandes de devis de +70%.</p>
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-[#F26522] hover:bg-[#C84E10] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <I e="📷" /> Choisir une photo
                    </button>
                    {editImg && (
                      <button
                        type="button"
                        onClick={() => setEditImg("")}
                        className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Retirer la photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Identité */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="editFirstName" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Prénom *</label>
                  <input
                    id="editFirstName"
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="editLastName" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">Nom *</label>
                  <input
                    id="editLastName"
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Commune & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                    <I e="📍" /> Commune *
                  </label>
                  <CommuneSelect
                    variant="form"
                    value={editCommune}
                    onChange={setEditCommune}
                    placeholder="Sélectionnez votre commune..."
                  />
                </div>
                <div>
                  <label htmlFor="editEmail" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                    <I e="✉️" /> Adresse email (optionnel)
                  </label>
                  <input
                    id="editEmail"
                    type="email"
                    placeholder="Ex: contact@artisan.ci"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Champs réservés à l'artisan */}
              {user.role === "artisan" && (
                <>
                  <hr className="border-[#E8F2F5] my-1" />
                  <p className="text-xs font-black uppercase tracking-widest text-[#F26522]">Vitrine Professionnelle</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="editTrade" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🛠️" /> Métier principal *
                      </label>
                      <select
                        id="editTrade"
                        value={editTrade}
                        onChange={(e) => setEditTrade(e.target.value)}
                        className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white font-semibold text-[#1D4E5B]"
                      >
                        <option value="">Sélectionnez un métier...</option>
                        {METIERS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="editPrice" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="💰" /> Tarif indicatif
                      </label>
                      <input
                        id="editPrice"
                        type="text"
                        placeholder="Ex : 15 000 FCFA/jour ou Sur devis"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="editYears" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="⏱️" /> Années d'expérience
                      </label>
                      <input
                        id="editYears"
                        type="number"
                        min="0"
                        max="50"
                        placeholder="Ex : 5"
                        value={editYears}
                        onChange={(e) => setEditYears(e.target.value)}
                        className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="editDiplome" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                        <I e="🎓" /> Diplôme ou certificat
                      </label>
                      <input
                        id="editDiplome"
                        type="text"
                        placeholder="Ex : CAP Électricité, Certificat FDFP..."
                        value={editDiplome}
                        onChange={(e) => setEditDiplome(e.target.value)}
                        className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="editBio" className="block text-xs font-bold text-[#1D4E5B] mb-1.5">
                      <I e="📝" /> Présentation de votre savoir-faire & engagements
                    </label>
                    <textarea
                      id="editBio"
                      rows={3}
                      maxLength={1000}
                      placeholder="Décrivez vos compétences, votre rapidité d'intervention et la qualité de vos finitions..."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full border-2 border-[#D1D9DC] focus:border-[#1D4E5B] rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E8F2F5]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#D1D9DC] text-[#6B7280] font-semibold text-sm hover:bg-[#F4F8F9] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 rounded-xl bg-[#F26522] hover:bg-[#C84E10] text-white font-bold text-sm transition-colors shadow-xs disabled:opacity-60 cursor-pointer flex items-center gap-2"
                >
                  {savingProfile ? "Enregistrement..." : <Rich text={"✓ Enregistrer les modifications"} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
