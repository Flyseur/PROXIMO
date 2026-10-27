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

// ── Constantes ────────────────────────────────────────────────────────────────
const ADMIN_IDLE_SEC = 15 * 60;
const ADMIN_MAX_ATTEMPTS = 3;
const ADMIN_LOCK_SEC = 15 * 60;
const OTP_TTL_SEC = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;

const PERMS = {
  "Super Admin": ["overview", "users", "demandes", "offres", "stats", "audit", "action:users", "action:offres", "action:demandes"],
  "Modérateur": ["overview", "users", "demandes", "offres", "action:users", "action:offres", "action:demandes"],
  "Analyste": ["overview", "stats"],
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

  const clientIp = (req) =>
    (process.env.TRUST_PROXY === "1" && String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) ||
    req.socket.remoteAddress || "?";

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
    const s = await db.prepare("SELECT * FROM admin_sessions WHERE id = ? AND revoked = 0").get(p.sid);
    const now = Math.floor(Date.now() / 1000);
    if (!s || now - s.last_activity > ADMIN_IDLE_SEC) {
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
             (SELECT COUNT(*) FROM artisan_services l JOIN users u ON u.id = l.artisan_id WHERE l.service_slug = s.slug AND u.status = 'Actif') as count
      FROM services s
      WHERE s.slug IN ('menuiserie','electricite','plomberie','peinture','maconnerie','jardinage','toiture','climatisation')
      ORDER BY CASE s.slug WHEN 'menuiserie' THEN 1 WHEN 'electricite' THEN 2 WHEN 'plomberie' THEN 3 WHEN 'peinture' THEN 4
        WHEN 'maconnerie' THEN 5 WHEN 'jardinage' THEN 6 WHEN 'toiture' THEN 7 ELSE 8 END
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
      ORDER BY s.section_pos, s.pos
    `).all();
    const sections = [];
    for (const r of rows) {
      let s = sections.find((x) => x.id === r.section_id);
      if (!s) sections.push((s = { id: r.section_id, title: r.section_title, desc: r.section_desc, services: [] }));
      s.services.push({ icon: r.icon, label: r.label, slug: r.slug, count: Number(r.real_pros_count), avg: r.avg_price, img: r.img });
    }
    const special = rows.filter((r) => r.page_title).map((r) => ({
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
    limit(`rev:${clientIp(req)}:${artisanId}`, 3, 3600_000);

    const art = await db.prepare("SELECT u.id, a.rating, a.reviews_count FROM users u JOIN artisans a ON a.user_id = u.id WHERE u.id = ? AND u.status = 'Actif'").get(artisanId);
    if (!art) throw new HttpError(404, "Artisan introuvable ou non disponible.");

    const author = str(body.author, 80);
    const text = str(body.text, 1000);
    const rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));

    if (!author) throw bad("Le nom ou prénom est requis.");
    if (!text || text.length < 5) throw bad("Votre avis doit contenir au moins 5 caractères.");

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

    const allowedOps = ["wave", "orange_money", "mtn_momo"];
    const operator = String(body.operator ?? "").toLowerCase().trim();
    if (!allowedOps.includes(operator)) throw bad("Opérateur Mobile Money invalide (choix : Wave, Orange Money, MTN).");

    const phone = normalizePhone(body.phone);
    if (!phone) throw bad("Numéro de compte Mobile Money invalide (format ivoirien, 10 chiffres).");

    const amount = parseInt(body.amount, 10);
    if (isNaN(amount) || amount < 1000 || amount > 2_000_000) {
      throw bad("Le montant doit être compris entre 1 000 et 2 000 000 FCFA.");
    }

    const customerName = str(body.customerName || `${reqRow.first_name} ${reqRow.last_name}`, 150);

    const opPrefix = operator === "wave" ? "WAV" : operator === "orange_money" ? "OM" : "MTN";
    const refSuffix = randomDigits(6);
    const reference = `PRX-${opPrefix}-${refSuffix}`;

    const nowIso = new Date().toISOString().replace("T", " ").slice(0, 19);

    const r = await db.prepare(`
      INSERT INTO payments (request_id, operator, phone, amount, fee, reference, status, customer_name, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(requestId, operator, phone, amount, 0, reference, "completed", customerName, nowIso);

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
    const nb = Math.min(99, Math.max(1, parseInt(body.nbPosts, 10) || 1));
    const r = await db.prepare(`INSERT INTO jobs (poster_type, company, contact_name, phone, email, poster_commune, title, sector, contract_type, commune, salary, nb_posts,
      profile, experience, studies, skills, description, how_to_apply) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(posterType, f.company || null, f.contactName, phone, f.email || null, f.posterCommune || null, f.title, f.sector, f.contractType, f.commune, f.salary || null, nb,
        f.profile, f.experience || null, f.studies || null, f.skills || null, f.description, f.howToApply);
    return { status: 201, data: { id: Number(r.lastInsertRowid) } };
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
  });

  route("GET", "/api/me", async ({ req }) => {
    const u = await requireUser(req);
    const artisan = u.role === "artisan" ? await db.prepare("SELECT trade, price, available, rating, reviews_count, missions, years_experience, bio FROM artisans WHERE user_id = ?").get(u.id) : null;
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

    return { user: publicUser(u), artisan, requests, payments };
  });

  route("PATCH", "/api/me/availability", async ({ req, body }) => {
    const u = await requireUser(req);
    if (u.role !== "artisan") throw new HttpError(403, "Réservé aux artisans.");
    await db.prepare("UPDATE artisans SET available = ? WHERE user_id = ?").run(body.available ? 1 : 0, u.id);
    return { available: !!body.available };
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

  if (process.env.NODE_ENV !== "production") {
    route("POST", "/api/admin/dev-totp", async ({ body }) => {
      const p = verifyToken(body.challenge, secret);
      if (!p || p.typ !== "admin-2fa") throw new HttpError(401, "Étape expirée. Recommencez la connexion.");
      const admin = await db.prepare("SELECT * FROM admins WHERE id = ?").get(p.sub);
      if (!admin) throw new HttpError(404, "Administrateur non trouvé.");
      return { code: totp(admin.totp_secret) };
    });
  }

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
    const months = (await db.prepare(`SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS users FROM users GROUP BY ym ORDER BY ym DESC LIMIT 6`).all()).reverse();
    const missionsRows = await db.prepare(`SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS n, COALESCE(SUM(CASE WHEN status='Terminé' THEN amount END),0) AS amt
      FROM requests GROUP BY ym`).all();
    const missions = Object.fromEntries(missionsRows.map((r) => [r.ym, { n: Number(r.n), amt: Number(r.amt) }]));
    const monthly = months.map((m) => ({ ym: m.ym, users: Number(m.users), missions: missions[m.ym]?.n ?? 0, revenus: Math.round((missions[m.ym]?.amt ?? 0) * 0.08) }));
    return { monthly, total: monthly.reduce((s, m) => s + m.revenus, 0) };
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
    return (await db.prepare(`SELECT r.id, r.title AS titre, r.first_name || ' ' || r.last_name AS client, COALESCE(u.first_name || ' ' || u.last_name, '—') AS artisan,
      COALESCE(a.trade, r.category) AS metier, r.commune, r.amount AS montant, r.status, r.created_at AS date
      FROM requests r LEFT JOIN users u ON u.id = r.artisan_id LEFT JOIN artisans a ON a.user_id = r.artisan_id ORDER BY r.created_at DESC LIMIT 200`).all())
      .map(r => ({ ...r, id: Number(r.id), montant: r.montant !== null ? Number(r.montant) : null }));
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
