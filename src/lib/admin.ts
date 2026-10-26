import { api, adminToken } from "./api";

export type AdminRole = "Super Admin" | "Modérateur" | "Analyste";
export interface AdminSession {
  user: { id: number; username: string; displayName: string; role: AdminRole; avatar: string };
  permissions: string[];
  ip: string;
  issuedAt: number;
}
export interface AuditEntry {
  id: number; timestamp: string; adminId: number | null; adminName: string; action: string; target: string;
  severity: "info" | "warning" | "critical"; ip: string | null;
}

export const can = (s: AdminSession, perm: string) => s.permissions.includes(perm);

export function validatePassword(pwd: string) {
  const errors: string[] = [];
  if (pwd.length < 10) errors.push("10 caractères minimum");
  if (!/[A-Z]/.test(pwd)) errors.push("1 majuscule requise");
  if (!/[a-z]/.test(pwd)) errors.push("1 minuscule requise");
  if (!/\d/.test(pwd)) errors.push("1 chiffre requis");
  if (!/[^A-Za-z0-9]/.test(pwd)) errors.push("1 caractère spécial requis");
  return { ok: errors.length === 0, errors };
}

export async function adminLogout() {
  try { await api.post("/admin/logout", {}, "admin"); } catch { /* session déjà expirée */ }
  adminToken.clear();
}
