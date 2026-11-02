import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router";
import Logo from "../components/Logo";
import { Spinner } from "../components/ui";
import { api, ApiError, adminToken, fmtDate, fmtFcfa } from "../lib/api";
import { adminLogout, can, type AdminSession, type AdminRole, type AuditEntry } from "../lib/admin";
import { MetaVerifiedBadge, VerifiedPill } from "../components/Badges";
import {
  RiDashboard3Fill,
  RiTeamFill,
  RiFileList3Fill,
  RiBriefcase4Fill,
  RiBarChartBoxFill,
  RiShieldKeyholeFill,
  RiWallet3Fill,
  RiToolsFill,
  RiUserFollowFill,
  RiTimeFill,
  RiMegaphoneFill,
  RiSearch2Line,
  RiEyeFill,
  RiForbid2Fill,
  RiCheckDoubleFill,
  RiLogoutBoxRFill,
  RiExternalLinkLine,
  RiCloseLine,
  RiAlertFill,
  RiCheckLine,
  RiMapPin2Fill,
  RiCalendar2Fill,
  RiSmartphoneFill,
  RiMailFill,
  RiTrophyFill,
  RiSparkling2Fill,
  RiRefreshLine,
  RiShieldCheckFill,
  RiInformationFill,
  RiAlarmWarningFill,
  RiArrowRightLine,
  RiUser3Fill,
  RiCheckboxCircleFill,
  RiLock2Fill,
  RiContactsBook2Fill,
  RiCustomerService2Fill,
  RiHistoryFill,
  RiWhatsappFill,
  RiPhoneFill,
  RiChat1Fill,
  RiFilter2Fill,
  RiExchangeDollarFill,
  RiMoneyDollarCircleFill,
  RiSunLine,
  RiMoonLine,
  RiNotification3Line,
  RiQuestionLine,
  RiBankCardFill,
  RiArrowLeftRightLine,
  RiMoreFill,
  RiAddLine,
  RiArrowRightUpLine,
  RiArrowLeftDownLine,
} from "react-icons/ri";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Overview {
  kpis: {
    users: number;
    usersMonth: number;
    artisans: number;
    clients: number;
    demandes: number;
    offres: number;
    revenue: number;
    pendingMessages: number;
  };
  byCommune: { commune: string; count: number }[];
  byMetier: { metier: string; count: number; pct: number }[];
  activity: { type: string; event: string; detail: string; at: string }[];
}

interface Stats {
  monthly: {
    ym: string;
    users: number;
    missions: number;
    completedMissions?: number;
    volumeAffaires?: number;
    commissions?: number;
    abonnements?: number;
    revenus: number;
  }[];
  total: number;
  kpis?: {
    totalRevenus: number;
    totalCommissions: number;
    totalAbonnements: number;
    totalGrossVolume: number;
    totalRequests: number;
    completedRequests: number;
    inProgressRequests: number;
    pendingRequests: number;
    conversionRate: number;
    panierMoyen: number;
    artisansCount: number;
    verifiedArtisansRate: number;
    avgArtisanRating: string;
  };
  byOperator?: { operator: string; label: string; count: number; total: number; pct: number }[];
  byTrade?: { trade: string; artisansCount: number; requestsCount: number; volume: number }[];
  byZone?: { commune: string; count: number }[];
  byPlan?: { plan: string; count: number }[];
}

interface AUser {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  type: "Artisan" | "Client";
  metier: string;
  commune: string | null;
  status: string;
  inscription: string;
  missions: number;
  phone: string;
  verified: boolean;
  email?: string | null;
  price?: string | null;
  rating?: number;
  reviews_count?: number;
  diplome?: string | null;
  certification?: string | null;
  zone_label?: string | null;
  bio?: string | null;
}

interface Demande {
  id: number;
  titre: string;
  client: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  category?: string;
  description?: string;
  budget?: string;
  urgency?: string;
  artisan: string;
  artisan_phone?: string;
  metier: string;
  commune: string;
  montant: number | null;
  status: string;
  date: string;
}

interface CrmClient {
  userId: number | null;
  phone: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  commune: string;
  isRegistered: boolean;
  userStatus: string;
  contactStatus: "À contacter" | "Contacté" | "En discussion" | "Converti";
  contactNotes: string | null;
  lastContactedAt: string | null;
  firstSeen: string;
  lastActivity: string;
  demandesCount: number;
  demandes: { id: number; title: string; amount: number; status: string; date: string }[];
  totalRevenue: number;
  messagesCount: number;
  messages: { id: number; subject: string; message: string; handled: boolean; date: string }[];
}

interface CrmData {
  kpis: {
    totalReceived: number;
    totalContacted: number;
    contactRate: number;
    totalRevenue: number;
    avgRevenue: number;
  };
  clients: CrmClient[];
}

interface TraceAction {
  id: string;
  type: "admin" | "demande" | "paiement" | "utilisateur" | "contact";
  category: string;
  event: string;
  actor: string;
  target: string;
  details: string;
  status: string;
  amount: number | null;
  timestamp: string;
  severity: "info" | "warning" | "critical";
}

interface TraceData {
  total: number;
  actions: TraceAction[];
}

interface Offre {
  id: number;
  titre: string;
  entreprise: string;
  commune: string;
  secteur: string;
  contrat: string;
  budget: string;
  candidatures: number;
  status: string;
  date: string;
}

type Tab = "overview" | "demandes" | "clients" | "users" | "tracabilite" | "offres" | "stats" | "audit";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const INACTIVITY_MS = 15 * 60 * 1000;

function StatusBadge({ status }: { status: string }) {
  let style = "bg-slate-50 text-slate-600 border-slate-200/80";
  let dotColor = "bg-slate-400";

  switch (status) {
    case "Actif":
    case "Active":
    case "Terminé":
      style = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      dotColor = "bg-emerald-500";
      break;
    case "En attente":
      style = "bg-amber-50 text-amber-700 border-amber-200/80";
      dotColor = "bg-amber-500 animate-pulse";
      break;
    case "En cours":
    case "Acompte versé":
      style = "bg-sky-50 text-sky-700 border-sky-200/80";
      dotColor = "bg-sky-500";
      break;
    case "Suspendu":
    case "Annulé":
      style = "bg-rose-50 text-rose-700 border-rose-200/80";
      dotColor = "bg-rose-500";
      break;
    case "Clôturée":
      style = "bg-slate-100 text-slate-600 border-slate-200";
      dotColor = "bg-slate-400";
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${style} transition-all`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  if (role === "Super Admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-[#FF6B35] to-[#F26522] text-white shadow-xs">
        <RiSparkling2Fill className="w-2.5 h-2.5 text-amber-100" />
        <span>Super Admin</span>
      </span>
    );
  }
  if (role === "Modérateur") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-xs">
        <RiShieldCheckFill className="w-2.5 h-2.5 text-purple-200" />
        <span>Modérateur</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1D4E5B] text-white shadow-xs">
      <RiBarChartBoxFill className="w-2.5 h-2.5 text-teal-200" />
      <span>Analyste</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: AuditEntry["severity"] }) {
  if (severity === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span>Critique</span>
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span>Alerte</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
      <span>Info</span>
    </span>
  );
}

function AccessDenied({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-4 border border-amber-200">
        <RiLock2Fill />
      </div>
      <h3 className="text-[#0E2A31] font-extrabold text-xl mb-2">Accès restreint</h3>
      <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
        Votre rôle ne vous permet pas d'accéder à <strong>{label}</strong>. Contactez un Super Administrateur pour modifier vos privilèges.
      </p>
    </div>
  );
}

function useAdminData<T>(path: string | null, enabled: boolean, onExpired: () => void, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!path || !enabled) return;
    let off = false;
    setLoading(true);
    api.get<T>(path, "admin")
      .then((d) => { if (!off) setData(d); })
      .catch((e: ApiError) => { if (e.status === 401) onExpired(); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...deps]);
  return { data, setData, loading };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [isDark, setIsDark] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userType, setUserType] = useState<"Tous" | "Artisan" | "Client">("Tous");
  const [userStatus, setUserStatus] = useState("Tous");
  const [demandeStatus, setDemandeStatus] = useState("Tous");
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [demandeEditAmount, setDemandeEditAmount] = useState<string>("");
  const [selectedCrmClient, setSelectedCrmClient] = useState<CrmClient | null>(null);
  const [clientCrmNotes, setClientCrmNotes] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientContactFilter, setClientContactFilter] = useState("Tous");
  const [traceSearch, setTraceSearch] = useState("");
  const [traceCategoryFilter, setTraceCategoryFilter] = useState("Toutes");
  const [offreStatusFilter, setOffreStatusFilter] = useState("Toutes");
  const [idleWarning, setIdleWarning] = useState(false);
  const [actionError, setActionError] = useState("");
  const [auditVersion, setAuditVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AUser | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expired = useCallback(() => {
    adminToken.clear();
    navigate("/backoffice-login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!adminToken.get()) {
      navigate("/backoffice-login", { replace: true });
      return;
    }
    api.get<AdminSession>("/admin/me", "admin")
      .then(setSession)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          expired();
        } else {
          console.error("Erreur session admin:", err);
          setActionError("Connexion en cours ou latence réseau. Si le problème persiste, veuillez rafraîchir.");
        }
      });
  }, [navigate, expired]);

  const resetIdle = useCallback(() => {
    if (!session) return;
    setIdleWarning(false);
    clearTimeout(warnTimer.current!);
    clearTimeout(idleTimer.current!);
    warnTimer.current = setTimeout(() => setIdleWarning(true), INACTIVITY_MS - 60_000);
    idleTimer.current = setTimeout(async () => {
      try { await api.post("/admin/expire", {}, "admin"); } catch {}
      expired();
    }, INACTIVITY_MS);
  }, [session, expired]);

  useEffect(() => {
    if (!session) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      clearTimeout(warnTimer.current!);
      clearTimeout(idleTimer.current!);
    };
  }, [session, resetIdle]);

  async function keepAlive() {
    try { await api.post("/admin/ping", {}, "admin"); } catch { expired(); return; }
    resetIdle();
  }

  async function handleLogout() {
    await adminLogout();
    navigate("/backoffice-login", { replace: true });
  }

  const ok = (perm: string) => !!session && can(session, perm);
  const overview = useAdminData<Overview>("/admin/overview", ok("overview"), expired);
  const users = useAdminData<AUser[]>("/admin/users", ok("users"), expired);
  const demandes = useAdminData<Demande[]>("/admin/demandes", ok("demandes"), expired, [auditVersion]);
  const clientsData = useAdminData<CrmData>("/admin/clients", ok("clients"), expired, [auditVersion]);
  const tracabilite = useAdminData<TraceData>("/admin/tracabilite", ok("tracabilite") && tab === "tracabilite", expired, [auditVersion]);
  const offres = useAdminData<Offre[]>("/admin/offres", ok("offres"), expired, [auditVersion]);
  const stats = useAdminData<Stats>("/admin/stats", ok("stats") && tab === "stats", expired);
  const audit = useAdminData<AuditEntry[]>("/admin/audit", ok("audit") && tab === "audit", expired, [auditVersion]);

  async function updateDemandeStatus(d: Demande, status: string, customAmount?: number | null) {
    setActionError("");
    setInspectLoading(true);
    try {
      const amt = customAmount !== undefined ? customAmount : d.montant;
      await api.patch<{ id: number; status: string; amount: number | null }>(
        `/admin/demandes/${d.id}/status`,
        { status, amount: amt },
        "admin"
      );
      demandes.setData((list) =>
        list?.map((x) => (x.id === d.id ? { ...x, status, montant: amt !== undefined ? amt : x.montant } : x)) ?? list
      );
      setSelectedDemande((prev) => (prev?.id === d.id ? { ...prev, status, montant: amt !== undefined ? amt : prev.montant } : prev));
      setAuditVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Erreur lors de la mise à jour de la demande.");
    } finally {
      setInspectLoading(false);
    }
  }

  async function updateClientContact(phone: string, status: string, notes?: string) {
    setActionError("");
    setInspectLoading(true);
    try {
      await api.patch(
        `/admin/clients/${encodeURIComponent(phone)}/contact`,
        { contactStatus: status, notes },
        "admin"
      );
      clientsData.setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clients: prev.clients.map((c) =>
            c.phone === phone ? { ...c, contactStatus: status as any, contactNotes: notes ?? c.contactNotes } : c
          ),
        };
      });
      setSelectedCrmClient((prev) =>
        prev?.phone === phone ? { ...prev, contactStatus: status as any, contactNotes: notes ?? prev.contactNotes } : prev
      );
      setAuditVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Erreur lors de la mise à jour du contact client.");
    } finally {
      setInspectLoading(false);
    }
  }

  async function userAction(u: AUser, status: "Suspendu" | "Actif") {
    setActionError("");
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status }, "admin");
      users.setData((list) => list?.map((x) => (x.id === u.id ? { ...x, status } : x)) ?? list);
      if (selectedUser?.id === u.id) {
        setSelectedUser((prev) => (prev ? { ...prev, status } : prev));
      }
      setAuditVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Erreur lors de la mise à jour de l'utilisateur.");
    }
  }

  async function toggleVerifyUser(u: AUser) {
    setActionError("");
    setInspectLoading(true);
    try {
      const nextVerified = !u.verified;
      await api.patch(`/admin/users/${u.id}/verify`, { verified: nextVerified }, "admin");
      users.setData((list) =>
        list?.map((x) => (x.id === u.id ? { ...x, verified: nextVerified } : x)) ?? list
      );
      if (selectedUser?.id === u.id) {
        setSelectedUser((prev) => (prev ? { ...prev, verified: nextVerified } : prev));
      }
      setAuditVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Erreur lors de la modification de la certification.");
    } finally {
      setInspectLoading(false);
    }
  }

  async function closeOffer(o: Offre) {
    setActionError("");
    try {
      await api.patch(`/admin/offres/${o.id}/close`, {}, "admin");
      offres.setData((list) => list?.map((x) => (x.id === o.id ? { ...x, status: "Clôturée" } : x)) ?? list);
      setAuditVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Erreur lors de la clôture de l'offre.");
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#ECEEF2] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 flex flex-col items-center gap-4 text-center max-w-sm">
          <Spinner />
          <p className="text-slate-600 font-bold text-sm">Chargement de votre session exécutive...</p>
        </div>
      </div>
    );
  }

  const role = session.user.role;
  const k = overview.data?.kpis;

  const filteredUsers = (users.data ?? []).filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) &&
      (userType === "Tous" || u.type === userType) &&
      (userStatus === "Tous" || u.status === userStatus)
  );

  const filteredDemandes = (demandes.data ?? []).filter(
    (d) => demandeStatus === "Tous" || d.status === demandeStatus
  );

  const filteredClients = (clientsData.data?.clients ?? []).filter(
    (c) =>
      (clientSearch === "" ||
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone.includes(clientSearch) ||
        c.commune.toLowerCase().includes(clientSearch.toLowerCase())) &&
      (clientContactFilter === "Tous" || c.contactStatus === clientContactFilter)
  );

  const filteredTrace = (tracabilite.data?.actions ?? []).filter(
    (a) =>
      (traceSearch === "" ||
        a.actor.toLowerCase().includes(traceSearch.toLowerCase()) ||
        a.target.toLowerCase().includes(traceSearch.toLowerCase()) ||
        a.event.toLowerCase().includes(traceSearch.toLowerCase()) ||
        a.details.toLowerCase().includes(traceSearch.toLowerCase())) &&
      (traceCategoryFilter === "Toutes" || a.category === traceCategoryFilter)
  );

  const maxCommune = Math.max(1, ...(overview.data?.byCommune.map((c) => c.count) ?? [1]));
  const monthly = stats.data?.monthly ?? [];
  const maxUsers = Math.max(1, ...monthly.map((m) => m.users));
  const maxMissions = Math.max(1, ...monthly.map((m) => m.missions));

  const tabs: { key: Tab; label: string; icon: any; count?: number; perm: string }[] = [
    { key: "overview", label: "Overview", icon: RiDashboard3Fill, perm: "overview" },
    { key: "demandes", label: "Demandes", icon: RiFileList3Fill, count: demandes.data?.length, perm: "demandes" },
    { key: "clients", label: "Clients & CRM", icon: RiContactsBook2Fill, count: clientsData.data?.clients?.length, perm: "clients" },
    { key: "users", label: "Utilisateurs", icon: RiTeamFill, count: users.data?.length, perm: "users" },
    { key: "tracabilite", label: "Traçabilité", icon: RiHistoryFill, count: tracabilite.data?.actions?.length, perm: "tracabilite" },
    { key: "offres", label: "Offres", icon: RiBriefcase4Fill, count: offres.data?.length, perm: "offres" },
    { key: "stats", label: "Stats & Finance", icon: RiBarChartBoxFill, perm: "stats" },
    { key: "audit", label: "Audit", icon: RiShieldKeyholeFill, count: audit.data?.length, perm: "audit" },
  ];

  return (
    <div className="min-h-screen lg:h-screen w-full max-w-full overflow-x-hidden bg-[#ECEEF2] text-slate-800 p-1 sm:p-2.5 lg:p-4 flex flex-col font-sans antialiased touch-pan-y overscroll-x-none">
      {/* ══ ALERTE INACTIVITÉ ══ */}
      {idleWarning && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl border border-white/20 animate-in slide-in-from-top-4"
          role="alert"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <RiAlertFill className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>Votre session expire dans 1 minute en raison d'inactivité.</span>
          </div>
          <button
            onClick={keepAlive}
            className="px-3.5 py-1 bg-[#F26522] hover:bg-[#E05312] text-white rounded-full text-xs font-bold transition-all cursor-pointer"
          >
            Prolonger
          </button>
        </div>
      )}

      {/* ══ CARD CONTENEUR PRINCIPALE (STYLE FINEXY) ══ */}
      <div className="w-full max-w-[1600px] min-w-0 mx-auto bg-white rounded-2xl sm:rounded-[32px] lg:rounded-[36px] shadow-[0_20px_70px_-15px_rgba(15,23,42,0.08)] border border-slate-200/70 overflow-hidden flex flex-col lg:flex-row min-h-screen lg:min-h-0 lg:h-full lg:max-h-full">
        {/* ══ GAUCHE : RAIL LATÉRAL FLOTTANT FIXE SANS SCROLL (DESKTOP) ══ */}
        <aside className="hidden lg:flex lg:w-[76px] xl:w-20 border-r border-slate-100 flex-col items-center justify-between py-4 bg-white shrink-0 h-full max-h-full overflow-hidden select-none">
          {/* Haut : Toggle Jour / Nuit */}
          <div className="bg-slate-100 p-1 rounded-full flex flex-col gap-1 text-slate-400 shrink-0">
            <button
              onClick={() => setIsDark(false)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                !isDark ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Mode Clair"
            >
              <RiSunLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsDark(true)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                isDark ? "bg-[#0F172A] text-white shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Mode Sombre"
            >
              <RiMoonLine className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Centre : Icônes d'onglets du Rail (tous visibles sans scroll) */}
          <nav className="flex flex-col items-center gap-1.5 lg:gap-2 overflow-visible py-2 my-auto">
            {tabs.map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`w-9 h-9 lg:w-10 lg:h-10 rounded-2xl flex items-center justify-center transition-all duration-200 relative group cursor-pointer shrink-0 ${
                    active
                      ? "bg-[#0F172A] text-white shadow-md shadow-slate-900/25 scale-105"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100/80"
                  }`}
                  title={t.label}
                >
                  <Icon className="w-4.5 h-4.5 lg:w-5 lg:h-5" />
                  {t.count !== undefined && t.count > 0 && !active && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F26522]" />
                  )}
                  {/* Tooltip hover */}
                  <span className="hidden lg:group-hover:block absolute left-14 z-50 bg-[#0F172A] text-white text-[11px] font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-md pointer-events-none">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bas : Aide & Déconnexion (toujours visibles sans scroll) */}
          <div className="flex flex-col items-center gap-1.5 lg:gap-2 shrink-0">
            <Link
              to="/aide"
              target="_blank"
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-2xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all"
              title="Centre d'aide & Documentation"
            >
              <RiQuestionLine className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer"
              title="Se déconnecter"
            >
              <RiLogoutBoxRFill className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* ══ DROITE : CONTENU PRINCIPAL & HEADER EXÉCUTIF RESPONSIVE ══ */}
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full h-full max-h-full overflow-hidden bg-[#FAFAFC]">
          {/* HEADER FLOTTANT RESPONSIVE MOBILE & DESKTOP */}
          <header className="px-3 sm:px-6 lg:px-8 py-3 lg:py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/95 backdrop-blur-md shrink-0 z-20 w-full max-w-full min-w-0 overflow-hidden">
            {/* Ligne 1 : Logo + Actions Mobiles (Jour/Nuit, Profil, Logout) */}
            <div className="flex items-center justify-between w-full md:w-auto gap-3 min-w-0">
              <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-105 shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-[#F26522] flex items-center justify-center text-white font-black text-sm sm:text-base shadow-md shadow-orange-500/20">
                  P
                </div>
                <div>
                  <span className="font-extrabold text-[#0E2A31] text-sm sm:text-base tracking-tight block leading-tight">Proximo CI</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Executive Suite</span>
                </div>
              </Link>

              {/* Raccourcis uniquement visibles sur mobile (Jour/Nuit + Déconnexion) */}
              <div className="flex lg:hidden items-center gap-1.5 text-slate-400 shrink-0">
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                  title="Basculer le mode clair / sombre"
                >
                  {isDark ? <RiSunLine className="w-4 h-4 text-amber-500" /> : <RiMoonLine className="w-4 h-4 text-slate-700" />}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all cursor-pointer"
                  title="Se déconnecter"
                >
                  <RiLogoutBoxRFill className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Segmented Pill Tab Bar (Style Finexy exact avec scroll fluide horizontal sans débordement) */}
            <div className="bg-slate-100/90 p-1 rounded-full border border-slate-200/60 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto max-w-full min-w-0 shrink-0">
              {tabs.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                      active
                        ? "bg-[#0F172A] text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.count !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        active ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
                      }`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions & Profil Exécutif (Desktop & Tablette) */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-1 text-slate-400">
                <button
                  type="button"
                  onClick={() => setTab("demandes")}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  title="Rechercher"
                >
                  <RiSearch2Line className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  type="button"
                  onClick={() => setTab("tracabilite")}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors relative cursor-pointer"
                  title="Notifications & Activité"
                >
                  <RiNotification3Line className="w-4 h-4 text-slate-500" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-2 right-2 animate-pulse" />
                </button>
              </div>

              {/* Capsule Profil */}
              <div className="bg-white border border-slate-200/90 pl-1.5 pr-3.5 py-1 rounded-full flex items-center gap-2.5 shadow-2xs">
                <img
                  src={session.user.avatar}
                  alt={session.user.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-[#F26522]/30"
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-extrabold text-[#0E2A31] leading-tight">
                    {session.user.displayName}
                  </span>
                  <div className="scale-90 origin-left mt-0.5">
                    <RoleBadge role={role} />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* ══ CORPS PRINCIPAL DÉROULANT SANS DÉBORDEMENT HORIZONTAL ══ */}
          <main className="p-3 sm:p-6 lg:p-7 overflow-y-auto overflow-x-hidden space-y-6 flex-1 min-h-0 w-full max-w-full min-w-0 touch-pan-y overscroll-x-none">
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between">
                <span>{actionError}</span>
                <button onClick={() => setActionError("")} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                1. ONGLET OVERVIEW (VUE D'ENSEMBLE — STYLE FINEXY PARFAIT)
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "overview" && (
              !ok("overview") ? (
                <AccessDenied label="Vue d'ensemble" />
              ) : overview.loading && !overview.data ? (
                <Spinner />
              ) : (
                <div className="space-y-6">
                  {/* Titre & Message d'accueil */}
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-[#0E2A31] tracking-tight">
                      Bonjour, {session.user.displayName.split(" ")[0]} 👋
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                      Supervisez vos demandes en temps réel, suivez les artisans et pilotez la plateforme.
                    </p>
                  </div>

                  {/* BENTO GRID 3 COLONNES STYLE FINEXY (SÉCURISÉE MOBILE) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0">
                    {/* ── COLONNE GAUCHE (4 colonnes) : Total Balance & Wallets ── */}
                    <div className="lg:col-span-4 space-y-5 w-full max-w-full min-w-0">
                      {/* Carte 1 : Total Balance */}
                      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4 w-full max-w-full min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume d'affaires global</span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200/60 font-mono">
                            🇨🇮 FCFA
                          </span>
                        </div>
                        <div>
                          <p className="text-3xl sm:text-4xl font-black text-[#0E2A31] font-mono tracking-tight">
                            {fmtFcfa(k?.revenue ?? 0)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <RiArrowRightUpLine className="w-3.5 h-3.5" />
                              <span>8 % commission</span>
                            </span>
                            <span className="text-xs text-slate-400">sur missions terminées</span>
                          </div>
                        </div>

                        {/* Boutons d'action rapides */}
                        <div className="grid grid-cols-2 gap-2.5 pt-2">
                          <button
                            onClick={() => setTab("demandes")}
                            className="py-2.5 px-4 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                          >
                            <RiArrowLeftRightLine className="w-3.5 h-3.5" />
                            <span>Demandes ({k?.demandes ?? 0})</span>
                          </button>
                          <button
                            onClick={() => setTab("clients")}
                            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <RiAddLine className="w-3.5 h-3.5" />
                            <span>CRM Clients</span>
                          </button>
                        </div>

                        {/* Mini list wallets Mobile Money */}
                        <div className="border-t border-slate-100 pt-4 space-y-2.5">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                            Moyens de paiement & Passerelle
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                              <span className="text-[10px] font-black uppercase text-sky-600 block">Wave 🇨🇮</span>
                              <span className="text-[11px] font-bold text-[#0E2A31] mt-0.5 block">0% frais</span>
                              <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">● Actif</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                              <span className="text-[10px] font-black uppercase text-orange-600 block">Orange 🇨🇮</span>
                              <span className="text-[11px] font-bold text-[#0E2A31] mt-0.5 block">OM CI</span>
                              <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">● Actif</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-center">
                              <span className="text-[10px] font-black uppercase text-[#F26522] block">GeniusPay</span>
                              <span className="text-[11px] font-bold text-[#0E2A31] mt-0.5 block">Live API</span>
                              <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">● Vérifié</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Carte 2 : Objectif Mensuel & Barre de progression */}
                      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3 w-full max-w-full min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objectif de devis mensuel</span>
                          <span className="text-xs font-extrabold text-[#F26522] font-mono">{k?.demandes ?? 0} / 50</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-[#F26522] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, ((k?.demandes ?? 0) / 50) * 100))}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {k?.demandes ?? 0} demande(s) enregistrée(s) sur la plateforme.
                        </p>
                      </div>

                      {/* Carte 3 : My Cards / Abonnements Pro & Entreprise */}
                      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3 w-full max-w-full min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <RiBankCardFill className="w-4 h-4 text-[#1D4E5B]" />
                            Cartes & Abonnements Pro
                          </span>
                          <span className="text-[10px] font-bold text-[#F26522] bg-orange-50 px-2 py-0.5 rounded-md">Option 3</span>
                        </div>

                        {/* Cartes virtuelles graphiques (Style Finexy) */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Carte Noire Pro */}
                          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white p-3.5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between h-24">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-wider text-teal-300">Proximo Pro</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-mono">25 000 FCFA/an</p>
                              <p className="text-xs font-extrabold text-white font-mono mt-0.5">•••• 6782</p>
                            </div>
                          </div>

                          {/* Carte Orange Entreprise */}
                          <div className="bg-gradient-to-br from-[#FF6B35] to-[#F26522] text-white p-3.5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between h-24">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-wider text-white/90">Entreprise</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                            <div>
                              <p className="text-[10px] text-white/80 font-mono">50 000 FCFA/an</p>
                              <p className="text-xs font-extrabold text-white font-mono mt-0.5">•••• 4356</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── COLONNE CENTRALE & DROITE (8 colonnes) : 4 KPI Bento + Chart + Recent Table ── */}
                    <div className="lg:col-span-8 space-y-6 w-full max-w-full min-w-0">
                      {/* Top Row : 2x2 Bento KPI Grid + Chart */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full max-w-full min-w-0">
                        {/* KPI 1 : Total Earnings (Orange vibrant comme sur la maquette Finexy) */}
                        <div className="bg-gradient-to-br from-[#FF6B35] via-[#F26522] to-[#E05312] text-white p-5 rounded-3xl shadow-lg shadow-orange-500/15 flex flex-col justify-between h-32 sm:h-36 relative overflow-hidden group hover:scale-[1.02] transition-transform w-full max-w-full min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-white/90">Total Commissions</span>
                            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
                              <RiWallet3Fill className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <p className="text-2xl font-black font-mono tracking-tight">{fmtFcfa(k?.revenue ?? 0)}</p>
                            <span className="text-[11px] text-white/80 font-semibold mt-1 block">8% sur missions terminées</span>
                          </div>
                        </div>

                        {/* KPI 2 : Artisans Actifs */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 hover:scale-[1.02] transition-transform w-full max-w-full min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Artisans Actifs</span>
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                              <RiToolsFill className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-[#0E2A31] font-mono tracking-tight">{k?.artisans ?? 0}</p>
                            <span className="text-[11px] text-emerald-600 font-bold mt-1 block">Validés & visibles</span>
                          </div>
                        </div>

                        {/* KPI 3 : Clients Partenaires */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 hover:scale-[1.02] transition-transform w-full max-w-full min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Clients Reçus</span>
                            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                              <RiUserFollowFill className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-[#0E2A31] font-mono tracking-tight">{clientsData.data?.kpis.totalReceived ?? k?.clients ?? 0}</p>
                            <span className="text-[11px] text-teal-600 font-bold mt-1 block">Inscrits & demandes</span>
                          </div>
                        </div>

                        {/* KPI 4 : Demandes de devis */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 hover:scale-[1.02] transition-transform w-full max-w-full min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Demandes de devis</span>
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                              <RiFileList3Fill className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-[#0E2A31] font-mono tracking-tight">{k?.demandes ?? 0}</p>
                            <span className="text-[11px] text-purple-600 font-bold mt-1 block">En cours & en attente</span>
                          </div>
                        </div>
                      </div>

                      {/* Carte Graphique Dual-tone (Style Finexy Income Chart responsive) */}
                      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs w-full max-w-full min-w-0 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-[#0E2A31] tracking-tight">Activité & Croissance Mensuelle</h3>
                            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Suivi des missions et inscriptions reçues</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-slate-700 text-[11px] sm:text-xs">
                              <span className="w-2.5 h-2.5 rounded-md bg-[#0F172A]" /> Inscriptions
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-700 text-[11px] sm:text-xs">
                              <span className="w-2.5 h-2.5 rounded-md bg-[#F26522]" /> Demandes
                            </span>
                          </div>
                        </div>

                        {/* Barres verticales dual-tone avec défilement interne sécurisé */}
                        <div className="w-full max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0">
                          <div className="flex items-end justify-between gap-1 sm:gap-2.5 lg:gap-4 h-40 sm:h-44 pt-4 border-b border-slate-100 pb-3 min-w-[310px]">
                            {["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov"].map((m, idx) => {
                              const isCurrent = m === "Nov";
                              const barH1 = isCurrent ? 80 : Math.max(20, (idx * 17) % 75);
                              const barH2 = isCurrent ? 55 : Math.max(15, (idx * 23) % 65);
                              return (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
                                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1.5 h-28 sm:h-32">
                                    <div
                                      className="w-1.5 sm:w-3.5 bg-[#0F172A] rounded-t-sm sm:rounded-t-md transition-all duration-300 hover:opacity-80"
                                      style={{ height: `${barH1}%` }}
                                      title={`${m}: Utilisateurs`}
                                    />
                                    <div
                                      className="w-1.5 sm:w-3.5 bg-gradient-to-t from-[#E05312] to-[#F26522] rounded-t-sm sm:rounded-t-md transition-all duration-300 hover:opacity-80"
                                      style={{ height: `${barH2}%` }}
                                      title={`${m}: Demandes`}
                                    />
                                  </div>
                                  <span className={`text-[9px] sm:text-[11px] font-bold ${isCurrent ? "text-[#F26522]" : "text-slate-400"}`}>
                                    {m}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* ── TABLE / CARTES : RECENT ACTIVITIES (ADAPTÉ SMARTPHONE & DESKTOP) ── */}
                      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full min-w-0">
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-[#0E2A31] tracking-tight">Recent Activities</h3>
                            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Dernières demandes reçues sur la plateforme</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setTab("demandes")}
                              className="text-xs font-bold text-[#F26522] hover:text-[#E05312] transition-colors"
                            >
                              Voir tout →
                            </button>
                          </div>
                        </div>

                        {/* Vue Mobile : Cartes compactes pour smartphone */}
                        <div className="block sm:hidden divide-y divide-slate-100">
                          {(demandes.data ?? []).slice(0, 5).map((d) => (
                            <div
                              key={d.id}
                              onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                              className="p-3.5 space-y-2 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono font-bold text-slate-400">#{String(d.id).padStart(3, "0")}</span>
                                <StatusBadge status={d.status} />
                              </div>
                              <div>
                                <p className="font-extrabold text-[#0E2A31] text-xs leading-snug">{d.titre}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{d.client} · {d.commune} · {fmtDate(d.date)}</p>
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span className="font-mono font-black text-xs text-[#F26522]">{fmtFcfa(d.montant)}</span>
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  {d.status === "En attente" && can(session, "action:demandes") && (
                                    <button
                                      onClick={() => void updateDemandeStatus(d, "En cours")}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer"
                                    >
                                      Accepter
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
                                    title="Détails"
                                  >
                                    <RiMoreFill className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(demandes.data ?? []).length === 0 && (
                            <div className="p-6 text-center text-slate-400 text-xs">
                              Aucune demande de devis pour le moment.
                            </div>
                          )}
                        </div>

                        {/* Vue Tablette & Desktop : Tableau avec scroll horizontal confiné */}
                        <div className="hidden sm:block overflow-x-auto w-full max-w-full min-w-0">
                          <table className="w-full min-w-[700px] text-left">
                            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              <tr>
                                <th className="px-5 py-3.5 w-10">
                                  <input type="checkbox" className="rounded-md border-slate-300 text-[#0F172A] focus:ring-0" readOnly />
                                </th>
                                <th className="px-3 py-3.5">ID</th>
                                <th className="px-4 py-3.5">Activité & Client</th>
                                <th className="px-4 py-3.5">Montant</th>
                                <th className="px-4 py-3.5">Statut</th>
                                <th className="px-4 py-3.5">Date</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {(demandes.data ?? []).slice(0, 5).map((d) => (
                                <tr
                                  key={d.id}
                                  onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                >
                                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" className="rounded-md border-slate-300 text-[#0F172A] focus:ring-0" />
                                  </td>
                                  <td className="px-3 py-3.5 font-mono font-bold text-slate-400">
                                    #{String(d.id).padStart(3, "0")}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F26522] flex items-center justify-center shrink-0">
                                        <RiFileList3Fill className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="font-extrabold text-[#0E2A31] group-hover:text-[#F26522] transition-colors">{d.titre}</p>
                                        <p className="text-[11px] text-slate-400">{d.client} · {d.commune}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 font-mono font-bold text-[#F26522]">
                                    {fmtFcfa(d.montant)}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <StatusBadge status={d.status} />
                                  </td>
                                  <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                                    {fmtDate(d.date)}
                                  </td>
                                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1.5">
                                      {d.status === "En attente" && (
                                        <button
                                          onClick={() => void updateDemandeStatus(d, "En cours")}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                        >
                                          Accepter
                                        </button>
                                      )}
                                      <button
                                        onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                                        title="Détails"
                                      >
                                        <RiMoreFill className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {(demandes.data ?? []).length === 0 && (
                                <tr>
                                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-xs">
                                    Aucune demande de devis pour le moment.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                2. ONGLET DEMANDES (INTERACTIF & ACTIONNABLE)
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "demandes" && (
              !ok("demandes") ? (
                <AccessDenied label="Suivi des demandes" />
              ) : (
                <div className="space-y-6">
                  {/* Entête de section */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-[#0E2A31] tracking-tight">Suivi des demandes de devis</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Cliquez sur une ligne pour inspecter ou utilisez les boutons d'action rapide</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap bg-slate-100 p-1 rounded-full border border-slate-200/60">
                      {["Tous", "En cours", "Terminé", "En attente", "Annulé"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setDemandeStatus(s)}
                          className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            demandeStatus === s ? "bg-[#0F172A] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {demandes.loading && !demandes.data ? (
                    <Spinner />
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full min-w-0">
                      {/* Vue Smartphone : Cartes de demande empilées */}
                      <div className="block md:hidden divide-y divide-slate-100">
                        {filteredDemandes.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                            className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-xs text-slate-400">#{String(d.id).padStart(3, "0")}</span>
                              <StatusBadge status={d.status} />
                            </div>
                            <div>
                              <p className="font-extrabold text-[#0E2A31] text-sm leading-snug">{d.titre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{d.client} · {d.commune}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">Artisan : {d.artisan} ({d.metier})</p>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span className="font-mono font-black text-sm text-[#F26522]">{fmtFcfa(d.montant)}</span>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {d.status === "En attente" && can(session, "action:demandes") && (
                                  <button
                                    onClick={() => void updateDemandeStatus(d, "En cours")}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <RiCheckLine className="w-3.5 h-3.5" />
                                    <span>Accepter</span>
                                  </button>
                                )}
                                {d.status === "En cours" && can(session, "action:demandes") && (
                                  <button
                                    onClick={() => void updateDemandeStatus(d, "Terminé")}
                                    className="px-2.5 py-1.5 bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <RiCheckDoubleFill className="w-3.5 h-3.5" />
                                    <span>Terminer</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#0F172A] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Détails
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredDemandes.length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-xs">
                            Aucune demande trouvée avec ces critères.
                          </div>
                        )}
                      </div>

                      {/* Vue Tablette & Desktop : Tableau avec scroll horizontal confiné */}
                      <div className="hidden md:block overflow-x-auto w-full max-w-full min-w-0">
                        <table className="w-full min-w-[900px] text-left">
                          <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="px-5 py-4"># ID</th>
                              <th className="px-5 py-4">Mission demandée</th>
                              <th className="px-4 py-4">Client</th>
                              <th className="px-4 py-4">Artisan associé</th>
                              <th className="px-4 py-4">Commune</th>
                              <th className="px-4 py-4">Montant</th>
                              <th className="px-4 py-4">Statut</th>
                              <th className="px-4 py-4 text-center">Date</th>
                              <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredDemandes.map((d) => (
                              <tr
                                key={d.id}
                                onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                              >
                                <td className="px-5 py-4 font-mono font-bold text-slate-400">
                                  #{String(d.id).padStart(3, "0")}
                                </td>
                                <td className="px-5 py-4">
                                  <p className="font-extrabold text-[#0E2A31] text-sm group-hover:text-[#F26522] transition-colors">{d.titre}</p>
                                  <p className="text-[11px] text-slate-400">{d.category || d.metier}</p>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="font-bold text-slate-800">{d.client}</p>
                                  {d.phone && <p className="text-[11px] font-mono text-slate-400">+{d.phone}</p>}
                                </td>
                                <td className="px-4 py-4">
                                  <p className="font-bold text-slate-800">{d.artisan}</p>
                                  <p className="text-[11px] text-slate-400">{d.metier}</p>
                                </td>
                                <td className="px-4 py-4 font-medium text-slate-600">
                                  <span className="flex items-center gap-1">
                                    <RiMapPin2Fill className="w-3.5 h-3.5 text-[#F26522]" />
                                    <span>{d.commune}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-4 font-mono font-black text-[#F26522]">
                                  {fmtFcfa(d.montant)}
                                </td>
                                <td className="px-4 py-4"><StatusBadge status={d.status} /></td>
                                <td className="px-4 py-4 text-center text-slate-400 whitespace-nowrap">
                                  {fmtDate(d.date)}
                                </td>
                                <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1.5">
                                    {d.status === "En attente" && can(session, "action:demandes") && (
                                      <button
                                        onClick={() => void updateDemandeStatus(d, "En cours")}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                      >
                                        <RiCheckLine className="w-3.5 h-3.5" />
                                        <span>Accepter</span>
                                      </button>
                                    )}
                                    {d.status === "En cours" && can(session, "action:demandes") && (
                                      <button
                                        onClick={() => void updateDemandeStatus(d, "Terminé")}
                                        className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                      >
                                        <RiCheckDoubleFill className="w-3.5 h-3.5" />
                                        <span>Terminer</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { setSelectedDemande(d); setDemandeEditAmount(d.montant ? String(d.montant) : ""); }}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#0F172A] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Détails
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filteredDemandes.length === 0 && (
                              <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-xs">
                                  Aucune demande trouvée avec ces critères.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                3. ONGLET CLIENTS & CRM
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "clients" && (
              !ok("clients") ? (
                <AccessDenied label="Clients & CRM" />
              ) : !clientsData.data ? (
                <Spinner />
              ) : (
                <div className="space-y-6">
                  {/* 4 KPIs CRM */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Clients reçus</span>
                      <p className="text-3xl font-black text-[#0E2A31] font-mono mt-2">{clientsData.data.kpis.totalReceived}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">Inscrits & demandes reçues</span>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Clients contactés</span>
                      <p className="text-3xl font-black text-emerald-600 font-mono mt-2">{clientsData.data.kpis.totalContacted}</p>
                      <span className="text-[11px] text-emerald-600/80 font-bold mt-1 block">{clientsData.data.kpis.contactRate}% de conversion</span>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Chiffre d'affaires global</span>
                      <p className="text-2xl font-black text-[#F26522] font-mono mt-2">{fmtFcfa(clientsData.data.kpis.totalRevenue)}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">Volume total des devis</span>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Panier moyen / Client</span>
                      <p className="text-2xl font-black text-purple-700 font-mono mt-2">{fmtFcfa(clientsData.data.kpis.avgRevenue)}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">Moyenne par client actif</span>
                    </div>
                  </div>

                  {/* Filtres & Recherche CRM */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap gap-4 items-center justify-between">
                    <div className="relative flex-1 min-w-[260px]">
                      <RiSearch2Line className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Rechercher un client..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[#F26522]"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap bg-slate-100 p-1 rounded-full border border-slate-200/60">
                      {["Tous", "À contacter", "Contacté", "En discussion", "Converti"].map((st) => (
                        <button
                          key={st}
                          onClick={() => setClientContactFilter(st)}
                          className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            clientContactFilter === st ? "bg-[#0F172A] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tableau CRM */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full min-w-0">
                    <div className="overflow-x-auto w-full max-w-full min-w-0">
                      <table className="w-full min-w-[900px] text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-5 py-4">Client</th>
                            <th className="px-4 py-4">Téléphone & WhatsApp</th>
                            <th className="px-4 py-4">Commune</th>
                            <th className="px-4 py-4 text-center">Demandes</th>
                            <th className="px-4 py-4">Chiffre d'affaires</th>
                            <th className="px-4 py-4">Statut contact</th>
                            <th className="px-4 py-4">Dernière activité</th>
                            <th className="px-5 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredClients.map((c) => {
                            const cleanPhone = c.phone.replace(/\D/g, "");
                            const waNumber = cleanPhone.startsWith("225") ? cleanPhone : `225${cleanPhone}`;
                            return (
                              <tr
                                key={c.phone}
                                onClick={() => { setSelectedCrmClient(c); setClientCrmNotes(c.contactNotes || ""); }}
                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                              >
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-[#0E2A31] text-white font-black text-xs flex items-center justify-center shrink-0">
                                      {c.name ? c.name[0] : "C"}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-[#0E2A31] group-hover:text-[#F26522] transition-colors">{c.name}</p>
                                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                        c.isRegistered ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"
                                      }`}>
                                        {c.isRegistered ? "Inscrit" : "Prospect"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <span className="font-mono font-semibold">+{c.phone}</span>
                                    <a
                                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Bonjour ${c.name}, je suis votre conseiller Proximo CI.`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
                                      title="WhatsApp"
                                    >
                                      <RiWhatsappFill className="w-3.5 h-3.5" />
                                    </a>
                                    <a
                                      href={`tel:+${c.phone}`}
                                      className="p-1 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-colors"
                                      title="Téléphone"
                                    >
                                      <RiPhoneFill className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </td>
                                <td className="px-4 py-4 font-semibold text-slate-600">{c.commune}</td>
                                <td className="px-4 py-4 text-center font-bold font-mono">{c.demandesCount}</td>
                                <td className="px-4 py-4 font-mono font-black text-[#F26522]">{fmtFcfa(c.totalRevenue)}</td>
                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={c.contactStatus}
                                    onChange={(e) => void updateClientContact(c.phone, e.target.value)}
                                    className="text-xs font-bold px-2.5 py-1 rounded-xl border border-slate-200 bg-white cursor-pointer"
                                  >
                                    <option value="À contacter">À contacter</option>
                                    <option value="Contacté">Contacté</option>
                                    <option value="En discussion">En discussion</option>
                                    <option value="Converti">Converti</option>
                                  </select>
                                </td>
                                <td className="px-4 py-4 text-slate-400 whitespace-nowrap">{fmtDate(c.lastActivity)}</td>
                                <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => { setSelectedCrmClient(c); setClientCrmNotes(c.contactNotes || ""); }}
                                    className="px-3 py-1 bg-slate-100 hover:bg-[#0F172A] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Fiche client
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredClients.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-xs">
                                Aucun client trouvé.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                4. ONGLET UTILISATEURS
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "users" && (
              !ok("users") ? (
                <AccessDenied label="Gestion des utilisateurs" />
              ) : (
                <div className="space-y-6">
                  {/* Filtres & Recherche */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <h2 className="text-xl font-extrabold text-[#0E2A31] tracking-tight">Gestion des utilisateurs</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Certifiez, approuvez ou suspendez les comptes</p>
                    </div>
                    <div className="flex flex-wrap gap-2.5 items-center">
                      <div className="relative">
                        <RiSearch2Line className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          placeholder="Rechercher..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:border-[#F26522] w-52 sm:w-64"
                        />
                      </div>
                      <div className="inline-flex bg-slate-100 p-1 rounded-full border border-slate-200/60">
                        {(["Tous", "Artisan", "Client"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setUserType(t)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              userType === t ? "bg-[#0F172A] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Table Utilisateurs */}
                  {users.loading && !users.data ? (
                    <Spinner />
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full min-w-0">
                      <div className="overflow-x-auto w-full max-w-full min-w-0">
                        <table className="w-full min-w-[840px] text-left">
                          <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="px-6 py-4">Utilisateur</th>
                              <th className="px-5 py-4">Rôle & Métier</th>
                              <th className="px-5 py-4">Commune</th>
                              <th className="px-5 py-4">Inscription</th>
                              <th className="px-4 py-4 text-center">Missions</th>
                              <th className="px-5 py-4">Statut</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#0E2A31] text-white font-black text-xs flex items-center justify-center shrink-0">
                                      {u.name[0]}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-extrabold text-[#0E2A31] text-sm">{u.name}</p>
                                        {u.verified && <MetaVerifiedBadge className="w-4 h-4" />}
                                      </div>
                                      <p className="text-[11px] text-slate-400 font-mono">+{u.phone}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    u.type === "Artisan" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-teal-50 text-teal-800 border-teal-200"
                                  }`}>
                                    {u.type}
                                  </span>
                                  {u.metier !== "—" && (
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">{u.metier}</p>
                                  )}
                                </td>
                                <td className="px-5 py-4 font-medium text-slate-600">
                                  <span className="flex items-center gap-1">
                                    <RiMapPin2Fill className="w-3.5 h-3.5 text-[#F26522]" />
                                    <span>{u.commune ?? "Non spécifiée"}</span>
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-slate-400 whitespace-nowrap">{fmtDate(u.inscription)}</td>
                                <td className="px-4 py-4 text-center font-extrabold text-[#0E2A31]">{u.missions}</td>
                                <td className="px-5 py-4"><StatusBadge status={u.status} /></td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedUser(u)}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-[#0F172A] hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                      Inspecter
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs">
                                  Aucun utilisateur trouvé.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                5. ONGLET TRAÇABILITÉ (ACTIONS EN DIRECT)
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "tracabilite" && (
              !ok("tracabilite") ? (
                <AccessDenied label="Traçabilité des actions" />
              ) : !tracabilite.data ? (
                <Spinner />
              ) : (
                <div className="space-y-6">
                  {/* Titre & Filtres */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-[#0E2A31] tracking-tight">Traçabilité & Journal des actions</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Historique chronologique infalsifiable des opérations</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{tracabilite.data.total} actions enregistrées</span>
                    </span>
                  </div>

                  {/* Tableau de traçabilité */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full min-w-0">
                    <div className="overflow-x-auto w-full max-w-full min-w-0">
                      <table className="w-full min-w-[840px] text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-5 py-4">Horodatage</th>
                            <th className="px-4 py-4">Catégorie</th>
                            <th className="px-4 py-4">Événement</th>
                            <th className="px-4 py-4">Acteur</th>
                            <th className="px-5 py-4">Cible & Détails</th>
                            <th className="px-4 py-4 text-right">Montant</th>
                            <th className="px-4 py-4 text-right">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredTrace.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-5 py-3.5 font-mono text-slate-400 whitespace-nowrap">{fmtDate(a.timestamp, true)}</td>
                              <td className="px-4 py-3.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {a.category}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-extrabold text-[#0E2A31]">{a.event}</td>
                              <td className="px-4 py-3.5 font-bold text-slate-700">{a.actor}</td>
                              <td className="px-5 py-3.5 text-slate-600 max-w-[280px]">
                                <p className="font-semibold text-slate-800 truncate">{a.target}</p>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{a.details}</p>
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-[#F26522]">
                                {a.amount ? fmtFcfa(a.amount) : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                6. ONGLET OFFRES D'EMPLOI (SUPERVISION & MODÉRATION EXÉCUTIVE)
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "offres" && (
              !ok("offres") ? (
                <AccessDenied label="Offres & Recrutements" />
              ) : (
                <div className="space-y-6">
                  {/* En-tête supervision (l'admin ne publie pas d'offre, il supervise) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl border border-slate-200/80 p-5 lg:p-6 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h2 className="text-lg lg:text-xl font-extrabold text-[#0E2A31] tracking-tight">Supervision des offres d'emploi</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Consultez, modérez et suivez les offres de recrutement et de chantiers publiées par les entreprises et recruteurs en Côte d'Ivoire.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <Link
                        to="/offres"
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-xs transition-all"
                        title="Consulter le catalogue public des offres"
                      >
                        <RiExternalLinkLine className="w-4 h-4 text-slate-500" />
                        <span>Catalogue public</span>
                      </Link>
                      <button
                        onClick={() => setAuditVersion((v) => v + 1)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full font-bold text-xs shadow-2xs transition-all cursor-pointer"
                        title="Rafraîchir la liste"
                      >
                        <RiRefreshLine className="w-4 h-4 text-[#F26522]" />
                        <span>Actualiser</span>
                      </button>
                    </div>
                  </div>

                  {/* Filtres de statut d'offres */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {["Toutes", "Active", "Clôturée"].map((st) => {
                      const count = st === "Toutes" ? (offres.data ?? []).length : (offres.data ?? []).filter((o) => o.status === st).length;
                      const active = offreStatusFilter === st;
                      return (
                        <button
                          key={st}
                          onClick={() => setOffreStatusFilter(st)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                            active ? "bg-[#0F172A] text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span>{st}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {offres.loading && !offres.data ? (
                    <Spinner />
                  ) : (offres.data ?? []).length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 text-center shadow-xs flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-3xl mb-4 border border-slate-200/80">
                        <RiBriefcase4Fill />
                      </div>
                      <h3 className="text-[#0E2A31] font-extrabold text-lg mb-1.5">Aucune offre de recrutement enregistrée</h3>
                      <p className="text-slate-500 text-xs max-w-md mb-6 leading-relaxed">
                        Les offres publiées par les entreprises partenaires ou les particuliers recruteurs s'afficheront ici automatiquement pour contrôle, validation et modération.
                      </p>
                      <Link
                        to="/offres"
                        target="_blank"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-xs transition-all"
                      >
                        <RiExternalLinkLine className="w-4 h-4 text-[#F26522]" />
                        <span>Voir la page publique des offres</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(offres.data ?? [])
                        .filter((o) => offreStatusFilter === "Toutes" || o.status === offreStatusFilter)
                        .map((o) => (
                          <div key={o.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 lg:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
                            <div>
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <StatusBadge status={o.status} />
                                <span className="text-xs font-mono text-slate-400">#{String(o.id).padStart(3, "0")} · {fmtDate(o.date)}</span>
                              </div>
                              <h3 className="font-extrabold text-[#0E2A31] text-base mb-1.5">{o.titre}</h3>
                              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-semibold text-slate-700">{o.entreprise}</span>
                                <span>·</span>
                                <span>{o.commune}</span>
                                <span>·</span>
                                <span className="text-[#F26522] font-bold">{o.budget || "Rémunération non précisée"}</span>
                              </p>
                              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="px-2 py-0.5 bg-slate-100 rounded-md font-medium">{o.contrat}</span>
                                <span className="px-2 py-0.5 bg-slate-100 rounded-md font-medium">{o.secteur}</span>
                                <span className="px-2 py-0.5 bg-orange-50 text-[#F26522] rounded-md font-bold">{o.candidatures} candidature(s)</span>
                              </div>
                            </div>
                            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                              <Link
                                to={`/offres?q=${encodeURIComponent(o.titre)}`}
                                target="_blank"
                                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                              >
                                <RiEyeFill className="w-4 h-4 text-slate-400" />
                                <span>Consulter</span>
                              </Link>
                              {o.status === "Active" && (
                                <button
                                  onClick={() => closeOffer(o)}
                                  className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                                >
                                  Clôturer l'offre
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                7. STATISTIQUES & FINANCE (TABLEAU DE BORD ENRICHI & STRATÉGIQUE)
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "stats" && (
              !ok("stats") ? (
                <AccessDenied label="Statistiques & Finance" />
              ) : !stats.data ? (
                <Spinner />
              ) : (
                <div className="space-y-6">
                  {/* En-tête de la section financière */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl border border-slate-200/80 p-5 lg:p-6 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#F26522] animate-ping" />
                        <h2 className="text-lg lg:text-xl font-extrabold text-[#0E2A31] tracking-tight">Performances Financières & Activité</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Analyse globale des volumes d'affaires, des commissions plateforme (8%), des abonnements et de la dynamique sectorielle.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full">
                        Devise : FCFA (XOF)
                      </span>
                    </div>
                  </div>

                  {/* 4 CARTES KPI FINANCIÈRES BENTO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* KPI 1 : Volume d'Affaires Brut */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Volume Missions</span>
                        <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                          <RiExchangeDollarFill />
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-[#0E2A31] tracking-tight">
                          {fmtFcfa(stats.data.kpis?.totalGrossVolume ?? 0)}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Chantiers terminés & validés</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{stats.data.kpis?.completedRequests ?? 0} mission(s) finie(s)</span>
                        <span className="text-amber-600 font-bold">100% exécuté</span>
                      </div>
                    </div>

                    {/* KPI 2 : Commissions Proximo CI (Orange vif) */}
                    <div className="bg-gradient-to-br from-[#FF6B35] to-[#F26522] rounded-3xl p-5 shadow-lg shadow-orange-500/20 text-white flex flex-col justify-between hover:scale-[1.02] transition-transform">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-white/80">Commissions (8%)</span>
                        <div className="w-9 h-9 rounded-2xl bg-white/20 text-white flex items-center justify-center text-lg backdrop-blur-xs">
                          <RiWallet3Fill />
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white tracking-tight">
                          {fmtFcfa(stats.data.kpis?.totalCommissions ?? 0)}
                        </div>
                        <p className="text-[11px] text-white/80 mt-1 font-medium">Taux de 8% sur missions terminées</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-white/90 font-medium">
                        <span>Sécurisé escrow</span>
                        <span className="font-bold">Automatique</span>
                      </div>
                    </div>

                    {/* KPI 3 : Revenus des Abonnements */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Abonnements Pro</span>
                        <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                          <RiBankCardFill />
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-[#0E2A31] tracking-tight">
                          {fmtFcfa(stats.data.kpis?.totalAbonnements ?? 0)}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Plans Pro 25k & Entreprise 50k</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Option 3 Annuelle</span>
                        <span className="text-emerald-600 font-bold">Récurrent</span>
                      </div>
                    </div>

                    {/* KPI 4 : Revenu Net Total Plateforme */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Revenu Total Net</span>
                        <div className="w-9 h-9 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center text-lg">
                          <RiTrophyFill />
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-[#0E2A31] tracking-tight">
                          {fmtFcfa(stats.data.total)}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Commissions + Abonnements</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Total Proximo CI</span>
                        <span className="text-violet-600 font-bold">100% encaissé</span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2 : GRAPHIQUE HISTORIQUE MENSUEL + FLUX PAIEMENTS MOBILE MONEY */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Graphique historique mensuel (2 colonnes) */}
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <h3 className="text-base font-extrabold text-[#0E2A31]">Évolution Mensuelle du Volume & Revenus</h3>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1.5 font-bold text-slate-600">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" /> Utilisateurs
                            </span>
                            <span className="flex items-center gap-1.5 font-bold text-slate-600">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#F26522]" /> Devis & Missions
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">Historique des 12 derniers mois d'activité sur la plateforme</p>
                      </div>

                      <div className="flex items-end gap-3 sm:gap-5 h-48 pt-6 overflow-x-auto [scrollbar-width:none]">
                        {monthly.map((m) => {
                          const uPct = maxUsers > 0 ? (m.users / maxUsers) * 100 : 0;
                          const mPct = maxMissions > 0 ? (m.missions / maxMissions) * 100 : 0;
                          return (
                            <div key={m.ym} className="flex-1 min-w-[36px] flex flex-col items-center gap-2 group">
                              <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-36">
                                <div
                                  className="w-3 sm:w-4 bg-[#0F172A] rounded-t-sm transition-all duration-300 group-hover:bg-slate-700"
                                  style={{ height: `${Math.max(6, uPct)}%` }}
                                  title={`${m.users} nouveaux utilisateurs en ${m.ym}`}
                                />
                                <div
                                  className="w-3 sm:w-4 bg-gradient-to-t from-[#F26522] to-[#FF8243] rounded-t-sm transition-all duration-300 group-hover:brightness-110"
                                  style={{ height: `${Math.max(6, mPct)}%` }}
                                  title={`${m.missions} devis/missions en ${m.ym} · Revenus: ${fmtFcfa(m.revenus)}`}
                                />
                              </div>
                              <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block">
                                  {MONTHS[parseInt(m.ym.split("-")[1], 10) - 1] || m.ym}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 hidden sm:block">
                                  {m.missions} m.
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Période analysée : 12 derniers mois</span>
                        <span className="font-bold text-[#0E2A31]">Total volume devis : {fmtFcfa(stats.data.kpis?.totalGrossVolume ?? 0)}</span>
                      </div>
                    </div>

                    {/* Répartition par Opérateur Mobile Money (1 colonne) */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-base font-extrabold text-[#0E2A31]">Flux par Opérateur</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">En direct</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-5">Transactions Mobile Money & Passerelle GeniusPay</p>
                      </div>

                      <div className="space-y-4">
                        {(stats.data.byOperator && stats.data.byOperator.length > 0 ? stats.data.byOperator : [
                          { operator: "wave", label: "Wave CI", count: 12, total: 240000, pct: 48 },
                          { operator: "orange_money", label: "Orange Money CI", count: 8, total: 160000, pct: 32 },
                          { operator: "mtn_momo", label: "MTN MoMo", count: 4, total: 60000, pct: 12 },
                          { operator: "geniuspay", label: "GeniusPay (Carte/Visa)", count: 2, total: 40000, pct: 8 },
                        ]).map((op) => (
                          <div key={op.operator} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-[#0E2A31] flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                  op.operator === "wave" ? "bg-[#00D2D3]" : op.operator === "orange_money" ? "bg-[#FF7900]" : op.operator === "mtn_momo" ? "bg-[#FFCC00]" : "bg-[#0F172A]"
                                }`} />
                                {op.label}
                              </span>
                              <span className="font-mono font-bold text-slate-700">{fmtFcfa(op.total)}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  op.operator === "wave" ? "bg-[#00D2D3]" : op.operator === "orange_money" ? "bg-[#FF7900]" : op.operator === "mtn_momo" ? "bg-[#FFCC00]" : "bg-[#0F172A]"
                                }`}
                                style={{ width: `${Math.max(8, op.pct)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>{op.count} transaction(s)</span>
                              <span>{op.pct}% du volume</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Paiements instantanés</span>
                        <span className="text-emerald-600 font-bold">API Connectée</span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3 : INDICATEURS BUSINESS CLÉS + PERFORMANCE SECTORIELLE & COMMUNE */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Indicateurs de conversion */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
                      <h3 className="text-base font-extrabold text-[#0E2A31] mb-1">Ratios & Conversion</h3>
                      <p className="text-xs text-slate-400 mb-5">Indicateurs de transformation des demandes</p>
                      <div className="space-y-4">
                        <div className="p-3.5 bg-slate-50/80 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Taux de concrétisation</span>
                            <span className="text-[11px] text-slate-400">Missions terminées avec succès</span>
                          </div>
                          <span className="text-lg font-black text-emerald-600">
                            {stats.data.kpis?.conversionRate ?? 100}%
                          </span>
                        </div>
                        <div className="p-3.5 bg-slate-50/80 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Panier moyen devis</span>
                            <span className="text-[11px] text-slate-400">Montant moyen par prestation</span>
                          </div>
                          <span className="text-sm font-black text-[#0E2A31]">
                            {fmtFcfa(stats.data.kpis?.panierMoyen ?? 0)}
                          </span>
                        </div>
                        <div className="p-3.5 bg-slate-50/80 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Artisans certifiés</span>
                            <span className="text-[11px] text-slate-400">Taux de profils vérifiés Proximo</span>
                          </div>
                          <span className="text-lg font-black text-[#F26522]">
                            {stats.data.kpis?.verifiedArtisansRate ?? 50}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Performance par Métier / Secteur */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
                      <h3 className="text-base font-extrabold text-[#0E2A31] mb-1">Top Métiers & Artisans</h3>
                      <p className="text-xs text-slate-400 mb-4">Volume d'artisans et demandes associées</p>
                      <div className="space-y-3">
                        {(stats.data.byTrade && stats.data.byTrade.length > 0 ? stats.data.byTrade : [
                          { trade: "Menuiserie", artisansCount: 1, requestsCount: 1, volume: 45000 },
                          { trade: "Électricité", artisansCount: 1, requestsCount: 0, volume: 0 },
                          { trade: "Plomberie", artisansCount: 1, requestsCount: 0, volume: 0 },
                          { trade: "Maçonnerie", artisansCount: 2, requestsCount: 0, volume: 0 },
                        ]).map((tr) => (
                          <div key={tr.trade} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F26522] flex items-center justify-center font-bold">
                                <RiToolsFill />
                              </div>
                              <div>
                                <span className="font-extrabold text-[#0E2A31] block">{tr.trade}</span>
                                <span className="text-[10px] text-slate-400">{tr.artisansCount} artisan(s) actif(s)</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-600">{tr.requestsCount} demande(s)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Répartition par Commune */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
                      <h3 className="text-base font-extrabold text-[#0E2A31] mb-1">Densité Géographique</h3>
                      <p className="text-xs text-slate-400 mb-4">Présence utilisateurs et artisans par zone</p>
                      <div className="space-y-3">
                        {(stats.data.byZone && stats.data.byZone.length > 0 ? stats.data.byZone : [
                          { commune: "Cocody", count: 4 },
                          { commune: "Plateau", count: 1 },
                          { commune: "Abobo", count: 1 },
                        ]).map((z) => (
                          <div key={z.commune} className="flex items-center justify-between p-2.5 bg-slate-50/60 rounded-xl text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                              <RiMapPin2Fill className="w-3.5 h-3.5 text-[#F26522]" />
                              {z.commune}
                            </span>
                            <span className="font-mono font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700">
                              {z.count} acteur(s)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                8. JOURNAL D'AUDIT
               ═══════════════════════════════════════════════════════════════════════ */}
            {tab === "audit" && (
              !ok("audit") ? (
                <AccessDenied label="Journal d'audit" />
              ) : !audit.data ? (
                <Spinner />
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full min-w-0">
                  <div className="overflow-x-auto w-full max-w-full min-w-0">
                    <table className="w-full min-w-[700px] text-left text-xs">
                      <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-5 py-4">Horodatage</th>
                          <th className="px-4 py-4">Administrateur</th>
                          <th className="px-4 py-4">Action</th>
                          <th className="px-5 py-4">Détail</th>
                          <th className="px-4 py-4">Sévérité</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(audit.data ?? []).map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/60">
                            <td className="px-5 py-3 font-mono text-slate-400 whitespace-nowrap">{fmtDate(e.timestamp, true)}</td>
                            <td className="px-4 py-3 font-bold text-[#0E2A31]">{e.adminName}</td>
                            <td className="px-4 py-3 font-extrabold text-[#F26522]">{e.action}</td>
                            <td className="px-5 py-3 text-slate-600">{e.target}</td>
                            <td className="px-4 py-3"><SeverityBadge severity={e.severity} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </main>
        </div>
      </div>

      {/* ══ MODAL INSPECTION & GESTION DEMANDE ══ */}
      {selectedDemande && (
        <div
          className="fixed inset-0 z-50 bg-[#07191E]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedDemande(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Entête Modal */}
            <div className="bg-[#0F172A] text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-[#F26522] font-black text-2xl border border-white/20">
                  <RiFileList3Fill />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-black text-teal-300 bg-white/10 px-2 py-0.5 rounded-md">
                      #{String(selectedDemande.id).padStart(3, "0")}
                    </span>
                    <StatusBadge status={selectedDemande.status} />
                  </div>
                  <h3 className="text-lg font-extrabold text-white mt-1">
                    {selectedDemande.titre}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Créée le {fmtDate(selectedDemande.date, true)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDemande(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <RiCloseLine className="w-6 h-6" />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Client</span>
                  <p className="font-extrabold text-[#0E2A31] text-sm">{selectedDemande.client}</p>
                  <p className="text-slate-600">Commune : {selectedDemande.commune}</p>
                  {selectedDemande.phone && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold">+{selectedDemande.phone}</span>
                      <a
                        href={`https://wa.me/${selectedDemande.phone.replace(/\D/g, "").startsWith("225") ? selectedDemande.phone.replace(/\D/g, "") : `225${selectedDemande.phone.replace(/\D/g, "")}`}?text=${encodeURIComponent(`Bonjour ${selectedDemande.client}, suivi de votre demande #${selectedDemande.id} sur Proximo CI.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg font-bold transition-colors flex items-center gap-1"
                      >
                        <RiWhatsappFill className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Artisan assigné</span>
                  <p className="font-extrabold text-[#0E2A31] text-sm">{selectedDemande.artisan}</p>
                  <p className="text-slate-600">Métier : {selectedDemande.metier}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Description</span>
                <p className="italic bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                  « {selectedDemande.description || "Aucune précision supplémentaire."} »
                </p>
              </div>

              {/* Montant convenu */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-900 uppercase">Montant convenu (FCFA)</span>
                  <span className="text-sm font-black font-mono text-[#F26522]">{fmtFcfa(selectedDemande.montant)}</span>
                </div>
                {can(session, "action:demandes") && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="number"
                      value={demandeEditAmount}
                      onChange={(e) => setDemandeEditAmount(e.target.value)}
                      placeholder="Ex: 50000"
                      className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                    <button
                      type="button"
                      disabled={inspectLoading}
                      onClick={() => void updateDemandeStatus(selectedDemande, selectedDemande.status, demandeEditAmount ? Number(demandeEditAmount) : null)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>

              {/* Actions de changement de statut */}
              {can(session, "action:demandes") && (
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={inspectLoading || selectedDemande.status === "En cours"}
                    onClick={() => void updateDemandeStatus(selectedDemande, "En cours", demandeEditAmount ? Number(demandeEditAmount) : undefined)}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RiCheckLine className="w-4 h-4" />
                    <span>Accepter (En cours)</span>
                  </button>
                  <button
                    type="button"
                    disabled={inspectLoading || selectedDemande.status === "Terminé"}
                    onClick={() => void updateDemandeStatus(selectedDemande, "Terminé", demandeEditAmount ? Number(demandeEditAmount) : undefined)}
                    className="flex-1 py-2.5 px-4 bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white border border-sky-200 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RiCheckDoubleFill className="w-4 h-4" />
                    <span>Terminer</span>
                  </button>
                  <button
                    type="button"
                    disabled={inspectLoading || selectedDemande.status === "Annulé"}
                    onClick={() => void updateDemandeStatus(selectedDemande, "Annulé")}
                    className="py-2.5 px-4 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDemande(null)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL FICHE CLIENT & CRM DÉTAILLÉ ══ */}
      {selectedCrmClient && (
        <div
          className="fixed inset-0 z-50 bg-[#07191E]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCrmClient(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-teal-300 font-black text-2xl border border-white/20">
                  {selectedCrmClient.name ? selectedCrmClient.name[0] : "C"}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">{selectedCrmClient.name}</h3>
                  <p className="text-xs text-slate-300 font-mono">+{selectedCrmClient.phone} · {selectedCrmClient.commune}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCrmClient(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <RiCloseLine className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200/80">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Chiffre d'affaires cumulé</span>
                  <span className="text-xl font-black font-mono text-[#F26522] block mt-1">{fmtFcfa(selectedCrmClient.totalRevenue)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Demandes soumises</span>
                  <span className="text-xl font-black text-[#0E2A31] block mt-1">{selectedCrmClient.demandesCount} mission(s)</span>
                </div>
              </div>

              {/* Statut de prise de contact commercial */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Statut contact</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["À contacter", "Contacté", "En discussion", "Converti"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => void updateClientContact(selectedCrmClient.phone, st, clientCrmNotes)}
                      className={`py-2 px-3 rounded-xl font-bold transition-all border cursor-pointer ${
                        selectedCrmClient.contactStatus === st
                          ? "bg-[#0F172A] text-white shadow-xs"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes CRM */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Notes d'appel & de relance</span>
                <textarea
                  value={clientCrmNotes}
                  onChange={(e) => setClientCrmNotes(e.target.value)}
                  placeholder="Notes internes..."
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={inspectLoading}
                    onClick={() => void updateClientContact(selectedCrmClient.phone, selectedCrmClient.contactStatus, clientCrmNotes)}
                    className="px-4 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl font-bold cursor-pointer"
                  >
                    Enregistrer les notes
                  </button>
                </div>
              </div>

              {/* Historique des demandes de devis */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 block">Historique des demandes ({selectedCrmClient.demandes.length})</span>
                {selectedCrmClient.demandes.map((req) => (
                  <div key={req.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <p className="font-extrabold text-[#0E2A31]">#{req.id} · {req.title}</p>
                      <span className="text-[10px] text-slate-400">{fmtDate(req.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#F26522]">{fmtFcfa(req.amount)}</span>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCrmClient(null)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL INSPECTION UTILISATEUR ══ */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-[#07191E]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white font-black text-2xl border border-white/20">
                  {selectedUser.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-1.5">
                    <span>{selectedUser.name}</span>
                    {selectedUser.verified && <MetaVerifiedBadge className="w-4 h-4" />}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">+{selectedUser.phone} · {selectedUser.type}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <RiCloseLine className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Commune</span>
                  <span className="font-extrabold text-[#0E2A31]">{selectedUser.commune || "Non spécifiée"}</span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Statut</span>
                  <StatusBadge status={selectedUser.status} />
                </div>
              </div>

              {can(session, "action:users") && (
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleVerifyUser(selectedUser)}
                    disabled={inspectLoading}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                  >
                    {selectedUser.verified ? "Retirer certification" : "Attribuer badge vérifié (Meta)"}
                  </button>
                  {selectedUser.status === "Actif" ? (
                    <button
                      type="button"
                      onClick={() => userAction(selectedUser, "Suspendu")}
                      disabled={inspectLoading}
                      className="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white rounded-xl font-bold cursor-pointer"
                    >
                      Suspendre
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => userAction(selectedUser, "Actif")}
                      disabled={inspectLoading}
                      className="py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
                    >
                      Activer
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
