import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router";
import Logo from "../components/Logo";
import { Spinner } from "../components/ui";
import { api, ApiError, adminToken, fmtDate, fmtFcfa } from "../lib/api";
import { adminLogout, can, type AdminSession, type AdminRole, type AuditEntry } from "../lib/admin";

import { I, Rich } from "../components/Icon";
// ─── Types ────────────────────────────────────────────────────────────────────
interface Overview {
  kpis: { users: number; usersMonth: number; artisans: number; clients: number; demandes: number; offres: number; revenue: number; pendingMessages: number };
  byCommune: { commune: string; count: number }[];
  byMetier: { metier: string; count: number; pct: number }[];
  activity: { type: string; event: string; detail: string; at: string }[];
}
interface Stats { monthly: { ym: string; users: number; missions: number; revenus: number }[]; total: number }
interface AUser {
  id: number; name: string; first_name?: string; last_name?: string; type: "Artisan" | "Client"; metier: string; commune: string | null;
  status: string; inscription: string; missions: number; phone: string; verified: boolean;
  email?: string | null; price?: string | null; rating?: number; reviews_count?: number;
  diplome?: string | null; certification?: string | null; zone_label?: string | null; bio?: string | null;
}
interface Demande { id: number; titre: string; client: string; artisan: string; metier: string; commune: string; montant: number | null; status: string; date: string }
interface Offre { id: number; titre: string; entreprise: string; commune: string; secteur: string; contrat: string; budget: string; candidatures: number; status: string; date: string }

// ─── Styles ───────────────────────────────────────────────────────────────────
const statusBadge: Record<string, string> = {
  "Actif": "bg-green-50 text-green-700 border-green-200", "Suspendu": "bg-red-50 text-red-600 border-red-200", "En attente": "bg-amber-50 text-amber-700 border-amber-200",
  "En cours": "bg-blue-50 text-blue-700 border-blue-200", "Terminé": "bg-green-50 text-green-700 border-green-200", "Annulé": "bg-red-50 text-red-600 border-red-200",
  "Active": "bg-green-50 text-green-700 border-green-200", "Clôturée": "bg-gray-100 text-gray-500 border-gray-200",
};
const activityIcon: Record<string, string> = { user: "👤", demande: "📋", offre: "📢", done: "✅" };
const activityColor: Record<string, string> = { user: "bg-blue-50 text-blue-600", demande: "bg-purple-50 text-purple-600", offre: "bg-orange-50 text-[#F26522]", done: "bg-green-50 text-green-600" };
const severityBadge: Record<AuditEntry["severity"], string> = { info: "bg-blue-50 text-blue-600 border-blue-200", warning: "bg-amber-50 text-amber-700 border-amber-200", critical: "bg-red-50 text-red-600 border-red-200" };
const roleBadge: Record<AdminRole, string> = { "Super Admin": "bg-[#F26522] text-white", "Modérateur": "bg-purple-600 text-white", "Analyste": "bg-[#1D4E5B] text-white" };
const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const INACTIVITY_MS = 15 * 60 * 1000;

type Tab = "overview" | "users" | "demandes" | "offres" | "stats" | "audit";

function AccessDenied({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-5xl mb-4"><I e="🔒" /></span>
      <h3 className="text-[#1D4E5B] font-bold text-lg mb-2" style={{ fontFamily: "var(--font-body)" }}>Accès restreint</h3>
      <p className="text-[#6B7280] text-sm max-w-xs">Votre rôle ne vous permet pas d'accéder à <strong>{label}</strong>.<br />Contactez le Super Admin.</p>
    </div>
  );
}

// Charge une ressource admin ; redirige vers la connexion si la session est expirée.
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
  const [userSearch, setUserSearch] = useState("");
  const [userType, setUserType] = useState<"Tous" | "Artisan" | "Client">("Tous");
  const [userStatus, setUserStatus] = useState("Tous");
  const [demandeStatus, setDemandeStatus] = useState("Tous");
  const [idleWarning, setIdleWarning] = useState(false);
  const [actionError, setActionError] = useState("");
  const [auditVersion, setAuditVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AUser | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expired = useCallback(() => { adminToken.clear(); navigate("/backoffice-login", { replace: true }); }, [navigate]);

  // ── Garde d'accès : la session est vérifiée côté serveur ────────────────────
  useEffect(() => {
    if (!adminToken.get()) { navigate("/backoffice-login", { replace: true }); return; }
    api.get<AdminSession>("/admin/me", "admin").then(setSession).catch(expired);
  }, [navigate, expired]);

  // ── Inactivité : 15 min, avertissement à 14 min ─────────────────────────────
  const resetIdle = useCallback(() => {
    if (!session) return;
    setIdleWarning(false);
    clearTimeout(warnTimer.current!); clearTimeout(idleTimer.current!);
    warnTimer.current = setTimeout(() => setIdleWarning(true), INACTIVITY_MS - 60_000);
    idleTimer.current = setTimeout(async () => {
      try { await api.post("/admin/expire", {}, "admin"); } catch { /* déjà expirée */ }
      expired();
    }, INACTIVITY_MS);
  }, [session, expired]);

  useEffect(() => {
    if (!session) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => { events.forEach((e) => window.removeEventListener(e, resetIdle)); clearTimeout(warnTimer.current!); clearTimeout(idleTimer.current!); };
  }, [session, resetIdle]);

  async function keepAlive() { try { await api.post("/admin/ping", {}, "admin"); } catch { expired(); return; } resetIdle(); }
  async function handleLogout() { await adminLogout(); navigate("/backoffice-login", { replace: true }); }

  const ok = (perm: string) => !!session && can(session, perm);
  const overview = useAdminData<Overview>("/admin/overview", ok("overview"), expired);
  const users = useAdminData<AUser[]>("/admin/users", ok("users"), expired);
  const demandes = useAdminData<Demande[]>("/admin/demandes", ok("demandes"), expired);
  const offres = useAdminData<Offre[]>("/admin/offres", ok("offres"), expired);
  const stats = useAdminData<Stats>("/admin/stats", ok("stats") && tab === "stats", expired);
  const audit = useAdminData<AuditEntry[]>("/admin/audit", ok("audit") && tab === "audit", expired, [auditVersion]);

  async function userAction(u: AUser, status: "Suspendu" | "Actif") {
    setActionError("");
    setInspectLoading(true);
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status }, "admin");
      users.setData((list) => list?.map((x) => (x.id === u.id ? { ...x, status } : x)) ?? list);
      setSelectedUser((prev) => (prev?.id === u.id ? { ...prev, status } : prev));
      setAuditVersion((v) => v + 1);
    } catch (e) { setActionError(e instanceof ApiError ? e.message : "Action impossible."); }
    finally { setInspectLoading(false); }
  }

  async function toggleVerifyUser(u: AUser) {
    setActionError("");
    setInspectLoading(true);
    try {
      const next = !u.verified;
      await api.patch<{ id: number; verified: boolean }>(`/admin/users/${u.id}/verify`, { verified: next }, "admin");
      users.setData((list) => list?.map((x) => (x.id === u.id ? { ...x, verified: next } : x)) ?? list);
      setSelectedUser((prev) => (prev?.id === u.id ? { ...prev, verified: next } : prev));
      setAuditVersion((v) => v + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Action impossible.");
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
    } catch (e) { setActionError(e instanceof ApiError ? e.message : "Action impossible."); }
  }

  if (!session) return <Spinner />;

  const role = session.user.role;
  const k = overview.data?.kpis;
  const kpis = [
    { label: "Utilisateurs total", value: k?.users ?? "—", delta: `+${k?.usersMonth ?? 0} ce mois`, icon: "👥", bg: "bg-[#E8F2F5]" },
    { label: "Artisans actifs", value: k?.artisans ?? "—", delta: "validés", icon: "🔨", bg: "bg-amber-50" },
    { label: "Clients inscrits", value: k?.clients ?? "—", delta: "", icon: "👤", bg: "bg-blue-50" },
    { label: "Demandes en cours", value: k?.demandes ?? "—", delta: "en cours + attente", icon: "📋", bg: "bg-purple-50" },
    { label: "Offres publiées", value: k?.offres ?? "—", delta: "actives", icon: "📢", bg: "bg-orange-50" },
    { label: "Revenus commissions", value: k ? fmtFcfa(k.revenue) : "—", delta: "8 % des missions terminées", icon: "💰", bg: "bg-green-50" },
  ];

  const filteredUsers = (users.data ?? []).filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) && (userType === "Tous" || u.type === userType) && (userStatus === "Tous" || u.status === userStatus));
  const filteredDemandes = (demandes.data ?? []).filter((d) => demandeStatus === "Tous" || d.status === demandeStatus);
  const maxCommune = Math.max(1, ...(overview.data?.byCommune.map((c) => c.count) ?? [1]));
  const monthly = stats.data?.monthly ?? [];
  const maxUsers = Math.max(1, ...monthly.map((m) => m.users));
  const maxMissions = Math.max(1, ...monthly.map((m) => m.missions));
  const maxRevenu = Math.max(1, ...monthly.map((m) => m.revenus));
  const monthLabel = (ym: string) => MONTHS[parseInt(ym.slice(5), 10) - 1];

  const tabs: { key: Tab; label: string; icon: string; perm: string }[] = [
    { key: "overview", label: "Vue d'ensemble", icon: "📊", perm: "overview" },
    { key: "users", label: "Utilisateurs", icon: "👥", perm: "users" },
    { key: "demandes", label: "Demandes", icon: "📋", perm: "demandes" },
    { key: "offres", label: "Offres", icon: "📢", perm: "offres" },
    { key: "stats", label: "Statistiques", icon: "📈", perm: "stats" },
    { key: "audit", label: "Journal d'audit", icon: "🛡️", perm: "audit" },
  ];
  const H = (props: { children: string }) => <th className="text-left text-xs font-bold text-[#1D4E5B] px-5 py-4 uppercase tracking-wide">{props.children}</th>;

  return (
    <div className="min-h-screen bg-[#F4F8F9]">
      {idleWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-6 py-3 flex items-center justify-between gap-4 shadow-lg" role="alert">
          <p className="text-sm font-semibold"><I e="⚠️" /> Votre session expire dans moins d'une minute en raison d'inactivité.</p>
          <button onClick={keepAlive} className="px-4 py-1.5 bg-white text-amber-700 rounded-lg text-sm font-bold hover:bg-amber-50 transition-colors flex-shrink-0">Rester connecté</button>
        </div>
      )}

      <div className="bg-[#0E2A31] text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="Accueil"><Logo size="sm" className="brightness-0 invert" /></Link>
            <div className="h-7 w-px bg-white/20" />
            <div><p className="text-[#8FAFB7] text-xs uppercase tracking-widest font-semibold">Administration</p><p className="text-white font-bold text-sm leading-tight">Tableau de bord sécurisé</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end"><p className="text-white font-bold text-sm">{session.user.displayName}</p><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${roleBadge[role]}`}>{role}</span></div>
            <img src={session.user.avatar} alt={session.user.displayName} className="w-9 h-9 rounded-full object-cover ring-2 ring-white/20" />
            <button onClick={handleLogout} className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-red-700 rounded-xl text-xs font-bold transition-colors" title="Déconnexion"><I e="🚪" /> Déconnexion</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kp) => (
            <div key={kp.label} className="bg-white/10 border border-white/10 rounded-2xl p-4">
              <div className={`w-8 h-8 ${kp.bg} rounded-xl flex items-center justify-center text-base mb-2`}><I e={kp.icon} /></div>
              <p className="text-2xl font-black text-white break-words" style={{ fontFamily: "var(--font-display)" }}>{kp.value}</p>
              <p className="text-[#8FAFB7] text-xs mt-0.5 leading-tight">{kp.label}</p>
              {kp.delta && <p className="text-green-300 text-xs font-semibold mt-1">{kp.delta}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1D4E5B] text-[#8FAFB7] text-xs py-2 px-6 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" />Session active · Expire après 15 min d'inactivité · IP : {session.ip}</span>
        <span>Connecté : {new Date(session.issuedAt).toLocaleTimeString("fr-FR")}</span>
      </div>

      <div className="bg-white border-b-2 border-[#E8F2F5] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0.5 overflow-x-auto" role="tablist">
            {tabs.map((t) => {
              const allowed = can(session, t.perm);
              return (
                <button key={t.key} onClick={() => allowed && setTab(t.key)} role="tab" aria-selected={tab === t.key} title={!allowed ? "Accès restreint pour votre rôle" : undefined}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${!allowed ? "text-[#C4CDD0] cursor-not-allowed border-transparent" : tab === t.key ? "border-[#F26522] text-[#F26522]" : "border-transparent text-[#6B7280] hover:text-[#1D4E5B]"}`}>
                  <I e={t.icon} />{t.label}{!allowed && <span className="text-[#C4CDD0] text-xs"><I e="🔒" /></span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {actionError && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600" role="alert"><I e="⚠️" /> {actionError}</div>}

        {/* ══ OVERVIEW ══ */}
        {tab === "overview" && (!ok("overview") ? <AccessDenied label="la vue d'ensemble" /> : !overview.data ? <Spinner /> : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden">
              <div className="px-6 py-4 border-b-2 border-[#E8F2F5] flex items-center justify-between">
                <h2 className="font-bold text-[#1D4E5B] text-base" style={{ fontFamily: "var(--font-body)" }}><I e="⚡" /> Activité récente</h2>
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />Live</span>
              </div>
              <div className="divide-y divide-[#E8F2F5]">
                {overview.data.activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-[#F4F8F9] transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${activityColor[a.type]}`}><I e={activityIcon[a.type]} /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-bold text-[#1D4E5B]">{a.event}</p><p className="text-xs text-[#6B7280] truncate">{a.detail}</p></div>
                    <p className="text-xs text-[#9CA3AF] flex-shrink-0 mt-0.5">{fmtDate(a.at)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden">
              <div className="px-6 py-4 border-b-2 border-[#E8F2F5]"><h2 className="font-bold text-[#1D4E5B] text-base" style={{ fontFamily: "var(--font-body)" }}><I e="📍" /> Artisans par commune</h2></div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {overview.data.byCommune.map((c) => (
                  <div key={c.commune}>
                    <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-[#3D3D3D]">{c.commune}</span><span className="text-[#1D4E5B]">{c.count}</span></div>
                    <div className="h-2 bg-[#E8F2F5] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#1D4E5B] to-[#2A7A8E] rounded-full" style={{ width: `${(c.count / maxCommune) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden">
              <div className="px-6 py-4 border-b-2 border-[#E8F2F5] flex items-center justify-between">
                <h2 className="font-bold text-[#1D4E5B] text-base" style={{ fontFamily: "var(--font-body)" }}><I e="📋" /> Dernières demandes</h2>
                {ok("demandes") && <button onClick={() => setTab("demandes")} className="text-xs text-[#F26522] font-bold hover:underline">Voir tout <I e="→" /></button>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]"><tbody className="divide-y divide-[#E8F2F5]">
                  {(demandes.data ?? []).slice(0, 5).map((d) => (
                    <tr key={d.id} className="hover:bg-[#F4F8F9] transition-colors">
                      <td className="px-5 py-3.5 text-sm font-semibold text-[#1D4E5B] max-w-[200px] truncate">{d.titre}</td>
                      <td className="px-3 py-3.5 text-xs text-[#6B7280]">{d.client}</td>
                      <td className="px-3 py-3.5 text-xs font-bold text-[#F26522]">{fmtFcfa(d.montant)}</td>
                      <td className="px-3 py-3.5"><span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${statusBadge[d.status]}`}>{d.status}</span></td>
                    </tr>
                  ))}
                  {!ok("demandes") && <tr><td className="px-5 py-8 text-center text-sm text-[#9CA3AF]">Réservé aux rôles ayant accès aux demandes.</td></tr>}
                </tbody></table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden">
              <div className="px-6 py-4 border-b-2 border-[#E8F2F5]"><h2 className="font-bold text-[#1D4E5B] text-base" style={{ fontFamily: "var(--font-body)" }}><I e="🏆" /> Top métiers</h2></div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {overview.data.byMetier.slice(0, 5).map((m, i) => (
                  <div key={m.metier} className="flex items-center gap-3">
                    <span className={`text-xs font-black w-5 text-right ${i < 3 ? "text-amber-500" : "text-[#9CA3AF]"}`}>#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-[#3D3D3D]">{m.metier}</span><span className="text-[#F26522]">{m.pct}%</span></div>
                      <div className="h-1.5 bg-[#E8F2F5] rounded-full overflow-hidden"><div className="h-full bg-[#F26522] rounded-full" style={{ width: `${m.pct}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* ══ USERS ══ */}
        {tab === "users" && (!ok("users") ? <AccessDenied label="Gestion des utilisateurs" /> : (
          <div>
            <div className="flex flex-wrap gap-3 mb-6 items-center justify-between">
              <h2 className="text-2xl font-bold text-[#1D4E5B]" style={{ fontFamily: "var(--font-body)" }}>Gestion des utilisateurs</h2>
              <div className="flex flex-wrap gap-2">
                <input type="search" placeholder="Rechercher…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="border-2 border-[#E8F2F5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1D4E5B] w-48" />
                {(["Tous", "Artisan", "Client"] as const).map((t) => <button key={t} onClick={() => setUserType(t)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${userType === t ? "bg-[#1D4E5B] text-white border-[#1D4E5B]" : "border-[#E8F2F5] text-[#6B7280] hover:border-[#1D4E5B]"}`}>{t}</button>)}
                {["Tous", "Actif", "Suspendu", "En attente"].map((s) => <button key={s} onClick={() => setUserStatus(s)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${userStatus === s ? "bg-[#F26522] text-white border-[#F26522]" : "border-[#E8F2F5] text-[#6B7280] hover:border-[#F26522]"}`}>{s}</button>)}
              </div>
            </div>
            {users.loading && !users.data ? <Spinner /> : (
              <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden"><div className="overflow-x-auto">
                <table className="w-full min-w-[780px]">
                  <thead className="bg-[#F4F8F9] border-b-2 border-[#E8F2F5]"><tr>{["Utilisateur", "Type / Métier", "Commune", "Inscription", "Missions", "Statut", "Actions"].map((h) => <H key={h}>{h}</H>)}</tr></thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} className={`hover:bg-[#F4F8F9] transition-colors ${i < filteredUsers.length - 1 ? "border-b border-[#E8F2F5]" : ""}`}>
                        <td className="px-5 py-4"><div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#E8F2F5] rounded-xl flex items-center justify-center text-[#1D4E5B] font-bold text-sm flex-shrink-0">{u.name[0]}</div>
                          <div><p className="text-sm font-bold text-[#1D4E5B]">{u.name}</p><p className="text-xs text-[#9CA3AF]">+{u.phone}</p></div>
                          {u.verified && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold"><I e="✓" /> Vérifié</span>}
                        </div></td>
                        <td className="px-5 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${u.type === "Artisan" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-200"}`}>{u.type}</span>{u.metier !== "—" && <p className="text-xs text-[#6B7280] mt-1">{u.metier}</p>}</td>
                        <td className="px-5 py-4 text-sm text-[#6B7280]"><I e="📍" /> {u.commune ?? "—"}</td>
                        <td className="px-5 py-4 text-xs text-[#9CA3AF]">{fmtDate(u.inscription)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-[#1D4E5B] text-center">{u.missions}</td>
                        <td className="px-5 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${statusBadge[u.status]}`}>{u.status}</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="text-xs px-3 py-1.5 bg-[#1D4E5B] text-white rounded-lg font-bold hover:bg-[#163A43] transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <I e="👁️" /> Inspecter
                            </button>
                            {can(session, "action:users") && (
                              u.status === "Actif"
                                ? <button type="button" onClick={() => userAction(u, "Suspendu")} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-colors cursor-pointer">Suspendre</button>
                                : <button type="button" onClick={() => userAction(u, "Actif")} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-bold hover:bg-green-600 hover:text-white transition-colors cursor-pointer">{u.status === "En attente" ? "Approuver" : "Réactiver"}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-[#9CA3AF] text-sm">Aucun utilisateur trouvé.</td></tr>}
                  </tbody>
                </table>
              </div></div>
            )}
          </div>
        ))}

        {/* ══ DEMANDES ══ */}
        {tab === "demandes" && (!ok("demandes") ? <AccessDenied label="Suivi des demandes" /> : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-2xl font-bold text-[#1D4E5B]" style={{ fontFamily: "var(--font-body)" }}>Suivi des demandes</h2>
              <div className="flex gap-2 flex-wrap">
                {["Tous", "En cours", "Terminé", "En attente", "Annulé"].map((s) => <button key={s} onClick={() => setDemandeStatus(s)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${demandeStatus === s ? "bg-[#1D4E5B] text-white border-[#1D4E5B]" : "border-[#E8F2F5] text-[#6B7280] hover:border-[#1D4E5B]"}`}>{s}</button>)}
              </div>
            </div>
            {demandes.loading && !demandes.data ? <Spinner /> : (
              <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden"><div className="overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="bg-[#F4F8F9] border-b-2 border-[#E8F2F5]"><tr>{["#", "Mission", "Client", "Artisan / Métier", "Commune", "Montant", "Statut", "Date"].map((h) => <H key={h}>{h}</H>)}</tr></thead>
                  <tbody>
                    {filteredDemandes.map((d, i) => (
                      <tr key={d.id} className={`hover:bg-[#F4F8F9] transition-colors ${i < filteredDemandes.length - 1 ? "border-b border-[#E8F2F5]" : ""}`}>
                        <td className="px-4 py-4 text-xs text-[#9CA3AF] font-mono">#{String(d.id).padStart(3, "0")}</td>
                        <td className="px-4 py-4 font-bold text-[#1D4E5B] text-sm max-w-[180px] truncate">{d.titre}</td>
                        <td className="px-4 py-4 text-sm text-[#3D3D3D]">{d.client}</td>
                        <td className="px-4 py-4"><p className="text-sm text-[#3D3D3D]">{d.artisan}</p><p className="text-xs text-[#9CA3AF]">{d.metier}</p></td>
                        <td className="px-4 py-4 text-xs text-[#F26522] font-semibold"><I e="📍" /> {d.commune}</td>
                        <td className="px-4 py-4 text-sm font-bold text-[#1D4E5B]">{fmtFcfa(d.montant)}</td>
                        <td className="px-4 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${statusBadge[d.status]}`}>{d.status}</span></td>
                        <td className="px-4 py-4 text-xs text-[#9CA3AF]">{fmtDate(d.date)}</td>
                      </tr>
                    ))}
                    {filteredDemandes.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-[#9CA3AF] text-sm">Aucune demande pour ce filtre.</td></tr>}
                  </tbody>
                </table>
              </div></div>
            )}
          </div>
        ))}

        {/* ══ OFFRES ══ */}
        {tab === "offres" && (!ok("offres") ? <AccessDenied label="Offres & Recrutements" /> : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#1D4E5B]" style={{ fontFamily: "var(--font-body)" }}>Offres & recrutements publiés</h2>
              <Link to="/publier-offre" className="flex items-center gap-2 px-5 py-3 bg-[#F26522] text-white rounded-xl font-bold text-sm hover:bg-[#C84E10] transition-colors shadow-md">+ Nouvelle offre</Link>
            </div>
            {offres.loading && !offres.data ? <Spinner /> : (
              <div className="flex flex-col gap-4">
                {(offres.data ?? []).map((o) => (
                  <div key={o.id} className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-6 hover:border-[#1D4E5B] transition-all">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2"><span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${statusBadge[o.status]}`}>{o.status}</span><span className="text-xs text-[#9CA3AF]">#{String(o.id).padStart(3, "0")} · {fmtDate(o.date)}</span></div>
                        <h3 className="font-bold text-[#1D4E5B] text-base mb-1" style={{ fontFamily: "var(--font-body)" }}>{o.titre}</h3>
                        <div className="flex flex-wrap gap-3 text-xs text-[#6B7280]"><span><I e="🏢" /> {o.entreprise}</span><span><I e="📍" /> {o.commune}</span><span><I e="💼" /> {o.secteur}</span><span><I e="📄" /> {o.contrat}</span><span className="font-bold text-[#F26522]"><I e="💰" /> {o.budget}</span></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center"><p className="text-3xl font-black text-[#1D4E5B]" style={{ fontFamily: "var(--font-display)" }}>{o.candidatures}</p><p className="text-xs text-[#9CA3AF] font-semibold">candidatures</p></div>
                        {can(session, "action:offres") && o.status === "Active" && <button onClick={() => closeOffer(o)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">Clôturer</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* ══ STATS ══ */}
        {tab === "stats" && (!ok("stats") ? <AccessDenied label="Statistiques" /> : !stats.data ? <Spinner /> : (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-[#1D4E5B]" style={{ fontFamily: "var(--font-body)" }}>Statistiques de la plateforme</h2>
            <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] p-6">
              <h3 className="font-bold text-[#1D4E5B] mb-1" style={{ fontFamily: "var(--font-body)" }}><I e="📈" /> Croissance mensuelle</h3>
              <p className="text-xs text-[#9CA3AF] mb-6">Nouveaux inscrits · Demandes · Revenus (×1000 FCFA)</p>
              <div className="flex items-end gap-4 h-48">
                {monthly.map((m) => (
                  <div key={m.ym} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-end gap-1 h-36">
                      <div className="flex-1 bg-[#1D4E5B] rounded-t-lg" style={{ height: `${(m.users / maxUsers) * 100}%` }} title={`${m.users} inscrits`} />
                      <div className="flex-1 bg-[#F26522] rounded-t-lg" style={{ height: `${(m.missions / maxMissions) * 100}%` }} title={`${m.missions} demandes`} />
                      <div className="flex-1 bg-[#B0D4DC] rounded-t-lg" style={{ height: `${(m.revenus / maxRevenu) * 100}%` }} title={fmtFcfa(m.revenus)} />
                    </div>
                    <p className="text-xs font-bold text-[#6B7280]">{monthLabel(m.ym)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#E8F2F5]">
                {[["#1D4E5B", "Inscrits"], ["#F26522", "Demandes"], ["#B0D4DC", "Revenus ×1000 FCFA"]].map(([c, l]) => <span key={l} className="flex items-center gap-1.5 text-xs text-[#6B7280] font-semibold"><span className="w-3 h-3 rounded" style={{ background: c }} />{l}</span>)}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] p-6">
                <h3 className="font-bold text-[#1D4E5B] mb-4" style={{ fontFamily: "var(--font-body)" }}><I e="🛠️" /> Répartition par métier</h3>
                <div className="flex flex-col gap-3">
                  {(overview.data?.byMetier ?? []).map((m, i) => (
                    <div key={m.metier}>
                      <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-[#3D3D3D] flex items-center gap-1.5"><span className={`font-black ${i < 3 ? "text-amber-500" : "text-[#9CA3AF]"}`}>#{i + 1}</span>{m.metier}</span><span className="text-[#1D4E5B]">{m.count} <span className="text-[#9CA3AF] font-normal">({m.pct}%)</span></span></div>
                      <div className="h-2 bg-[#E8F2F5] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#F26522] to-[#C84E10] rounded-full" style={{ width: `${m.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] p-6">
                <h3 className="font-bold text-[#1D4E5B] mb-4" style={{ fontFamily: "var(--font-body)" }}><I e="💰" /> Revenus mensuels (commission 8 %)</h3>
                <div className="flex flex-col gap-3">
                  {[...monthly].reverse().map((m) => (
                    <div key={m.ym} className="flex justify-between items-center py-2.5 border-b border-[#F4F8F9]"><span className="text-sm text-[#6B7280]">{monthLabel(m.ym)} {m.ym.slice(0, 4)}</span><p className="text-sm font-bold text-[#1D4E5B]">{fmtFcfa(m.revenus)}</p></div>
                  ))}
                  <div className="flex justify-between items-center border-t-2 border-[#E8F2F5] mt-1 pt-4"><span className="text-sm text-[#6B7280]">Total période</span><p className="text-base font-bold text-[#F26522]">{fmtFcfa(stats.data.total)}</p></div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* ══ AUDIT ══ */}
        {tab === "audit" && (!ok("audit") ? <AccessDenied label="Journal d'audit" /> : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div><h2 className="text-2xl font-bold text-[#1D4E5B]" style={{ fontFamily: "var(--font-body)" }}>Journal d'audit</h2><p className="text-sm text-[#6B7280] mt-0.5">Toutes les actions critiques sont enregistrées de façon immuable.</p></div>
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold bg-green-50 border border-green-200 px-3 py-2 rounded-xl"><span className="w-2 h-2 bg-green-400 rounded-full" />Enregistrement actif</span>
            </div>
            {!audit.data ? <Spinner /> : (
              <div className="bg-white rounded-2xl border-2 border-[#E8F2F5] overflow-hidden"><div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-[#F4F8F9] border-b-2 border-[#E8F2F5]"><tr>{["Horodatage", "Admin", "Action", "Cible", "Sévérité", "IP"].map((h) => <H key={h}>{h}</H>)}</tr></thead>
                  <tbody>
                    {audit.data.map((e, i) => (
                      <tr key={e.id} className={`hover:bg-[#F4F8F9] transition-colors ${i < audit.data!.length - 1 ? "border-b border-[#E8F2F5]" : ""}`}>
                        <td className="px-5 py-4 text-xs text-[#9CA3AF] font-mono whitespace-nowrap">{fmtDate(e.timestamp, true)}</td>
                        <td className="px-5 py-4"><p className="text-sm font-bold text-[#1D4E5B]">{e.adminName}</p></td>
                        <td className="px-5 py-4"><code className="text-xs bg-[#F4F8F9] text-[#1D4E5B] font-mono px-2 py-1 rounded-lg font-bold">{e.action}</code></td>
                        <td className="px-5 py-4 text-sm text-[#6B7280] max-w-[240px] truncate">{e.target}</td>
                        <td className="px-5 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${severityBadge[e.severity]}`}>{e.severity === "info" ? <Rich text={"ℹ️ Info"} /> : e.severity === "warning" ? <Rich text={"⚠️ Alerte"} /> : <Rich text={"🚨 Critique"} />}</span></td>
                        <td className="px-5 py-4 text-xs text-[#9CA3AF] font-mono">{e.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></div>
            )}
          </div>
        ))}
      </div>

      {/* ══ MODAL D'INSPECTION UTILISATEUR (SUPER ADMIN) ══ */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-3xl max-w-lg w-full border-2 border-[#E8F2F5] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#0E2A31] text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white font-black text-2xl border border-white/20">
                  {selectedUser.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-white">{selectedUser.name}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${selectedUser.type === "Artisan" ? "bg-amber-400 text-amber-950 border-amber-300" : "bg-blue-400 text-blue-950 border-blue-300"}`}>
                      {selectedUser.type}
                    </span>
                    {selectedUser.verified && (
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <I e="✓" /> Vérifié
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8FAFB7] mt-1">Identifiant #{selectedUser.id} · Inscrit le {fmtDate(selectedUser.inscription)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-white/60 hover:text-white text-xl p-1 rounded-lg transition-colors leading-none cursor-pointer"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[#F4F8F9] p-3 rounded-xl border border-[#E8F2F5]">
                  <span className="text-xs text-[#6B7280] block font-semibold mb-0.5">Téléphone</span>
                  <span className="font-bold text-[#1D4E5B] font-mono">+{selectedUser.phone}</span>
                </div>
                <div className="bg-[#F4F8F9] p-3 rounded-xl border border-[#E8F2F5]">
                  <span className="text-xs text-[#6B7280] block font-semibold mb-0.5">Email</span>
                  <span className="font-bold text-[#1D4E5B] truncate block text-xs">{selectedUser.email || "Non renseigné"}</span>
                </div>
                <div className="bg-[#F4F8F9] p-3 rounded-xl border border-[#E8F2F5]">
                  <span className="text-xs text-[#6B7280] block font-semibold mb-0.5">Commune</span>
                  <span className="font-bold text-[#1D4E5B] text-xs">📍 {selectedUser.commune || "Non spécifiée"}</span>
                </div>
                <div className="bg-[#F4F8F9] p-3 rounded-xl border border-[#E8F2F5]">
                  <span className="text-xs text-[#6B7280] block font-semibold mb-0.5">Statut du compte</span>
                  <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-bold border mt-0.5 ${statusBadge[selectedUser.status]}`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>

              {selectedUser.type === "Artisan" && (
                <div className="border-t border-[#E8F2F5] pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D4E5B]">Profil Artisan Professionnel</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[11px] text-amber-700 block font-semibold">Métier</span>
                      <span className="font-bold text-[#1D4E5B] text-xs truncate block">{selectedUser.metier}</span>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[11px] text-amber-700 block font-semibold">Missions</span>
                      <span className="font-bold text-[#1D4E5B] text-xs">{selectedUser.missions}</span>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[11px] text-amber-700 block font-semibold">Tarif indicatif</span>
                      <span className="font-bold text-[#1D4E5B] text-xs truncate block">{selectedUser.price || "Sur devis"}</span>
                    </div>
                  </div>

                  {(selectedUser.diplome || selectedUser.certification) && (
                    <div className="bg-[#F4F8F9] p-3 rounded-xl text-xs space-y-1.5 border border-[#E8F2F5]">
                      {selectedUser.diplome && <p><strong className="text-[#1D4E5B]">Diplôme :</strong> {selectedUser.diplome}</p>}
                      {selectedUser.certification && <p><strong className="text-[#1D4E5B]">Certification :</strong> {selectedUser.certification}</p>}
                    </div>
                  )}

                  {selectedUser.bio && (
                    <div className="bg-[#F4F8F9] p-3 rounded-xl text-xs text-[#6B7280] italic border border-[#E8F2F5]">
                      « {selectedUser.bio} »
                    </div>
                  )}

                  <div className="pt-2">
                    <a
                      href={`/artisan/${selectedUser.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-[#E8F2F5] hover:bg-[#D4E6EB] text-[#1D4E5B] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-[#C4CDD0]"
                    >
                      <span>Ouvrir la fiche publique dans un nouvel onglet</span>
                      <span className="text-sm">↗</span>
                    </a>
                  </div>
                </div>
              )}

              {can(session, "action:users") && (
                <div className="border-t border-[#E8F2F5] pt-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D4E5B]">Actions administratives</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleVerifyUser(selectedUser)}
                      disabled={inspectLoading}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        selectedUser.verified
                          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      }`}
                    >
                      {selectedUser.verified ? "✕ Retirer certification" : "✓ Marquer comme vérifié"}
                    </button>

                    {selectedUser.status === "Actif" ? (
                      <button
                        type="button"
                        onClick={() => userAction(selectedUser, "Suspendu")}
                        disabled={inspectLoading}
                        className="flex-1 py-2.5 px-3 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Suspendre le compte
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => userAction(selectedUser, "Actif")}
                        disabled={inspectLoading}
                        className="flex-1 py-2.5 px-3 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {selectedUser.status === "En attente" ? "Approuver le compte" : "Réactiver le compte"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#F4F8F9] px-6 py-4 flex justify-end border-t border-[#E8F2F5]">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2 bg-white border border-[#C4CDD0] text-[#1D4E5B] font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
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
