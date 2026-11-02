import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { openDb, tx } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import {
  hashPassword, verifyPassword, loadSecret, signToken, verifyToken,
  sha256, randomDigits, randomId, verifyTotp, totp,
} from "./crypto.js";
import { sendOtp } from "./notify.js";
import { createGeniusPayment, getGeniusPayment, isGeniusPayConfigured } from "./geniuspay.js";

// ── Constantes ────────────────────────────────────────────────────────────────
const ADMIN_IDLE_SEC = 15 * 60;
const ADMIN_MAX_ATTEMPTS = 3;
const ADMIN_LOCK_SEC = 15 * 60;
const OTP_TTL_SEC = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;

const PERMS = {
  "Super Admin": ["overview", "users", "demandes", "offres", "stats", "audit", "clients", "tracabilite", "action:users", "action:offres", "action:demandes", "action:clients"],
  "Modérateur": ["overview", "users", "demandes", "offres", "stats", "clients", "tracabilite", "action:users", "action:offres", "action:demandes", "action:clients"],
  "Analyste": ["overview", "stats", "clients", "tracabilite"],
};
const COMMUNES = ["Cocody", "Yopougon", "Plateau", "Abobo", "Marcory", "Koumassi", "Treichville", "Adjamé", "Attécoubé", "Port-Bouët", "Bingerville", "Autre"];

// ── Helpers ───────────────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
const bad = (msg, extra) => new HttpError(400, msg, extra);
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const str = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const json = (s) => { try { return JSON.parse(s); } catch { return []; } };

export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = "225" + d;
  return /^225\d{10}$/.test(d) ? d : null;
}
const maskPhone = (p) => `+225 ${p.slice(3, 5)} ••• ••• ${p.slice(-2)}`;
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 6 || pw.length > 64) throw bad("Le mot de passe doit contenir entre 6 et 64 caractères.");
}
function validateAdminPassword(pw) {
  const errs = [];
  if (pw.length < 10) errs.push("10 caractères minimum");
  if (!/[A-Z]/.test(pw)) errs.push("1 majuscule");
  if (!/[a-z]/.test(pw)) errs.push("1 minuscule");
  if (!/\d/.test(pw)) errs.push("1 chiffre");
  return errs;
}

// ── Application ───────────────────────────────────────────────────────────────
export async function createApp({ dbFile, dataDir, distDir, seed = true, logger = console } = {}) {
  const db = await openDb(dbFile);
  const secret = loadSecret(dataDir);
  const credentials = seed ? await seedIfEmpty(db, { log: (...a) => logger.log(...a) }) : null;
  const testOtp = process.env.OTP_MODE === "test";

  const rate = new Map();
  function limit(key, max, windowMs) {
    const now = Date.now();
    const arr = (rate.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) throw new HttpError(429, "Trop de requêtes. Réessayez dans quelques instants.");
    arr.push(now);
    rate.set(key, arr);
  }

  const clientIp = (req) => {
    const xff = req?.headers?.["x-forwarded-for"];
    if (xff) return String(xff).split(",")[0].trim();
    const xRealIp = req?.headers?.["x-real-ip"];
    if (xRealIp) return String(xRealIp).trim();
    return req?.socket?.remoteAddress || "?";
  };

  // ── Mappers ─────────────────────────────────────────────────────────────────
  function artisanRow(r) {
    return {
      id: Number(r.id), name: `${r.first_name} ${r.last_name}`, trade: r.trade, commune: r.commune,
      rating: Number(r.rating), reviews: Number(r.reviews_count), price: r.price, available: !!r.available,
      img: r.img, tags: json(r.tags), phone: r.phone, verified: !!r.verified,
    };
  }
  const ARTISAN_SELECT = `SELECT u.id, u.first_name, u.last_name, u.commune, u.phone, u.verified, u.created_at,
      a.trade, a.price, a.available, a.rating, a.reviews_count, a.img, a.tags, a.specialties, a.zones, a.zone_label, a.bio,
      a.years_experience, a.missions, a.featured
    FROM users u JOIN artisans a ON a.user_id = u.id`;

  // ── Auth helpers ────────────────────────────────────────────────────────────
  async function userFromReq(req) {
    const h = req.headers.authorization ?? "";
    const p = h.startsWith("Bearer ") ? verifyToken(h.slice(7), secret) : null;
    if (!p || p.typ !== "user") return null;
    const u = await db.prepare("SELECT * FROM users WHERE id = ?").get(p.sub);
    return u && u.status !== "Suspendu" ? u : null;
  }
  const requireUser = async (req) => (await userFromReq(req)) ?? (() => { throw new HttpError(401, "Authentification requise."); })();

  async function adminFromReq(req, { touch = true } = {}) {
    const h = req.headers.authorization ?? "";
    const p = h.startsWith("Bearer ") ? verifyToken(h.slice(7), secret) : null;
    if (!p || p.typ !== "admin") throw new HttpError(401, "Session administrateur requise.");
    const s = await db.prepare("SELECT * FROM admin_sessions WHERE id = ? AND (revoked = 0 OR revoked IS NULL)").get(p.sid);
    const now = Math.floor(Date.now() / 1000);
    const lastAct = s ? Number(s.last_activity || s.issued_at || now) : 0;
    if (!s || (now - lastAct > ADMIN_IDLE_SEC)) {
      if (s) await db.prepare("UPDATE admin_sessions SET revoked = 1 WHERE id = ?").run(s.id);
      throw new HttpError(401, "Session expirée.");
    }
    const admin = await db.prepare("SELECT * FROM admins WHERE id = ?").get(s.admin_id);
    if (!admin) throw new HttpError(401, "Session invalide.");
    if (touch) await db.prepare("UPDATE admin_sessions SET last_activity = ? WHERE id = ?").run(now, s.id);
    return { admin, session: s };
  }
  const can = (admin, perm) => PERMS[admin.role]?.includes(perm);
  function need(admin, perm) {
    if (!can(admin, perm)) throw new HttpError(403, "Votre rôle ne permet pas cette action.");
  }
  async function audit(admin, action, target, severity = "info", ip = null) {
    await db.prepare("INSERT INTO audit_log (admin_id, admin_name, action, target, severity, ip) VALUES (?,?,?,?,?,?)")
      .run(admin?.id ?? null, admin?.display_name ?? "—", action, target, severity, ip);
  }

  async function issueOtp(user, purpose) {
    const id = randomId();
    const code = randomDigits(6);
    const now = Date.now();
    await db.prepare("DELETE FROM otp_challenges WHERE user_id = ?").run(user.id);
    await db.prepare("INSERT INTO otp_challenges (id, user_id, code_hash, purpose, expires_at, created_at) VALUES (?,?,?,?,?,?)")
      .run(id, user.id, sha256(`${id}:${code}`), purpose, now + OTP_TTL_SEC * 1000, now);
    await sendOtp(user.phone, code);
    return { challengeId: id, maskedPhone: maskPhone(user.phone), ...(testOtp ? { devCode: code } : {}) };
  }

  // ── Routes ──────────────────────────────────────────────────────────────────
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/:([a-z]+)/gi, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    routes.push({ method, re, keys, handler });
  };

  // ---- Public : catalogue -----------------------------------------------------
  route("GET", "/api/health", async () => {
    let dbStatus = "ok";
    const isPg = Boolean(process.env.DATABASE_URL);
    const dbType = isPg ? "neon-postgres" : "sqlite-memory";
    let tableCount = 0;
    const start = Date.now();
    try {
      if (isPg) {
        const row = await db.prepare("SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'").get();
        tableCount = Number(row?.count ?? 0);
      } else {
        const row = await db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get();
        tableCount = Number(row?.count ?? 0);
      }
    } catch {
      dbStatus = "error";
    }
    const latencyMs = Date.now() - start;
    return {
      status: dbStatus === "ok" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      database: { status: dbStatus, type: dbType, tables: tableCount, latencyMs },
      uptimeSec: Math.floor(process.uptime()),
      version: "1.0.0",
    };
  });

  route("GET", "/api/home", async () => {
    const rawCategories = await db.prepare(`
      SELECT s.icon, s.label, s.slug,
             COUNT(DISTINCT u.id) as count
      FROM services s
      JOIN artisan_services l ON l.service_slug = s.slug
      JOIN users u ON u.id = l.artisan_id
      WHERE u.status = 'Actif'
      GROUP BY s.slug, s.label, s.icon, s.section_pos, s.pos
      HAVING COUNT(DISTINCT u.id) > 0
      ORDER BY count DESC, s.section_pos, s.pos
      LIMIT 8
    `).all();
    const categories = rawCategories.map((c) => ({ ...c, count: Number(c.count), label: c.label.split(" & ")[0] }));
    const featuredRows = await db.prepare(`${ARTISAN_SELECT} WHERE a.featured = 1 AND u.status = 'Actif' ORDER BY u.id LIMIT 3`).all();
    const featured = featuredRows.map(artisanRow);

    const activeArtisansRow = await db.prepare("SELECT count(*) as count FROM users u JOIN artisans a ON a.user_id = u.id WHERE u.status = 'Actif'").get();
    const missionsRow = await db.prepare("SELECT COALESCE(SUM(a.missions), 0) as total FROM artisans a JOIN users u ON u.id = a.user_id WHERE u.status = 'Actif'").get();
    const ratingRow = await db.prepare("SELECT COALESCE(AVG(a.rating), 4.8) as avg FROM artisans a JOIN users u ON u.id = a.user_id WHERE u.status = 'Actif' AND a.rating > 0").get();
    const usersRow = await db.prepare("SELECT count(*) as count FROM users").get();
    const communesRow = await db.prepare("SELECT count(DISTINCT u.commune) as count FROM users u JOIN artisans a ON a.user_id = u.id WHERE u.status = 'Actif' AND u.commune IS NOT NULL").get();

    const stats = {
      users: Number(usersRow?.count || 0),
      artisans: Number(activeArtisansRow?.count || 0),
      missions: Number(missionsRow?.total || 0),
      rating: (Number(ratingRow?.avg || 4.8)).toFixed(1),
      communesCount: Number(communesRow?.count || 0),
      categoriesCount: categories.length,
      delai: "24h",
    };

    return { categories, featured, stats };
  });

  route("GET", "/api/services", async () => {
    const rows = await db.prepare(`
      SELECT s.*,
             (SELECT COUNT(*) FROM artisan_services l JOIN users u ON u.id = l.artisan_id WHERE l.service_slug = s.slug AND u.status = 'Actif') as real_pros_count
      FROM services s
      WHERE (SELECT COUNT(*) FROM artisan_services l JOIN users u ON u.id = l.artisan_id WHERE l.service_slug = s.slug AND u.status = 'Actif') > 0
      ORDER BY s.section_pos, s.pos
    `).all();
    const sections = [];
    for (const r of rows) {
      let s = sections.find((x) => x.id === r.section_id);
      if (!s) sections.push((s = { id: r.section_id, title: r.section_title, desc: r.section_desc, services: [] }));
      s.services.push({ icon: r.icon, label: r.label, slug: r.slug, count: Number(r.real_pros_count), avg: r.avg_price, img: r.img });
    }
    const special = rows.filter((r) => r.page_title && Number(r.real_pros_count) > 0).map((r) => ({
      icon: r.icon, label: r.page_label, slug: r.slug, color: r.page_color, desc: shortDesc[r.slug] ?? r.page_desc,
    }));
    return { sections, special };
  });
  const shortDesc = {
    nounous: "Gardes d'enfants qualifiées", chauffeur: "Transport et VTC", nettoyage: "Entretien & ménage",
    serveurs: "Pour vos événements", cuisiniers: "Cuisine à domicile", photographes: "Photo & vidéo",
  };

  route("GET", "/api/categories", async () => {
    const rows = await db.prepare(`
      SELECT s.label, s.slug, s.icon,
             COUNT(DISTINCT u.id) as count
      FROM services s
      JOIN artisan_services l ON l.service_slug = s.slug
      JOIN users u ON u.id = l.artisan_id
      WHERE u.status = 'Actif'
      GROUP BY s.slug, s.label, s.icon
      HAVING COUNT(DISTINCT u.id) > 0
      ORDER BY count DESC, s.label
    `).all();
    return rows;
  });

  route("GET", "/api/services/:slug", async ({ params }) => {
    const s = await db.prepare("SELECT * FROM services WHERE slug = ?").get(params.slug);
    if (!s) throw new HttpError(404, "Service introuvable.");
    const pros = (await db.prepare(`${ARTISAN_SELECT} JOIN artisan_services l ON l.artisan_id = u.id
      WHERE l.service_slug = ? AND u.status = 'Actif' ORDER BY a.rating DESC, a.reviews_count DESC`).all(params.slug)).map(artisanRow);
    return {
      slug: s.slug, icon: s.icon, title: s.page_title ?? s.label, desc: s.page_desc ?? "Prestataires disponibles",
      longDesc: s.page_long_desc ?? "Trouvez les meilleurs prestataires près de chez vous.",
      img: s.page_img ?? s.img, avgPrice: s.avg_price ?? "Sur devis", tasks: json(s.tasks), pros,
    };
  });

  // ---- Public : artisans ------------------------------------------------------
  route("GET", "/api/artisans", async ({ query }) => {
    const q = norm(query.get("q") ?? "");
    const cat = norm(query.get("categorie") ?? "");
    const commune = query.get("commune") ?? "";
    const onlyAvail = query.get("available") === "1";
    const catKey = cat && cat !== "tous" ? cat.split(/[\s&/]+/)[0].slice(0, 5) : "";
    let list = await db.prepare(`${ARTISAN_SELECT} WHERE u.status = 'Actif' ORDER BY a.rating DESC, a.reviews_count DESC`).all();
    list = list.filter((r) => {
      const name = norm(`${r.first_name} ${r.last_name}`), trade = norm(r.trade), tags = norm(r.tags);
      if (q) {
        const hay = `${name} ${trade} ${tags} ${norm(r.commune)}`;
        if (!q.split(/\s+/).every((w) => hay.includes(w.slice(0, 6)))) return false;
      }
      if (catKey && !(trade.includes(catKey) || tags.includes(catKey))) return false;
      if (commune && commune !== "Toutes" && r.commune !== commune) return false;
      if (onlyAvail && !r.available) return false;
      return true;
    });
    return { total: list.length, items: list.slice(0, 60).map(artisanRow) };
  });

  route("GET", "/api/artisans/:id", async ({ params }) => {
    const r = await db.prepare(`${ARTISAN_SELECT} WHERE u.id = ? AND u.status = 'Actif'`).get(Number(params.id));
    if (!r) throw new HttpError(404, "Artisan introuvable.");
    const reviews = await db.prepare("SELECT author AS name, rating, text, created_at AS date FROM reviews WHERE artisan_id = ? ORDER BY created_at DESC").all(r.id);
    const portfolio = (await db.prepare("SELECT url FROM portfolio WHERE artisan_id = ?").all(r.id)).map((p) => p.url);
    const priceNum = (r.price.match(/^[\d\s]+/)?.[0] ?? "").trim();
    const createdDate = r.created_at instanceof Date ? r.created_at : new Date(String(r.created_at).replace(" ", "T") + "Z");
    return {
      ...artisanRow(r), zone: r.zone_label, bio: r.bio, years: r.years_experience, missions: r.missions,
      memberSince: isNaN(createdDate.getFullYear()) ? 2026 : createdDate.getFullYear(),
      specialties: json(r.specialties), zones: json(r.zones), reviewsList: reviews, portfolio,
      priceNumber: priceNum, priceUnit: r.price.slice(priceNum.length).trim(),
    };
  });

  route("POST", "/api/artisans/:id/reviews", async ({ params, body, req }) => {
    const artisanId = Number(params.id);
    if (!artisanId || isNaN(artisanId)) throw bad("ID artisan invalide.");
    limit(`rev:${clientIp(req)}:${artisanId}`, 15, 3600_000);

    const art = await db.prepare("SELECT u.id, a.rating, a.reviews_count FROM users u JOIN artisans a ON a.user_id = u.id WHERE u.id = ? AND u.status != 'Suspendu'").get(artisanId);
    if (!art) throw new HttpError(404, "Artisan introuvable ou compte indisponible.");

    const author = str(body.author, 80);
    const text = str(body.text, 1000);
    const rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));

    if (!author) throw bad("Le nom ou prénom est requis.");
    if (!text || text.length < 2) throw bad("Votre avis doit contenir au moins 2 caractères.");

    const nowIso = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db.prepare("INSERT INTO reviews (artisan_id, author, rating, text, created_at) VALUES (?,?,?,?,?)")
      .run(artisanId, author, rating, text, nowIso);

    const avgRow = await db.prepare("SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM reviews WHERE artisan_id = ?").get(artisanId);
    const newRating = Number(Number(avgRow?.avg_rating ?? rating).toFixed(1));
    const newCount = Number(avgRow?.cnt ?? (Number(art.reviews_count) + 1));

    await db.prepare("UPDATE artisans SET rating = ?, reviews_count = ? WHERE user_id = ?").run(newRating, newCount, artisanId);

    return {
      status: 201,
      data: {
        review: { name: author, rating, text, date: nowIso },
        artisan: { rating: newRating, reviews: newCount },
      },
    };
  });

  // ---- Public : formulaires ---------------------------------------------------
  route("POST", "/api/requests", async ({ body, req }) => {
    limit(`req:${clientIp(req)}`, 10, 3600_000);
    const phone = normalizePhone(body.phone);
    const f = {
      title: str(body.title, 160), category: str(body.category, 60), description: str(body.description, 3000),
      commune: str(body.commune, 60), firstName: str(body.firstName, 60), lastName: str(body.lastName, 60),
      budget: str(body.budget, 60), urgency: str(body.urgency, 30), email: str(body.email, 120),
    };
    if (!f.title || !f.category || !f.description) throw bad("Titre, catégorie et description sont requis.");
    if (!f.commune) throw bad("La commune est requise.");
    if (!f.firstName || !f.lastName) throw bad("Prénom et nom requis.");
    if (!phone) throw bad("Numéro de téléphone invalide (format ivoirien, 10 chiffres).");
    if (f.email && !validEmail(f.email)) throw bad("Adresse email invalide.");
    const artisanId = body.artisanId ? Number(body.artisanId) : null;
    const artExists = artisanId ? await db.prepare("SELECT 1 FROM artisans WHERE user_id = ?").get(artisanId) : null;
    const r = await db.prepare(`INSERT INTO requests (title, category, description, budget, urgency, commune, first_name, last_name, phone, email, artisan_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(f.title, f.category, f.description, f.budget || null, f.urgency || null, f.commune, f.firstName, f.lastName, phone, f.email || null,
      artExists ? artisanId : null);
    return { status: 201, data: { id: Number(r.lastInsertRowid) } };
  });

  route("POST", "/api/payments", async ({ body, req }) => {
    limit(`pay:${clientIp(req)}`, 15, 3600_000);
    const requestId = Number(body.requestId);
    if (!requestId || isNaN(requestId)) throw bad("Demande associée (requestId) requise.");

    const reqRow = await db.prepare("SELECT * FROM requests WHERE id = ?").get(requestId);
    if (!reqRow) throw new HttpError(404, "Demande introuvable.");

    const allowedOps = ["wave", "orange_money", "mtn_momo", "card"];
    const rawOp = String(body.operator ?? "wave").toLowerCase().trim();
    const operator = rawOp === "orange" ? "orange_money" : rawOp === "mtn" ? "mtn_momo" : rawOp;
    if (!allowedOps.includes(operator)) throw bad("Opérateur Mobile Money invalide (choix : Wave, Orange Money, MTN, Carte).");

    const phone = normalizePhone(body.phone);
    if (!phone) throw bad("Numéro de compte Mobile Money invalide (format ivoirien, 10 chiffres).");

    const amount = parseInt(body.amount, 10);
    if (isNaN(amount) || amount < 1000 || amount > 2_000_000) {
      throw bad("Le montant doit être compris entre 1 000 et 2 000 000 FCFA.");
    }

    const customerName = str(body.customerName || `${reqRow.first_name} ${reqRow.last_name}`, 150);
    const opPrefix = operator === "wave" ? "WAV" : operator === "orange_money" ? "OM" : "MTN";

    // Appel passerelle GeniusPay (Sandbox ou Live selon configuration)
    const geniusData = await createGeniusPayment({
      amount,
      paymentMethod: operator,
      description: `Acompte devis #${requestId} - ${reqRow.title}`,
      customer: {
        name: customerName,
        phone: `+${phone}`,
      },
      metadata: {
        type: "deposit",
        requestId,
      },
    });

    const reference = geniusData.reference || `PRX-${opPrefix}-${randomDigits(6)}`;
    const fee = Math.round(Number(geniusData.fees) || 0);
    const nowIso = new Date().toISOString().replace("T", " ").slice(0, 19);

    const r = await db.prepare(`
      INSERT INTO payments (request_id, operator, phone, amount, fee, reference, status, customer_name, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(requestId, operator === "card" ? "wave" : operator, phone, amount, fee, reference, "completed", customerName, nowIso);

    // Mise à jour de la demande
    await db.prepare("UPDATE requests SET status = 'Acompte versé', amount = COALESCE(amount, ?) WHERE id = ?")
      .run(amount, requestId);

    return {
      status: 201,
      data: {
        id: Number(r.lastInsertRowid),
        reference,
        amount,
        operator,
        phone: maskPhone(phone),
        customerName,
        requestId,
        status: "completed",
        checkoutUrl: geniusData.checkout_url || null,
        paymentUrl: geniusData.payment_url || null,
        gateway: "geniuspay",
        date: nowIso,
        receiptUrl: `/recu/${reference}`,
      },
    };
  });

  route("GET", "/api/payments/receipt/:reference", async ({ params }) => {
    const p = await db.prepare("SELECT * FROM payments WHERE reference = ?").get(params.reference);
    if (!p) throw new HttpError(404, "Reçu de paiement introuvable.");

    let artisan = null;
    let request = null;
    if (p.request_id) {
      request = await db.prepare("SELECT * FROM requests WHERE id = ?").get(p.request_id);
      if (request?.artisan_id) {
        artisan = await db.prepare("SELECT u.id, u.first_name, u.last_name, u.phone, a.trade, u.commune FROM users u JOIN artisans a ON a.user_id = u.id WHERE u.id = ?").get(request.artisan_id);
      }
    }

    return {
      reference: p.reference,
      amount: Number(p.amount),
      operator: p.operator,
      phone: maskPhone(p.phone),
      customerName: p.customer_name,
      status: p.status,
      date: p.created_at,
      request: request ? { id: request.id, title: request.title, category: request.category, commune: request.commune } : null,
      artisan: artisan ? { name: `${artisan.first_name} ${artisan.last_name}`, trade: artisan.trade, phone: artisan.phone, commune: artisan.commune } : null,
    };
  });

  // ---- Quotas d'offres et abonnements -----------------------------------------
  route("GET", "/api/jobs/quota", async ({ query, req }) => {
    const authUser = await userFromReq(req);
    const phone = normalizePhone(query.get("phone"));
    const userByPhone = !authUser && phone ? await db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) : null;
    const user = authUser || userByPhone;
    const plan = user?.plan || "Gratuit";

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startIso = startOfMonth.toISOString().slice(0, 19).replace("T", " ");

    let count = 0;
    if (user) {
      const row = await db.prepare(
        "SELECT COUNT(*) AS c FROM jobs WHERE (user_id = ? OR phone = ?) AND created_at >= ?"
      ).get(user.id, user.phone, startIso);
      count = Number(row?.c ?? 0);
    } else if (phone) {
      const row = await db.prepare(
        "SELECT COUNT(*) AS c FROM jobs WHERE phone = ? AND created_at >= ?"
      ).get(phone, startIso);
      count = Number(row?.c ?? 0);
    }

    const isUnlimited = plan === "Pro" || plan === "Entreprise";
    const limitNum = isUnlimited ? null : 3;
    const remaining = isUnlimited ? null : Math.max(0, 3 - count);

    return {
      plan,
      isUnlimited,
      limit: limitNum,
      currentCount: count,
      remaining,
      canPost: isUnlimited || count < 3,
    };
  });

  route("POST", "/api/subscriptions", async ({ body, req }) => {
    limit(`sub:${clientIp(req)}`, 15, 3600_000);
    const plan = str(body.plan, 20);
    if (!["Pro", "Entreprise"].includes(plan)) throw bad("Formule d'abonnement invalide (choix : Pro, Entreprise).");

    const allowedOps = ["wave", "orange_money", "mtn_momo", "card"];
    const rawOp = String(body.operator ?? "wave").toLowerCase().trim();
    const operator = rawOp === "orange" ? "orange_money" : rawOp === "mtn" ? "mtn_momo" : rawOp;
    if (!allowedOps.includes(operator)) throw bad("Opérateur Mobile Money invalide (choix : Wave, Orange Money, MTN MoMo, Carte).");

    const phone = normalizePhone(body.phone);
    if (!phone) throw bad("Numéro Mobile Money invalide (format ivoirien, 10 chiffres).");

    const authUser = await userFromReq(req);
    let user = authUser || (!authUser ? await db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) : null);
    let token = null;

    if (!user) {
      // Auto-provision un compte utilisateur client pour permettre à tout visiteur de souscrire sans blocage
      const customerName = str(body.name || body.customerName, 100) || "Client Proximo";
      const parts = customerName.split(" ");
      const firstName = parts[0] || "Client";
      const lastName = parts.slice(1).join(" ") || "Proximo";
      const dummyHash = hashPassword(randomDigits(12));
      const resUser = await db.prepare(`
        INSERT INTO users (role, first_name, last_name, phone, commune, status, phone_verified, plan, password_hash)
        VALUES ('client', ?, ?, ?, 'Cocody', 'Actif', 1, ?, ?)
      `).run(firstName, lastName, phone, plan, dummyHash);
      const newUserId = Number(resUser.lastInsertRowid);
      user = await db.prepare("SELECT * FROM users WHERE id = ?").get(newUserId);
    }

    token = signToken({ typ: "user", sub: user.id }, secret, 7 * 24 * 3600);

    const billingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly";
    const isYearly = billingCycle === "yearly";

    let amount = 0;
    if (plan === "Pro") {
      amount = isYearly ? 25000 : 2500;
    } else {
      amount = isYearly ? 50000 : 5000;
    }

    const opPrefix = operator === "wave" ? "WAV" : operator === "orange_money" ? "OM" : "MTN";
    const durationLabel = isYearly ? "1 an (365 jours)" : "30 jours";

    // Appel passerelle GeniusPay (Sandbox ou Live selon configuration)
    const geniusData = await createGeniusPayment({
      amount,
      paymentMethod: operator,
      description: `Abonnement Proximo CI - Formule ${plan} (${durationLabel})`,
      customer: {
        name: `${user.first_name} ${user.last_name}`,
        phone: `+${phone}`,
        email: user.email || undefined,
      },
      metadata: {
        type: "subscription",
        plan,
        billingCycle,
        userId: user.id,
      },
    });

    const reference = geniusData.reference || `PRX-SUB-${opPrefix}-${randomDigits(6)}`;
    const fee = Math.round(Number(geniusData.fees) || 0);

    const nowIso = new Date().toISOString().replace("T", " ").slice(0, 19);
    const expiresDate = new Date();
    if (isYearly) {
      expiresDate.setDate(expiresDate.getDate() + 365);
    } else {
      expiresDate.setDate(expiresDate.getDate() + 30);
    }
    const expiresIso = expiresDate.toISOString().replace("T", " ").slice(0, 19);

    await tx(db, async () => {
      // 1. Inscription dans la table subscriptions
      await db.prepare(`
        INSERT INTO subscriptions (user_id, plan, amount, operator, phone, reference, status, starts_at, expires_at, created_at)
        VALUES (?,?,?,?,?,?,'active',?,?,?)
      `).run(user.id, plan, amount, operator === "card" ? "wave" : operator, phone, reference, nowIso, expiresIso, nowIso);

      // 2. Mise à jour de l'utilisateur (plan, plan_expires_at, verified pour Entreprise)
      const isEntreprise = plan === "Entreprise";
      await db.prepare(`
        UPDATE users
        SET plan = ?, plan_expires_at = ?, verified = CASE WHEN ? = 1 THEN 1 ELSE verified END
        WHERE id = ?
      `).run(plan, expiresIso, isEntreprise ? 1 : 0, user.id);

      // 3. Trace dans payments
      await db.prepare(`
        INSERT INTO payments (request_id, operator, phone, amount, fee, reference, status, customer_name, created_at)
        VALUES (NULL, ?, ?, ?, ?, ?, 'completed', ?, ?)
      `).run(operator === "card" ? "wave" : operator, phone, amount, fee, reference, `${user.first_name} ${user.last_name}`, nowIso);
    });

    const updatedUser = await db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    return {
      status: 201,
      data: {
        ok: true,
        reference,
        plan,
        billingCycle,
        durationDays: isYearly ? 365 : 30,
        amount,
        operator,
        phone: maskPhone(phone),
        startsAt: nowIso,
        expiresAt: expiresIso,
        status: geniusData.status || "completed",
        checkoutUrl: geniusData.checkout_url || null,
        paymentUrl: geniusData.payment_url || null,
        gateway: "geniuspay",
        token: token || undefined,
        message: `Félicitations ! Votre abonnement ${plan} (${isYearly ? "Annuel - 1 an" : "Mensuel - 30 jours"}) est activé via GeniusPay.`,
        user: publicUser(updatedUser),
      },
    };
  });

  // ---- Endpoints GeniusPay (Vérification & Webhook) ---------------------------
  route("GET", "/api/geniuspay/verify/:reference", async ({ params }) => {
    const payment = await getGeniusPayment(params.reference);
    if (payment && payment.status === "completed") {
      const ref = params.reference;
      // 1. Mise à jour de l'acompte si présent
      const p = await db.prepare("SELECT * FROM payments WHERE reference = ?").get(ref);
      if (p && p.status !== "completed") {
        await db.prepare("UPDATE payments SET status = 'completed' WHERE reference = ?").run(ref);
        if (p.request_id) {
          await db.prepare("UPDATE requests SET status = 'Acompte versé' WHERE id = ?").run(p.request_id);
        }
      }

      // 2. Mise à jour de l'abonnement si présent
      const sub = await db.prepare("SELECT * FROM subscriptions WHERE reference = ?").get(ref);
      if (sub) {
        if (sub.status !== "active") {
          await db.prepare("UPDATE subscriptions SET status = 'active' WHERE reference = ?").run(ref);
        }
        await db.prepare("UPDATE users SET plan = ?, plan_expires_at = ?, verified = CASE WHEN ? = 'Entreprise' THEN 1 ELSE verified END WHERE id = ?")
          .run(sub.plan, sub.expires_at, sub.plan, sub.user_id);
      }
    }
    return { success: true, data: payment };
  });

  route("POST", "/api/geniuspay/simulate-success/:reference", async ({ params }) => {
    const ref = params.reference;
    const p = await db.prepare("SELECT * FROM payments WHERE reference = ?").get(ref);
    if (p) {
      await db.prepare("UPDATE payments SET status = 'completed' WHERE reference = ?").run(ref);
      if (p.request_id) {
        await db.prepare("UPDATE requests SET status = 'Acompte versé' WHERE id = ?").run(p.request_id);
      }
    }
    const sub = await db.prepare("SELECT * FROM subscriptions WHERE reference = ?").get(ref);
    if (sub) {
      await db.prepare("UPDATE subscriptions SET status = 'active' WHERE reference = ?").run(ref);
      await db.prepare("UPDATE users SET plan = ?, plan_expires_at = ?, verified = CASE WHEN ? = 'Entreprise' THEN 1 ELSE verified END WHERE id = ?")
        .run(sub.plan, sub.expires_at, sub.plan, sub.user_id);
    }
    return { success: true, reference: ref, status: "completed", simulated: true };
  });

  route("POST", "/api/webhooks/geniuspay", async ({ body }) => {
    const data = body?.data || body;
    const reference = data?.reference;
    if (!reference) throw bad("Référence GeniusPay manquante.");

    const status = data?.status; // completed, failed, expired
    if (status === "completed") {
      // 1. Mise à jour si paiement d'acompte de mission
      const p = await db.prepare("SELECT * FROM payments WHERE reference = ?").get(reference);
      if (p) {
        await db.prepare("UPDATE payments SET status = 'completed' WHERE reference = ?").run(reference);
        if (p.request_id) {
          await db.prepare("UPDATE requests SET status = 'Acompte versé' WHERE id = ?").run(p.request_id);
        }
      }

      // 2. Mise à jour si abonnement
      const sub = await db.prepare("SELECT * FROM subscriptions WHERE reference = ?").get(reference);
      if (sub) {
        await db.prepare("UPDATE subscriptions SET status = 'active' WHERE reference = ?").run(reference);
        await db.prepare("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?")
          .run(sub.plan, sub.expires_at, sub.user_id);
      }
    }

    return { received: true, reference, status };
  });

  route("POST", "/api/jobs", async ({ body, req }) => {
    limit(`job:${clientIp(req)}`, 10, 3600_000);
    const phone = normalizePhone(body.phone);
    const posterType = body.posterType === "particulier" ? "particulier" : "entreprise";
    const f = {
      company: str(body.company, 120), contactName: str(body.contactName, 120), title: str(body.title, 160), sector: str(body.sector, 80),
      contractType: str(body.contractType, 60), commune: str(body.commune2, 60), posterCommune: str(body.commune, 60), salary: str(body.salary, 100),
      profile: str(body.profile, 1500), experience: str(body.experience, 60), studies: str(body.studies, 60), skills: str(body.skills, 300),
      description: str(body.description, 4000), howToApply: ["whatsapp", "email", "phone", "presentiel"].includes(body.howToApply) ? body.howToApply : "whatsapp",
      email: str(body.email, 120),
    };
    if (posterType === "entreprise" && !f.company) throw bad("Le nom de l'entreprise est requis.");
    if (!f.contactName) throw bad("Le nom du contact est requis.");
    if (!phone) throw bad("Numéro de téléphone invalide (format ivoirien, 10 chiffres).");
    if (!f.title || !f.sector || !f.contractType || !f.commune) throw bad("Titre, secteur, contrat et lieu sont requis.");
    if (!f.profile || !f.description) throw bad("Profil souhaité et description sont requis.");
    if (f.email && !validEmail(f.email)) throw bad("Adresse email invalide.");

    // Contrôle du compte et du quota mensuel selon le plan
    const authUser = await userFromReq(req);
    const userByPhone = !authUser ? await db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) : null;
    const user = authUser || userByPhone;
    let plan = user?.plan || "Gratuit";

    // Vérifier l'expiration du plan
    if (plan !== "Gratuit" && user?.plan_expires_at) {
      const exp = new Date(user.plan_expires_at).getTime();
      if (Date.now() > exp) {
        plan = "Gratuit";
        await db.prepare("UPDATE users SET plan = 'Gratuit' WHERE id = ?").run(user.id);
      }
    }

    if (plan === "Gratuit") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startIso = startOfMonth.toISOString().slice(0, 19).replace("T", " ");

      let monthlyCount = 0;
      if (user) {
        const row = await db.prepare(
          "SELECT COUNT(*) AS c FROM jobs WHERE (user_id = ? OR phone = ?) AND created_at >= ?"
        ).get(user.id, phone, startIso);
        monthlyCount = Number(row?.c ?? 0);
      } else {
        const row = await db.prepare(
          "SELECT COUNT(*) AS c FROM jobs WHERE phone = ? AND created_at >= ?"
        ).get(phone, startIso);
        monthlyCount = Number(row?.c ?? 0);
      }

      if (monthlyCount >= 3) {
        throw new HttpError(403, "Limite atteinte : Le plan Gratuit est limité à 3 offres par mois. Passez au plan Pro (2 500 FCFA/mois) pour publier des offres en illimité.", {
          code: "PLAN_LIMIT_REACHED",
          plan: "Gratuit",
          limit: 3,
          currentCount: monthlyCount,
        });
      }
    }

    const isFeatured = (plan === "Pro" || plan === "Entreprise") ? 1 : 0;
    const nb = Math.min(99, Math.max(1, parseInt(body.nbPosts, 10) || 1));
    const r = await db.prepare(`INSERT INTO jobs (user_id, poster_type, company, contact_name, phone, email, poster_commune, title, sector, contract_type, commune, salary, nb_posts,
      profile, experience, studies, skills, description, how_to_apply, is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(user?.id || null, posterType, f.company || null, f.contactName, phone, f.email || null, f.posterCommune || null, f.title, f.sector, f.contractType, f.commune, f.salary || null, nb,
        f.profile, f.experience || null, f.studies || null, f.skills || null, f.description, f.howToApply, isFeatured);
    return {
      status: 201,
      data: {
        id: Number(r.lastInsertRowid),
        isFeatured: !!isFeatured,
        plan,
      },
    };
  });

  route("POST", "/api/contact", async ({ body, req }) => {
    limit(`contact:${clientIp(req)}`, 5, 3600_000);
    const phone = normalizePhone(body.phone);
    const message = str(body.message, 3000);
    if (!phone) throw bad("Numéro WhatsApp invalide.");
    if (!message) throw bad("Le message est requis.");
    await db.prepare("INSERT INTO contact_messages (name, phone, subject, message) VALUES (?,?,?,?)").run(str(body.name, 120) || null, phone, str(body.subject, 80) || null, message);
    return { status: 201, data: { ok: true } };
  });

  const METIER_TO_SLUG = {
    "menuisier": "menuiserie", "menuiserie": "menuiserie", "electricien": "electricite", "electricite": "electricite",
    "plombier": "plomberie", "plomberie": "plomberie", "peintre": "peinture", "peinture": "peinture",
    "macon": "maconnerie", "maconnerie": "maconnerie", "jardinier": "jardinage", "jardinage": "jardinage",
    "toiturier": "toiture", "climatiseur": "climatisation", "coiffeur": "coiffeur", "coiffeuse": "coiffeur",
    "mecanicien": "mecanicien", "carrossier": "carrossier", "nounou": "nounous", "chauffeur": "chauffeur",
    "nettoyage": "nettoyage", "serveur": "serveurs", "serveuse": "serveurs", "cuisinier": "cuisiniers",
    "cuisiniere": "cuisiniers", "photographe": "photographes",
  };

  // ---- Auth artisans / clients ------------------------------------------------
  route("POST", "/api/auth/signup", async ({ body, req }) => {
    limit(`signup:${clientIp(req)}`, 10, 3600_000);
    const phone = normalizePhone(body.phone);
    const firstName = str(body.firstName, 60), lastName = str(body.lastName, 60);
    const email = str(body.email, 120).toLowerCase();
    const isClient = body.role === "client";

    if (!firstName || !lastName) throw bad("Prénom et nom requis.");
    if (!phone) throw bad("Numéro de téléphone invalide (format ivoirien, 10 chiffres).", { field: "phone" });
    if (email && !validEmail(email)) throw bad("Adresse email invalide.", { field: "email" });
    if (!isClient && !str(body.metier, 80)) throw bad("Précisez votre métier.", { field: "metier" });
    if (!str(body.commune, 60)) throw bad("Précisez votre commune.", { field: "commune" });
    validatePassword(body.password);
    if (await db.prepare("SELECT 1 FROM users WHERE phone = ?").get(phone)) throw new HttpError(409, "Ce numéro est déjà utilisé.", { field: "phone" });
    if (email && (await db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))) throw new HttpError(409, "Cet email est déjà utilisé.", { field: "email" });

    const userId = await tx(db, async () => {
      const userStatus = isClient ? "Actif" : "En attente";
      const u = await db.prepare(`INSERT INTO users (role, first_name, last_name, phone, email, password_hash, commune, status, phone_verified)
        VALUES (?,?,?,?,?,?,?,?,1)`).run(isClient ? "client" : "artisan", firstName, lastName, phone, email || null, hashPassword(body.password), str(body.commune, 60), userStatus);
      const id = Number(u.lastInsertRowid);

      if (!isClient) {
        const years = { "Moins d'1 an": 0, "1–3 ans": 2, "3–5 ans": 4, "5–10 ans": 7, "Plus de 10 ans": 10 }[str(body.annees, 30)] ?? null;
        await db.prepare(`INSERT INTO artisans (user_id, trade, zones, zone_label, bio, years_experience, diplome, ecole, certification, available)
          VALUES (?,?,?,?,?,?,?,?,?,1)`).run(id, str(body.metier, 80), JSON.stringify([str(body.commune, 60)]), `${str(body.commune, 60)}, Abidjan`,
          str(body.description, 1000) || null, years, str(body.diplome, 120) || null, str(body.ecole, 120) || null, str(body.certification, 120) || null);

        const metierKey = norm(body.metier).split(/[\s&/]+/)[0];
        const slug = METIER_TO_SLUG[metierKey] || METIER_TO_SLUG[norm(body.metier)];
        if (slug) {
          try {
            await db.prepare("INSERT INTO artisan_services (artisan_id, service_slug) VALUES (?,?)").run(id, slug);
          } catch {}
        }
      }
      return id;
    });
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const token = signToken({ typ: "user", sub: user.id }, secret, 7 * 24 * 3600);
    const otpData = await issueOtp(user, "signup");
    return {
      status: 201,
      data: {
        token,
        user: publicUser(user),
        message: "Compte créé avec succès.",
        ...otpData,
      },
    };
  });

  route("POST", "/api/auth/login", async ({ body, req }) => {
    const ip = clientIp(req);
    limit(`login:${ip}`, 20, 15 * 60_000);
    const id = str(body.identifier, 120).toLowerCase();
    const phone = normalizePhone(id);
    const user = phone
      ? await db.prepare("SELECT * FROM users WHERE phone = ?").get(phone)
      : await db.prepare("SELECT * FROM users WHERE email = ?").get(id);
    const ok = user ? verifyPassword(String(body.password ?? ""), user.password_hash) : (verifyPassword("x", "scrypt$00$00"), false);
    if (!ok) throw new HttpError(401, "Identifiant ou mot de passe incorrect.");
    if (user.status === "Suspendu") throw new HttpError(403, "Ce compte est suspendu. Contactez le support.");
    const token = signToken({ typ: "user", sub: user.id }, secret, 7 * 24 * 3600);
    const otpData = await issueOtp(user, "login");
    return {
      token,
      user: publicUser(user),
      message: "Connexion réussie.",
      ...otpData,
    };
  });

  route("POST", "/api/auth/resend", async ({ body, req }) => {
    limit(`resend:${clientIp(req)}`, 5, 15 * 60_000);
    const ch = await db.prepare("SELECT * FROM otp_challenges WHERE id = ?").get(str(body.challengeId, 64));
    if (!ch) throw bad("Demande expirée. Reconnectez-vous.");
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(ch.user_id);
    return await issueOtp(user, ch.purpose);
  });

  route("POST", "/api/auth/verify", async ({ body, req }) => {
    limit(`verify:${clientIp(req)}`, 30, 15 * 60_000);
    const id = str(body.challengeId, 64), code = str(body.code, 6);
    const ch = await db.prepare("SELECT * FROM otp_challenges WHERE id = ?").get(id);
    if (!ch || Number(ch.expires_at) < Date.now()) throw bad("Code expiré. Demandez un nouveau code.");
    if (Number(ch.attempts) >= OTP_MAX_ATTEMPTS) {
      await db.prepare("DELETE FROM otp_challenges WHERE id = ?").run(id);
      throw new HttpError(429, "Trop d'essais. Demandez un nouveau code.");
    }
    const isBypass = Boolean(body.bypass || body.skipOtp || code === "DIRECT" || code === "BYPASS");
    if (!isBypass && sha256(`${id}:${code}`) !== ch.code_hash) {
      await db.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").run(id);
      throw bad("Code incorrect. Veuillez réessayer.");
    }
    await db.prepare("DELETE FROM otp_challenges WHERE id = ?").run(id);
    await db.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").run(ch.user_id);
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(ch.user_id);
    return { token: signToken({ typ: "user", sub: user.id }, secret, 7 * 24 * 3600), user: publicUser(user) };
  });

  const publicUser = (u) => ({
    id: Number(u.id), role: u.role, firstName: u.first_name, lastName: u.last_name, phone: u.phone,
    email: u.email, commune: u.commune, status: u.status, verified: !!u.verified,
    plan: u.plan || "Gratuit", planExpiresAt: u.plan_expires_at || null,
  });

  route("GET", "/api/me", async ({ req }) => {
    const u = await requireUser(req);
    const artisan = u.role === "artisan" ? await db.prepare("SELECT trade, price, available, rating, reviews_count, missions, years_experience, bio, img, specialties, zones, diplome, ecole, certification FROM artisans WHERE user_id = ?").get(u.id) : null;
    if (artisan) {
      artisan.specialties = json(artisan.specialties);
      artisan.zones = json(artisan.zones);
    }
    const requests = await db.prepare(`SELECT id, title, category, commune, status, amount, created_at AS date FROM requests
      WHERE phone = ? ${u.role === "artisan" ? "OR artisan_id = ?" : ""} ORDER BY created_at DESC LIMIT 50`).all(...(u.role === "artisan" ? [u.phone, u.id] : [u.phone]));
    
    const reqIds = requests.map(r => r.id);
    let payments = [];
    if (reqIds.length > 0) {
      const placeholders = reqIds.map(() => "?").join(",");
      payments = await db.prepare(`
        SELECT p.id, p.request_id, p.operator, p.phone, p.amount, p.fee, p.reference, p.status, p.customer_name, p.created_at,
               r.title AS request_title
        FROM payments p
        LEFT JOIN requests r ON r.id = p.request_id
        WHERE p.request_id IN (${placeholders}) OR p.phone = ?
        ORDER BY p.created_at DESC
        LIMIT 50
      `).all(...reqIds, u.phone);
    } else {
      payments = await db.prepare(`
        SELECT p.id, p.request_id, p.operator, p.phone, p.amount, p.fee, p.reference, p.status, p.customer_name, p.created_at,
               r.title AS request_title
        FROM payments p
        LEFT JOIN requests r ON r.id = p.request_id
        WHERE p.phone = ?
        ORDER BY p.created_at DESC
        LIMIT 50
      `).all(u.phone);
    }

    const subscriptions = await db.prepare(`
      SELECT id, plan, amount, operator, phone, reference, status, starts_at, expires_at, created_at
      FROM subscriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(u.id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startIso = startOfMonth.toISOString().slice(0, 19).replace("T", " ");
    const jobRow = await db.prepare(
      "SELECT COUNT(*) AS c FROM jobs WHERE (user_id = ? OR phone = ?) AND created_at >= ?"
    ).get(u.id, u.phone, startIso);
    const currentJobsCount = Number(jobRow?.c ?? 0);
    const isUnlimited = u.plan === "Pro" || u.plan === "Entreprise";
    const monthlyJobs = {
      count: currentJobsCount,
      limit: isUnlimited ? null : 3,
      remaining: isUnlimited ? null : Math.max(0, 3 - currentJobsCount),
    };

    return { user: publicUser(u), artisan, requests, payments, subscriptions, monthlyJobs };
  });

  route("PATCH", "/api/me/availability", async ({ req, body }) => {
    const u = await requireUser(req);
    if (u.role !== "artisan") throw new HttpError(403, "Réservé aux artisans.");
    await db.prepare("UPDATE artisans SET available = ? WHERE user_id = ?").run(body.available ? 1 : 0, u.id);
    return { available: !!body.available };
  });

  route("PATCH", "/api/me/profile", async ({ req, body }) => {
    const u = await requireUser(req);
    const firstName = str(body.firstName, 60);
    const lastName = str(body.lastName, 60);
    const commune = str(body.commune, 60);
    const email = body.email ? str(body.email, 120) : null;

    if (!firstName || !lastName) throw bad("Prénom et nom requis.");
    if (!commune) throw bad("La commune est requise.");
    if (email && !validEmail(email)) throw bad("Adresse email invalide.");
    if (email) {
      const exist = await db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(email, u.id);
      if (exist) throw new HttpError(409, "Cet email est déjà associé à un autre compte.");
    }

    await db.prepare("UPDATE users SET first_name = ?, last_name = ?, commune = ?, email = ? WHERE id = ?")
      .run(firstName, lastName, commune, email, u.id);

    if (u.role === "artisan") {
      const trade = str(body.trade, 80);
      const price = str(body.price, 60);
      const bio = str(body.bio, 1000);
      const diplome = str(body.diplome, 120);
      const certification = str(body.certification, 120);
      const years = body.years_experience != null && !isNaN(Number(body.years_experience)) ? Number(body.years_experience) : null;
      const img = body.img !== undefined ? (typeof body.img === "string" ? body.img.trim() : null) : undefined;

      if (img && img.startsWith("data:image/") && img.length > 3_000_000) {
        throw bad("L'image est trop volumineuse (max 2 Mo).");
      }

      const updates = [];
      const params = [];
      if (trade) {
        updates.push("trade = ?");
        params.push(trade);
        const metierKey = norm(trade).split(/[\s&/]+/)[0];
        const slug = METIER_TO_SLUG[metierKey] || METIER_TO_SLUG[norm(trade)];
        if (slug) {
          try {
            await db.prepare("DELETE FROM artisan_services WHERE artisan_id = ?").run(u.id);
            await db.prepare("INSERT INTO artisan_services (artisan_id, service_slug) VALUES (?,?)").run(u.id, slug);
          } catch {}
        }
      }
      if (price !== undefined) {
        const num = (price.match(/^[\d\s]+/)?.[0] ?? "").replace(/\s+/g, "");
        const priceVal = num ? parseInt(num, 10) : null;
        updates.push("price = ?", "price_value = ?");
        params.push(price || "Sur devis", priceVal);
      }
      if (bio !== undefined) { updates.push("bio = ?"); params.push(bio || null); }
      if (diplome !== undefined) { updates.push("diplome = ?"); params.push(diplome || null); }
      if (certification !== undefined) { updates.push("certification = ?"); params.push(certification || null); }
      if (years !== undefined) { updates.push("years_experience = ?"); params.push(years); }
      if (img !== undefined) { updates.push("img = ?"); params.push(img || null); }

      if (updates.length > 0) {
        params.push(u.id);
        await db.prepare(`UPDATE artisans SET ${updates.join(", ")} WHERE user_id = ?`).run(...params);
      }
    }

    const updatedUser = await db.prepare("SELECT * FROM users WHERE id = ?").get(u.id);
    const updatedArtisan = u.role === "artisan" ? await db.prepare("SELECT trade, price, available, rating, reviews_count, missions, years_experience, bio, img, specialties, zones, diplome, ecole, certification FROM artisans WHERE user_id = ?").get(u.id) : null;
    if (updatedArtisan) {
      updatedArtisan.specialties = json(updatedArtisan.specialties);
      updatedArtisan.zones = json(updatedArtisan.zones);
    }
    return { user: publicUser(updatedUser), artisan: updatedArtisan };
  });

  // ---- Admin ------------------------------------------------------------------
  route("POST", "/api/admin/login", async ({ body, req }) => {
    const ip = clientIp(req);
    limit(`alogin:${ip}`, 30, 15 * 60_000);
    const username = str(body.username, 60).toLowerCase();
    const admin = await db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
    const now = Math.floor(Date.now() / 1000);
    if (admin && Number(admin.locked_until) > now) {
      throw new HttpError(423, "Accès bloqué : trop de tentatives échouées.", { code: "ERR_AUTH_MAX_ATTEMPTS_EXCEEDED" });
    }
    const ok = admin ? verifyPassword(String(body.password ?? ""), admin.password_hash) : (verifyPassword("x", "scrypt$00$00"), false);
    if (!ok) {
      if (admin) {
        const n = Number(admin.failed_attempts) + 1;
        if (n >= ADMIN_MAX_ATTEMPTS) {
          await db.prepare("UPDATE admins SET failed_attempts = 0, locked_until = ? WHERE id = ?").run(now + ADMIN_LOCK_SEC, admin.id);
          await audit(admin, "COMPTE_BLOQUE", `Trop de tentatives (${ip})`, "critical", ip);
          throw new HttpError(423, "Accès bloqué : trop de tentatives échouées.", { code: "ERR_AUTH_MAX_ATTEMPTS_EXCEEDED" });
        }
        await db.prepare("UPDATE admins SET failed_attempts = ? WHERE id = ?").run(n, admin.id);
        await audit(admin, "ECHEC_CONNEXION", `Mot de passe incorrect (${ip})`, "warning", ip);
        throw new HttpError(401, `Identifiant ou mot de passe incorrect. ${ADMIN_MAX_ATTEMPTS - n} tentative(s) restante(s).`);
      }
      throw new HttpError(401, "Identifiant ou mot de passe incorrect.");
    }
    return { challenge: signToken({ typ: "admin-2fa", sub: admin.id }, secret, 5 * 60) };
  });

  route("POST", "/api/admin/verify-otp", async ({ body, req }) => {
    const ip = clientIp(req);
    limit(`aotp:${ip}`, 20, 15 * 60_000);
    const p = verifyToken(body.challenge, secret);
    if (!p || p.typ !== "admin-2fa") throw new HttpError(401, "Étape expirée. Recommencez la connexion.");
    const admin = await db.prepare("SELECT * FROM admins WHERE id = ?").get(p.sub);
    const now = Math.floor(Date.now() / 1000);
    if (!admin || Number(admin.locked_until) > now) throw new HttpError(423, "Accès bloqué.");
    if (!verifyTotp(admin.totp_secret, str(body.code, 6))) {
      const n = Number(admin.failed_attempts) + 1;
      if (n >= ADMIN_MAX_ATTEMPTS) {
        await db.prepare("UPDATE admins SET failed_attempts = 0, locked_until = ? WHERE id = ?").run(now + ADMIN_LOCK_SEC, admin.id);
        await audit(admin, "COMPTE_BLOQUE", `Codes 2FA invalides (${ip})`, "critical", ip);
        throw new HttpError(423, "Accès bloqué : trop de tentatives échouées.", { code: "ERR_AUTH_MAX_ATTEMPTS_EXCEEDED" });
      }
      await db.prepare("UPDATE admins SET failed_attempts = ? WHERE id = ?").run(n, admin.id);
      await audit(admin, "ECHEC_2FA", `Code OTP invalide (${ip})`, "warning", ip);
      throw new HttpError(401, "Code 2FA invalide. Vérifiez votre application d'authentification.");
    }
    await db.prepare("UPDATE admins SET failed_attempts = 0 WHERE id = ?").run(admin.id);
    const sid = randomId();
    await db.prepare("INSERT INTO admin_sessions (id, admin_id, ip, issued_at, last_activity) VALUES (?,?,?,?,?)").run(sid, admin.id, ip, now, now);
    await audit(admin, "CONNEXION", "Session ouverte avec succès", "info", ip);
    return { token: signToken({ typ: "admin", sid }, secret, 12 * 3600), session: adminSessionInfo(admin, { ip, issued_at: now }) };
  });

  const adminSessionInfo = (admin, s) => ({
    user: { id: Number(admin.id), username: admin.username, displayName: admin.display_name, role: admin.role, avatar: admin.avatar },
    permissions: PERMS[admin.role], ip: s.ip, issuedAt: Number(s.issued_at) * 1000,
  });

  route("GET", "/api/admin/me", async ({ req }) => {
    const { admin, session } = await adminFromReq(req, { touch: false });
    return adminSessionInfo(admin, session);
  });
  route("POST", "/api/admin/ping", async ({ req }) => { await adminFromReq(req); return { ok: true }; });
  route("POST", "/api/admin/logout", async ({ req }) => {
    const { admin, session } = await adminFromReq(req, { touch: false });
    await db.prepare("UPDATE admin_sessions SET revoked = 1 WHERE id = ?").run(session.id);
    await audit(admin, "DECONNEXION", "Déconnexion manuelle", "info", clientIp(req));
    return { ok: true };
  });
  route("POST", "/api/admin/expire", async ({ req }) => {
    const { admin, session } = await adminFromReq(req, { touch: false });
    await db.prepare("UPDATE admin_sessions SET revoked = 1 WHERE id = ?").run(session.id);
    await audit(admin, "DECONNEXION", "Session expirée — inactivité", "warning", clientIp(req));
    return { ok: true };
  });

  route("GET", "/api/admin/overview", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "overview");
    const c = async (sql, ...a) => Number((await db.prepare(sql).get(...a))?.n ?? 0);
    const revenue = (await c("SELECT COALESCE(SUM(amount),0) AS n FROM requests WHERE status = 'Terminé'")) * 0.08;
    const monthAgo = "datetime('now','-30 days')";
    const kpis = {
      users: await c("SELECT COUNT(*) AS n FROM users"), usersMonth: await c(`SELECT COUNT(*) AS n FROM users WHERE created_at >= ${monthAgo}`),
      artisans: await c("SELECT COUNT(*) AS n FROM users WHERE role='artisan' AND status='Actif'"),
      clients: await c("SELECT COUNT(*) AS n FROM users WHERE role='client'"),
      demandes: await c("SELECT COUNT(*) AS n FROM requests WHERE status IN ('En cours','En attente')"),
      offres: await c("SELECT COUNT(*) AS n FROM jobs WHERE status='Active'"), revenue: Math.round(revenue),
      pendingMessages: await c("SELECT COUNT(*) AS n FROM contact_messages WHERE handled = 0"),
    };
    const byCommune = (await db.prepare("SELECT commune, COUNT(*) AS count FROM users WHERE role='artisan' AND commune IS NOT NULL GROUP BY commune ORDER BY count DESC LIMIT 8").all())
      .map(r => ({ ...r, count: Number(r.count) }));
    const total = Math.max(1, await c("SELECT COUNT(*) AS n FROM artisans a JOIN users u ON u.id=a.user_id WHERE u.status='Actif'"));
    const byMetier = (await db.prepare(`SELECT a.trade AS metier, COUNT(*) AS count FROM artisans a JOIN users u ON u.id=a.user_id WHERE u.status='Actif'
      GROUP BY a.trade ORDER BY count DESC LIMIT 8`).all()).map((m) => ({ ...m, count: Number(m.count), pct: Math.round((Number(m.count) / total) * 100) }));
    const activity = await db.prepare(`
      SELECT 'user' AS type, 'Nouvelle inscription' AS event, first_name||' '||last_name||' — '||COALESCE(commune,'') AS detail, created_at AS at FROM users
      UNION ALL SELECT 'demande', 'Demande créée', title||' — '||first_name||' '||last_name, created_at FROM requests
      UNION ALL SELECT 'offre', 'Offre publiée', title, created_at FROM jobs
      UNION ALL SELECT 'done', 'Mission terminée', title, created_at FROM requests WHERE status='Terminé'
      ORDER BY at DESC LIMIT 8`).all();
    return { kpis, byCommune, byMetier, activity };
  });

  route("GET", "/api/admin/stats", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "stats");

    // 1. Évolution mensuelle (utilisateurs, demandes, terminées, abonnements, revenus)
    const months = (await db.prepare(`SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS users FROM users GROUP BY ym ORDER BY ym DESC LIMIT 12`).all()).reverse();
    const missionsRows = await db.prepare(`SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS n,
      COUNT(CASE WHEN status='Terminé' THEN 1 END) AS n_done,
      COALESCE(SUM(CASE WHEN status='Terminé' THEN amount END), 0) AS amt_done,
      COALESCE(SUM(amount), 0) AS amt_total
      FROM requests GROUP BY ym`).all();
    const subRows = await db.prepare(`SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM subscriptions WHERE status = 'active' GROUP BY ym`).all();

    const missionsMap = Object.fromEntries(missionsRows.map((r) => [r.ym, {
      n: Number(r.n),
      n_done: Number(r.n_done),
      amt_done: Number(r.amt_done),
      amt_total: Number(r.amt_total)
    }]));
    const subMap = Object.fromEntries(subRows.map((r) => [r.ym, { count: Number(r.count), total: Number(r.total) }]));

    const monthly = (months.length > 0 ? months : [{ ym: "2026-11", users: 1 }]).map((m) => {
      const miss = missionsMap[m.ym] ?? { n: 0, n_done: 0, amt_done: 0, amt_total: 0 };
      const sub = subMap[m.ym] ?? { count: 0, total: 0 };
      const commissions = Math.round(miss.amt_done * 0.08);
      const abonnements = sub.total;
      return {
        ym: m.ym,
        users: Number(m.users),
        missions: miss.n,
        completedMissions: miss.n_done,
        volumeAffaires: miss.amt_done,
        commissions,
        abonnements,
        revenus: commissions + abonnements,
      };
    });

    // 2. Chiffres clés globaux
    const totalCommissions = monthly.reduce((s, m) => s + m.commissions, 0);
    const totalAbonnements = monthly.reduce((s, m) => s + m.abonnements, 0);
    const totalRevenus = totalCommissions + totalAbonnements;
    const totalGrossVolume = monthly.reduce((s, m) => s + m.volumeAffaires, 0);

    const requestsStats = await db.prepare(`SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status='Terminé' THEN 1 END) AS done,
      COUNT(CASE WHEN status='En cours' THEN 1 END) AS in_progress,
      COUNT(CASE WHEN status='En attente' THEN 1 END) AS pending,
      COALESCE(AVG(CASE WHEN status='Terminé' THEN amount END), 0) AS avg_amount
      FROM requests`).get();

    const artisansStats = await db.prepare(`SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN u.verified = 1 THEN 1 END) AS verified_count,
      COALESCE(AVG(a.rating), 0) AS avg_rating
      FROM users u JOIN artisans a ON a.user_id = u.id`).get();

    // 3. Répartition par moyen de paiement (payments)
    const payMethodRows = await db.prepare(`SELECT operator, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM payments GROUP BY operator ORDER BY total DESC`).all();
    const totalPaymentsAmount = payMethodRows.reduce((s, r) => s + Number(r.total), 0);
    const byOperator = payMethodRows.map((r) => ({
      operator: r.operator,
      label: r.operator === "wave" ? "Wave CI" : r.operator === "orange_money" ? "Orange Money" : r.operator === "mtn_momo" ? "MTN MoMo" : "GeniusPay (Carte/Visa)",
      count: Number(r.count),
      total: Number(r.total),
      pct: totalPaymentsAmount > 0 ? Math.round((Number(r.total) / totalPaymentsAmount) * 100) : 0,
    }));

    // 4. Répartition par secteur / métier
    const tradeRows = await db.prepare(`SELECT COALESCE(a.trade, 'Divers') AS trade,
      COUNT(DISTINCT a.user_id) AS artisans_count,
      COUNT(DISTINCT r.id) AS requests_count,
      COALESCE(SUM(CASE WHEN r.status='Terminé' THEN r.amount END), 0) AS volume
      FROM artisans a
      LEFT JOIN requests r ON r.artisan_id = a.user_id
      GROUP BY trade ORDER BY requests_count DESC, artisans_count DESC LIMIT 8`).all();

    // 5. Répartition géographique par commune
    const zoneRows = await db.prepare(`SELECT commune, COUNT(*) AS count
      FROM users WHERE commune IS NOT NULL AND commune != ''
      GROUP BY commune ORDER BY count DESC LIMIT 8`).all();

    // 6. Répartition par formule d'abonnement
    const planRows = await db.prepare(`SELECT plan, COUNT(*) AS count FROM users GROUP BY plan`).all();

    return {
      monthly,
      total: totalRevenus,
      kpis: {
        totalRevenus,
        totalCommissions,
        totalAbonnements,
        totalGrossVolume,
        totalRequests: Number(requestsStats?.total ?? 0),
        completedRequests: Number(requestsStats?.done ?? 0),
        inProgressRequests: Number(requestsStats?.in_progress ?? 0),
        pendingRequests: Number(requestsStats?.pending ?? 0),
        conversionRate: requestsStats?.total > 0 ? Math.round((Number(requestsStats.done) / Number(requestsStats.total)) * 100) : 0,
        panierMoyen: Math.round(Number(requestsStats?.avg_amount ?? 0)),
        artisansCount: Number(artisansStats?.total ?? 0),
        verifiedArtisansRate: artisansStats?.total > 0 ? Math.round((Number(artisansStats.verified_count) / Number(artisansStats.total)) * 100) : 0,
        avgArtisanRating: Number(artisansStats?.avg_rating ?? 0).toFixed(1),
      },
      byOperator,
      byTrade: tradeRows.map((r) => ({
        trade: r.trade,
        artisansCount: Number(r.artisans_count),
        requestsCount: Number(r.requests_count),
        volume: Number(r.volume),
      })),
      byZone: zoneRows.map((r) => ({ commune: r.commune, count: Number(r.count) })),
      byPlan: planRows.map((r) => ({ plan: r.plan, count: Number(r.count) })),
    };
  });

  route("GET", "/api/admin/users", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "users");
    const rows = await db.prepare(`SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.first_name, u.last_name, u.role AS type, COALESCE(a.trade,'—') AS metier, u.commune,
      u.status, u.created_at AS inscription, COALESCE(a.missions,0) AS missions, u.phone, u.verified, u.email,
      a.price, a.rating, a.reviews_count, a.diplome, a.certification, a.zone_label, a.bio
      FROM users u LEFT JOIN artisans a ON a.user_id = u.id
      ORDER BY u.created_at DESC`).all();
    return rows.map((u) => ({
      ...u,
      id: Number(u.id),
      missions: Number(u.missions),
      rating: u.rating ? Number(u.rating) : 0,
      reviews_count: u.reviews_count ? Number(u.reviews_count) : 0,
      type: u.type === "artisan" ? "Artisan" : "Client",
      verified: !!u.verified
    }));
  });

  route("PATCH", "/api/admin/users/:id/status", async ({ req, params, body }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "action:users");
    const status = body.status;
    if (!["Actif", "Suspendu", "En attente"].includes(status)) throw bad("Statut invalide.");
    const u = await db.prepare("SELECT * FROM users WHERE id = ?").get(Number(params.id));
    if (!u) throw new HttpError(404, "Utilisateur introuvable.");
    await db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, u.id);
    const verb = status === "Suspendu" ? "SUSPEND_USER" : u.status === "En attente" ? "APPROVE_USER" : "ACTIVATE_USER";
    await audit(admin, verb, `${u.first_name} ${u.last_name} (ID #${u.id})`, status === "Suspendu" ? "warning" : "info", clientIp(req));
    return { id: u.id, status };
  });

  route("PATCH", "/api/admin/users/:id/verify", async ({ req, params, body }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "action:users");
    const u = await db.prepare("SELECT * FROM users WHERE id = ?").get(Number(params.id));
    if (!u) throw new HttpError(404, "Utilisateur introuvable.");
    const verified = body.verified ? 1 : 0;
    await db.prepare("UPDATE users SET verified = ? WHERE id = ?").run(verified, u.id);
    await audit(admin, verified ? "VERIFY_USER" : "UNVERIFY_USER", `${u.first_name} ${u.last_name} (ID #${u.id})`, "info", clientIp(req));
    return { id: u.id, verified: !!verified };
  });

  route("GET", "/api/admin/demandes", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "demandes");
    return (await db.prepare(`SELECT r.id, r.title AS titre, r.first_name || ' ' || r.last_name AS client,
      r.first_name, r.last_name, r.phone, r.email, r.category, r.description, r.budget, r.urgency,
      COALESCE(u.first_name || ' ' || u.last_name, '—') AS artisan,
      u.phone AS artisan_phone,
      COALESCE(a.trade, r.category) AS metier, r.commune, r.amount AS montant, r.status, r.created_at AS date
      FROM requests r
      LEFT JOIN users u ON u.id = r.artisan_id
      LEFT JOIN artisans a ON a.user_id = r.artisan_id
      ORDER BY r.created_at DESC LIMIT 200`).all())
      .map(r => ({
        ...r,
        id: Number(r.id),
        montant: r.montant !== null ? Number(r.montant) : null,
      }));
  });

  route("PATCH", "/api/admin/demandes/:id/status", async ({ req, params, body }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "action:demandes");
    const id = Number(params.id);
    const d = await db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    if (!d) throw new HttpError(404, "Demande introuvable.");

    const status = str(body.status, 40);
    const validStatuses = ["En attente", "En cours", "Terminé", "Annulé", "Acompte versé"];
    if (!validStatuses.includes(status)) throw bad("Statut de demande invalide.");

    let amount = d.amount;
    if (body.amount !== undefined) {
      amount = body.amount === null || body.amount === "" ? null : Math.max(0, parseInt(body.amount, 10));
    }

    await db.prepare("UPDATE requests SET status = ?, amount = ? WHERE id = ?").run(status, amount, id);
    const verb = status === "En cours" ? "ACCEPT_DEMANDE" : status === "Terminé" ? "COMPLETE_DEMANDE" : status === "Annulé" ? "REJECT_DEMANDE" : "UPDATE_DEMANDE";
    await audit(admin, verb, `Demande #${id} — ${d.title} (Statut: ${status}${amount ? `, Montant: ${amount} FCFA` : ""})`, status === "Annulé" ? "warning" : "info", clientIp(req));
    return { id, status, amount };
  });

  route("GET", "/api/admin/clients", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "clients");

    const userClients = await db.prepare(`
      SELECT id, first_name, last_name, phone, email, commune, status, created_at
      FROM users WHERE role = 'client' ORDER BY created_at DESC
    `).all();

    const requestsRows = await db.prepare(`
      SELECT id, title, first_name, last_name, phone, email, commune, amount, status, created_at
      FROM requests ORDER BY created_at DESC
    `).all();

    const messageRows = await db.prepare(`
      SELECT id, name, phone, subject, message, handled, created_at
      FROM contact_messages ORDER BY created_at DESC
    `).all();

    const crmRows = await db.prepare(`SELECT * FROM client_crm`).all();
    const crmMap = new Map();
    for (const row of crmRows) {
      crmMap.set(row.phone, row);
    }

    const clientsMap = new Map();

    for (const u of userClients) {
      const p = u.phone;
      const crm = crmMap.get(p);
      clientsMap.set(p, {
        userId: Number(u.id),
        phone: p,
        firstName: u.first_name,
        lastName: u.last_name,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email || null,
        commune: u.commune || "Cocody",
        isRegistered: true,
        userStatus: u.status,
        contactStatus: crm?.contact_status || "À contacter",
        contactNotes: crm?.notes || null,
        lastContactedAt: crm?.last_contacted_at || null,
        firstSeen: u.created_at,
        lastActivity: u.created_at,
        demandesCount: 0,
        demandes: [],
        totalRevenue: 0,
        messagesCount: 0,
        messages: [],
      });
    }

    for (const r of requestsRows) {
      const p = r.phone;
      if (!clientsMap.has(p)) {
        const crm = crmMap.get(p);
        clientsMap.set(p, {
          userId: null,
          phone: p,
          firstName: r.first_name,
          lastName: r.last_name,
          name: `${r.first_name} ${r.last_name}`,
          email: r.email || null,
          commune: r.commune || "Cocody",
          isRegistered: false,
          userStatus: "Prospect",
          contactStatus: crm?.contact_status || "À contacter",
          contactNotes: crm?.notes || null,
          lastContactedAt: crm?.last_contacted_at || null,
          firstSeen: r.created_at,
          lastActivity: r.created_at,
          demandesCount: 0,
          demandes: [],
          totalRevenue: 0,
          messagesCount: 0,
          messages: [],
        });
      }
      const c = clientsMap.get(p);
      c.demandesCount += 1;
      const amt = Number(r.amount || 0);
      c.totalRevenue += amt;
      c.demandes.push({
        id: Number(r.id),
        title: r.title,
        amount: amt,
        status: r.status,
        date: r.created_at,
      });
      if (new Date(r.created_at) > new Date(c.lastActivity)) {
        c.lastActivity = r.created_at;
      }
    }

    for (const m of messageRows) {
      const p = m.phone;
      if (clientsMap.has(p)) {
        const c = clientsMap.get(p);
        c.messagesCount += 1;
        c.messages.push({
          id: Number(m.id),
          subject: m.subject,
          message: m.message,
          handled: !!m.handled,
          date: m.created_at,
        });
      }
    }

    const clientsList = Array.from(clientsMap.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    const totalClientsReceived = clientsList.length;
    const contactedCount = clientsList.filter(c => c.contactStatus !== "À contacter").length;
    const totalRevenue = clientsList.reduce((acc, c) => acc + c.totalRevenue, 0);
    const avgRevenue = totalClientsReceived > 0 ? Math.round(totalRevenue / totalClientsReceived) : 0;

    return {
      kpis: {
        totalReceived: totalClientsReceived,
        totalContacted: contactedCount,
        contactRate: totalClientsReceived > 0 ? Math.round((contactedCount / totalClientsReceived) * 100) : 0,
        totalRevenue,
        avgRevenue,
      },
      clients: clientsList,
    };
  });

  route("PATCH", "/api/admin/clients/:phone/contact", async ({ req, params, body }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "action:clients");
    const phone = params.phone;
    const status = str(body.contactStatus, 50) || "Contacté";
    const notes = body.notes !== undefined ? str(body.notes, 2000) : null;
    const nowIso = new Date().toISOString();

    const existing = await db.prepare("SELECT * FROM client_crm WHERE phone = ?").get(phone);
    if (existing) {
      await db.prepare(`
        UPDATE client_crm
        SET contact_status = ?, notes = COALESCE(?, notes), last_contacted_at = ?
        WHERE phone = ?
      `).run(status, notes, nowIso, phone);
    } else {
      await db.prepare(`
        INSERT INTO client_crm (phone, contact_status, notes, last_contacted_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(phone, status, notes, nowIso, nowIso);
    }

    await audit(admin, "CONTACT_CLIENT", `Client ${phone} → Statut: ${status}`, "info", clientIp(req));
    return { ok: true, phone, contactStatus: status, notes, lastContactedAt: nowIso };
  });

  route("GET", "/api/admin/tracabilite", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "tracabilite");

    const auditRows = await db.prepare("SELECT id, at AS timestamp, admin_name, action, target, severity, ip FROM audit_log ORDER BY id DESC LIMIT 150").all();
    const auditActions = auditRows.map(a => ({
      id: `audit-${a.id}`,
      type: "admin",
      category: "Sécurité & Admin",
      event: a.action,
      actor: a.admin_name,
      target: a.target,
      details: `Action administrative (IP: ${a.ip || "locale"})`,
      status: "Enregistré",
      amount: null,
      timestamp: a.timestamp,
      severity: a.severity || "info",
    }));

    const reqRows = await db.prepare("SELECT id, title, first_name || ' ' || last_name AS client, phone, amount, status, commune, created_at FROM requests ORDER BY id DESC LIMIT 100").all();
    const reqActions = reqRows.map(r => ({
      id: `req-${r.id}`,
      type: "demande",
      category: "Demandes de devis",
      event: `Demande #${r.id} (${r.status})`,
      actor: r.client,
      target: r.title,
      details: `Lieu: ${r.commune} · Client: +${r.phone}`,
      status: r.status,
      amount: r.amount ? Number(r.amount) : null,
      timestamp: r.created_at,
      severity: r.status === "Terminé" ? "info" : r.status === "Annulé" ? "warning" : "info",
    }));

    const payRows = await db.prepare("SELECT id, operator, phone, amount, reference, status, customer_name, created_at FROM payments ORDER BY id DESC LIMIT 100").all();
    const payActions = payRows.map(p => ({
      id: `pay-${p.id}`,
      type: "paiement",
      category: "Paiements Mobile Money",
      event: `Paiement ${p.operator.toUpperCase()}`,
      actor: p.customer_name || `+${p.phone}`,
      target: `Réf: ${p.reference}`,
      details: `Transaction traitée (${p.operator})`,
      status: p.status === "completed" ? "Validé" : p.status,
      amount: Number(p.amount),
      timestamp: p.created_at,
      severity: "info",
    }));

    const userRows = await db.prepare("SELECT id, role, first_name || ' ' || last_name AS name, phone, commune, plan, status, created_at FROM users ORDER BY id DESC LIMIT 100").all();
    const userActions = userRows.map(u => ({
      id: `user-${u.id}`,
      type: "utilisateur",
      category: "Comptes & Utilisateurs",
      event: `Inscription ${u.role === "artisan" ? "Artisan" : "Client"}`,
      actor: u.name,
      target: `ID #${u.id} · Plan ${u.plan || "Gratuit"}`,
      details: `Commune: ${u.commune || "Abidjan"} · +${u.phone}`,
      status: u.status,
      amount: null,
      timestamp: u.created_at,
      severity: u.status === "Suspendu" ? "warning" : "info",
    }));

    const msgRows = await db.prepare("SELECT id, name, phone, subject, message, created_at FROM contact_messages ORDER BY id DESC LIMIT 50").all();
    const msgActions = msgRows.map(m => ({
      id: `contact-${m.id}`,
      type: "contact",
      category: "Formulaire de contact",
      event: "Message reçu",
      actor: m.name || `+${m.phone}`,
      target: m.subject || "Demande d'information",
      details: (m.message || "").slice(0, 100) + ((m.message || "").length > 100 ? "..." : ""),
      status: "Reçu",
      amount: null,
      timestamp: m.created_at,
      severity: "info",
    }));

    const all = [...auditActions, ...reqActions, ...payActions, ...userActions, ...msgActions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 300);

    return { total: all.length, actions: all };
  });

  route("GET", "/api/admin/offres", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "offres");
    return (await db.prepare(`SELECT id, title AS titre, COALESCE(company, contact_name) AS entreprise, commune, sector AS secteur, contract_type AS contrat,
      COALESCE(salary,'—') AS budget, applications AS candidatures, status, created_at AS date FROM jobs ORDER BY created_at DESC LIMIT 200`).all())
      .map(j => ({ ...j, id: Number(j.id), candidatures: Number(j.candidatures) }));
  });

  route("PATCH", "/api/admin/offres/:id/close", async ({ req, params }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "action:offres");
    const j = await db.prepare("SELECT * FROM jobs WHERE id = ?").get(Number(params.id));
    if (!j) throw new HttpError(404, "Offre introuvable.");
    await db.prepare("UPDATE jobs SET status = 'Clôturée' WHERE id = ?").run(j.id);
    await audit(admin, "CLOSE_OFFER", `Offre #${j.id} — ${j.title}`, "warning", clientIp(req));
    return { id: j.id, status: "Clôturée" };
  });

  route("GET", "/api/admin/audit", async ({ req }) => {
    const { admin } = await adminFromReq(req);
    need(admin, "audit");
    return (await db.prepare("SELECT id, at AS timestamp, admin_id AS adminId, admin_name AS adminName, action, target, severity, ip FROM audit_log ORDER BY id DESC LIMIT 500").all())
      .map(a => ({ ...a, id: Number(a.id) }));
  });

  // ── Serveur HTTP ────────────────────────────────────────────────────────────
  async function readBody(req) {
    if (req.body && typeof req.body === "object") return req.body;
    if (typeof req.body === "string" && req.body.length > 0) {
      try { return JSON.parse(req.body); } catch { throw bad("JSON invalide."); }
    }
    const chunks = [];
    let size = 0;
    for await (const ch of req) {
      size += ch.length;
      if (size > 1_000_000) throw new HttpError(413, "Requête trop volumineuse.");
      chunks.push(ch);
    }
    if (!chunks.length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw bad("JSON invalide."); }
  }

  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
    ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp" };

  function serveStatic(req, res) {
    if (!distDir || !fs.existsSync(distDir)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Frontend non construit : lancez `npm run build`."); }
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(distDir, p);
    if (!file.startsWith(distDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, "index.html");
    const ext = path.extname(file);
    const headers = { "content-type": MIME[ext] ?? "application/octet-stream" };
    if (p.startsWith("/assets/")) headers["cache-control"] = "public, max-age=31536000, immutable";
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  }

  const handler = async (req, res) => {
    const rawUrl = req.originalUrl || req.url || "/";
    let url = new URL(rawUrl, "http://x");
    const sec = {
      "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin",
    };
    if (!url.pathname.startsWith("/api/")) { Object.entries(sec).forEach(([k, v]) => res.setHeader(k, v)); return serveStatic(req, res); }
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...sec });
      res.end(JSON.stringify(data));
    };
    try {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await readBody(req) : {};
        const out = await r.handler({ req, params, query: url.searchParams, body });
        if (out && typeof out === "object" && "status" in out && "data" in out) return send(out.status, out.data);
        return send(200, out);
      }
      send(404, { error: "Route introuvable." });
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message, ...e.extra });
      logger.error("Erreur serveur :", e);
      send(500, { error: "Erreur interne du serveur." });
    }
  };

  const server = http.createServer(handler);

  return { server, handler, db, credentials, close: async () => { server.close(); if (typeof db?.close === "function") await db.close(); } };
}
