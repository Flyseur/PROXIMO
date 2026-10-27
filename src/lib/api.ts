// Client HTTP typé pour l'API Proximo CI.
const USER_KEY = "prx_token";
const ADMIN_KEY = "prx_admin_token"; // sessionStorage : effacé à la fermeture de l'onglet

export const userToken = {
  get: () => localStorage.getItem(USER_KEY),
  set: (t: string) => localStorage.setItem(USER_KEY, t),
  clear: () => localStorage.removeItem(USER_KEY),
};
export const adminToken = {
  get: () => {
    try {
      return sessionStorage.getItem(ADMIN_KEY) || localStorage.getItem(ADMIN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      sessionStorage.setItem(ADMIN_KEY, t);
      localStorage.setItem(ADMIN_KEY, t);
    } catch {}
  },
  clear: () => {
    try {
      sessionStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(ADMIN_KEY);
    } catch {}
  },
};

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Auth = "user" | "admin" | false;

async function request<T>(method: string, url: string, body?: unknown, auth: Auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const token = auth === "user" ? userToken.get() : auth === "admin" ? adminToken.get() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`/api${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur. Vérifiez votre connexion.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Une erreur est survenue.", data);
  return data as T;
}

export const api = {
  get: <T,>(url: string, auth: Auth = false) => request<T>("GET", url, undefined, auth),
  post: <T,>(url: string, body?: unknown, auth: Auth = false) => request<T>("POST", url, body ?? {}, auth),
  patch: <T,>(url: string, body?: unknown, auth: Auth = false) => request<T>("PATCH", url, body ?? {}, auth),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Artisan {
  id: number; name: string; trade: string; commune: string; rating: number; reviews: number;
  price: string; available: boolean; img: string; tags: string[]; phone: string; verified: boolean;
}
export interface ArtisanDetail extends Artisan {
  zone: string | null; bio: string | null; years: number | null; missions: number; memberSince: number;
  specialties: string[]; zones: string[]; priceNumber: string; priceUnit: string;
  reviewsList: { name: string; rating: number; text: string; date: string }[];
  portfolio: string[];
}
export interface ServiceItem { icon: string; label: string; slug: string; count: number; avg: string; img: string }
export interface ServiceSection { id: string; title: string; desc: string; services: ServiceItem[] }
export interface SpecialPage { icon: string; label: string; slug: string; desc: string; color: string }
export interface ServiceDetail {
  slug: string; icon: string; title: string; desc: string; longDesc: string; img: string; avgPrice: string; tasks: string[]; pros: Artisan[];
}
export interface AuthChallenge { challengeId: string; maskedPhone: string; devCode?: string }
export interface PublicUser {
  id: number; role: "artisan" | "client"; firstName: string; lastName: string; phone: string; email: string | null;
  commune: string | null; status: "Actif" | "En attente" | "Suspendu"; verified: boolean;
}

export const COMMUNES = ["Cocody", "Yopougon", "Plateau", "Abobo", "Marcory", "Koumassi", "Treichville", "Adjamé", "Attécoubé", "Port-Bouët"];

export const METIERS = [
  "Menuisier", "Électricien", "Plombier", "Peintre", "Maçon", "Jardinier",
  "Toiturier", "Climatiseur", "Coiffeur/Coiffeuse", "Mécanicien", "Carrossier",
  "Nounou / Garde d'enfants", "Chauffeur", "Agent de nettoyage",
  "Serveur/Serveuse", "Cuisinier/Cuisinière", "Photographe", "Autre"
];

export function formatPhone(p: string) {
  return p.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5 $6");
}
export function fmtDate(iso: string, withTime = false) {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }) +
    (withTime ? " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }) : "");
}
export function fmtFcfa(n: number | null | undefined) {
  return n == null ? "—" : `${n.toLocaleString("fr-FR")} FCFA`;
}

export interface PaymentRecord {
  id: number;
  request_id: number;
  operator: "wave" | "orange_money" | "mtn_momo";
  phone: string;
  amount: number;
  fee: number;
  reference: string;
  status: string;
  customer_name: string;
  created_at: string;
  request_title?: string;
}

export interface PaymentReceipt {
  reference: string;
  amount: number;
  operator: string;
  phone: string;
  customerName: string;
  status: string;
  date: string;
  request: { id: number; title: string; category: string; commune: string } | null;
  artisan: { name: string; trade: string; phone: string; commune: string } | null;
}
