import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import { totp } from "./crypto.js";

let app, base, creds;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "proximo-"));

before(async () => {
  process.env.OTP_MODE = "test";
  app = await createApp({ dbFile: ":memory:", dataDir: tmp, logger: { log() {}, error() {} } });
  creds = app.credentials;
  await new Promise((r) => app.server.listen(0, r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => { app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const call = async (method, url, body, token) => {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};

test("santé du serveur : /api/health", async () => {
  const res = await call("GET", "/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.data.status, "healthy");
  assert.equal(res.data.database.status, "ok");
  assert.ok(typeof res.data.database.latencyMs === "number");
});

test("catalogue : accueil, services, détail", async () => {
  const home = await call("GET", "/api/home");
  assert.equal(home.data.categories.length, 8);
  assert.equal(home.data.featured.length, 3);
  const svc = await call("GET", "/api/services");
  assert.equal(svc.data.sections.length, 5);
  assert.equal(svc.data.special.length, 6);
  const d = await call("GET", "/api/services/nounous");
  assert.equal(d.data.pros.length, 3);
  assert.equal((await call("GET", "/api/services/inconnu")).status, 404);
});

test("recherche d'artisans : filtres, accents, suspendus masqués", async () => {
  const all = await call("GET", "/api/artisans");
  assert.ok(all.data.items.every((a) => a.name !== "Fatoumata Koné"), "un compte suspendu ne doit pas apparaître");
  const plomb = await call("GET", "/api/artisans?q=Plombier%20Cocody");
  assert.equal(plomb.data.total, 0);
  const elec = await call("GET", "/api/artisans?categorie=%C3%89lectricit%C3%A9");
  assert.equal(elec.data.items[0].name, "Marie-Claire Adjoua");
  const cocody = await call("GET", "/api/artisans?commune=Cocody&available=1");
  assert.ok(cocody.data.items.length > 0 && cocody.data.items.every((a) => a.commune === "Cocody" && a.available));
});

test("profil artisan et dépôt d'avis", async () => {
  const p = await call("GET", "/api/artisans/1");
  assert.equal(p.data.reviewsList.length, 3);
  assert.equal(p.data.portfolio.length, 4);
  assert.equal(p.data.priceNumber, "15 000");
  assert.equal((await call("GET", "/api/artisans/4")).status, 404); // suspendu

  const rev = await call("POST", "/api/artisans/1/reviews", {
    author: "Kouadio Marc",
    rating: 5,
    text: "Artisan ponctuel et très professionnel à Cocody !",
  });
  assert.equal(rev.status, 201);
  assert.equal(rev.data.review.name, "Kouadio Marc");
  assert.equal(rev.data.review.rating, 5);

  const updated = await call("GET", "/api/artisans/1");
  assert.equal(updated.data.reviewsList.length, 4);
  assert.equal(updated.data.reviewsList[0].name, "Kouadio Marc");
});

test("demande de devis : validation et enregistrement", async () => {
  const bad = await call("POST", "/api/requests", { title: "x" });
  assert.equal(bad.status, 400);
  const ok = await call("POST", "/api/requests", {
    title: "Rénovation salle de bain", category: "Plomberie", description: "Refaire la douche", commune: "Cocody",
    firstName: "Awa", lastName: "Test", phone: "+225 07 01 02 03 04",
  });
  assert.equal(ok.status, 201);
  const row = app.db.prepare("SELECT phone, status FROM requests WHERE id = ?").get(ok.data.id);
  assert.equal(row.phone, "2250701020304");
  assert.equal(row.status, "En attente");
});

test("offre d'emploi + message de contact", async () => {
  const job = await call("POST", "/api/jobs", {
    posterType: "particulier", contactName: "Mme Bamba", phone: "0701020304", title: "Cuisinière", sector: "Cuisine & Restauration",
    contractType: "CDI", commune2: "Cocody", profile: "Sérieuse", description: "Cuisine du quotidien",
  });
  assert.equal(job.status, 201);
  assert.equal((await call("POST", "/api/jobs", { posterType: "entreprise" })).status, 400);
  assert.equal((await call("POST", "/api/contact", { phone: "0701020304", message: "Bonjour" })).status, 201);
});

test("inscription artisan + OTP + connexion + espace perso", async () => {
  const signup = { firstName: "Yvan", lastName: "Kouadio", phone: "0707070707", metier: "Menuisier", commune: "Cocody", password: "secret12" };
  const s = await call("POST", "/api/auth/signup", signup);
  assert.equal(s.status, 201);
  assert.match(s.data.devCode, /^\d{6}$/);
  assert.equal((await call("POST", "/api/auth/signup", signup)).status, 409, "numéro unique");
  assert.equal((await call("POST", "/api/auth/verify", { challengeId: s.data.challengeId, code: "000000" })).status, 400);
  const v = await call("POST", "/api/auth/verify", { challengeId: s.data.challengeId, code: s.data.devCode });
  assert.equal(v.status, 200);
  assert.equal(v.data.user.status, "En attente");
  const me = await call("GET", "/api/me", null, v.data.token);
  assert.equal(me.data.user.firstName, "Yvan");
  // le compte en attente n'est pas listé publiquement
  const list = await call("GET", "/api/artisans?q=Kouadio");
  assert.equal(list.data.total, 0);
  // connexion
  assert.equal((await call("POST", "/api/auth/login", { identifier: "0707070707", password: "faux" })).status, 401);
  const l = await call("POST", "/api/auth/login", { identifier: "+225 07 07 07 07 07", password: "secret12" });
  assert.equal(l.status, 200);
  const v2 = await call("POST", "/api/auth/verify", { challengeId: l.data.challengeId, code: l.data.devCode });
  assert.ok(v2.data.token);
  assert.equal((await call("GET", "/api/me")).status, 401);
  // le code OTP n'est utilisable qu'une fois
  assert.equal((await call("POST", "/api/auth/verify", { challengeId: l.data.challengeId, code: l.data.devCode })).status, 400);

  // Modification du profil et de la photo de profil
  const upProfile = await call("PATCH", "/api/me/profile", {
    firstName: "Yvan Modif",
    lastName: "Kouadio",
    commune: "Marcory",
    trade: "Menuisier",
    price: "20 000 FCFA/jour",
    bio: "Menuisier qualifié avec 10 ans d'expérience.",
    img: "https://example.com/avatar.jpg",
  }, v2.data.token);
  assert.equal(upProfile.status, 200);
  assert.equal(upProfile.data.user.firstName, "Yvan Modif");
  assert.equal(upProfile.data.user.commune, "Marcory");
  assert.equal(upProfile.data.artisan.price, "20 000 FCFA/jour");
  assert.equal(upProfile.data.artisan.img, "https://example.com/avatar.jpg");
});

test("admin : mot de passe + TOTP, RBAC, audit, verrouillage", async () => {
  const sa = creds.find((c) => c.username === "superadmin");
  const login = await call("POST", "/api/admin/login", { username: "superadmin", password: sa.password });
  assert.equal(login.status, 200);
  assert.equal((await call("POST", "/api/admin/verify-otp", { challenge: login.data.challenge, code: "123456" })).status, 401);
  const ver = await call("POST", "/api/admin/verify-otp", { challenge: login.data.challenge, code: totp(sa.totpSecret) });
  assert.equal(ver.status, 200);
  const T = ver.data.token;
  assert.equal((await call("GET", "/api/admin/me", null, T)).data.user.role, "Super Admin");
  assert.equal((await call("GET", "/api/admin/users")).status, 401);

  const users = (await call("GET", "/api/admin/users", null, T)).data;
  const pending = users.find((u) => u.name === "Serge Yao");
  const patched = await call("PATCH", `/api/admin/users/${pending.id}/status`, { status: "Actif" }, T);
  assert.equal(patched.status, 200);
  assert.equal((await call("PATCH", `/api/admin/users/${pending.id}/status`, { status: "nimporte" }, T)).status, 400);
  const log = (await call("GET", "/api/admin/audit", null, T)).data;
  assert.equal(log[0].action, "APPROVE_USER");
  assert.throws(() => app.db.prepare("UPDATE audit_log SET action='x'").run(), /immuable/);
  assert.throws(() => app.db.prepare("DELETE FROM audit_log").run(), /immuable/);

  const close = await call("PATCH", "/api/admin/offres/1/close", {}, T);
  assert.equal(close.data.status, "Clôturée");
  const ov = (await call("GET", "/api/admin/overview", null, T)).data;
  assert.ok(ov.kpis.users >= 24);

  // Analyste : peut voir stats, pas les utilisateurs ni agir
  const an = creds.find((c) => c.username === "analyste");
  const l2 = await call("POST", "/api/admin/login", { username: "analyste", password: an.password });
  const v2 = await call("POST", "/api/admin/verify-otp", { challenge: l2.data.challenge, code: totp(an.totpSecret) });
  assert.equal((await call("GET", "/api/admin/stats", null, v2.data.token)).status, 200);
  assert.equal((await call("GET", "/api/admin/users", null, v2.data.token)).status, 403);
  assert.equal((await call("PATCH", "/api/admin/offres/2/close", {}, v2.data.token)).status, 403);

  // Déconnexion invalide le jeton
  await call("POST", "/api/admin/logout", {}, T);
  assert.equal((await call("GET", "/api/admin/me", null, T)).status, 401);

  // Verrouillage après 3 échecs
  const bad = () => call("POST", "/api/admin/login", { username: "moderateur", password: "Mauvais-mdp-1" });
  assert.equal((await bad()).status, 401);
  assert.equal((await bad()).status, 401);
  assert.equal((await bad()).status, 423);
  const mod = creds.find((c) => c.username === "moderateur");
  assert.equal((await call("POST", "/api/admin/login", { username: "moderateur", password: mod.password })).status, 423, "reste bloqué même avec le bon mot de passe");
});

test("expiration d'inactivité admin (15 min)", async () => {
  const mod = creds.find((c) => c.username === "analyste");
  const l = await call("POST", "/api/admin/login", { username: "analyste", password: mod.password });
  const v = await call("POST", "/api/admin/verify-otp", { challenge: l.data.challenge, code: totp(mod.totpSecret) });
  app.db.prepare("UPDATE admin_sessions SET last_activity = last_activity - 1000 WHERE revoked = 0").run();
  assert.equal((await call("GET", "/api/admin/stats", null, v.data.token)).status, 401);
});

test("paiement d'acompte Mobile Money (Wave, Orange, MTN) et reçu", async () => {
  // 1. Créer d'abord une demande de devis
  const reqRes = await call("POST", "/api/requests", {
    title: "Installation climatiseur split",
    category: "Électricité",
    description: "Installation de 2 climatiseurs split à Angré",
    commune: "Cocody",
    firstName: "Amadou",
    lastName: "Traoré",
    phone: "0708091011",
    artisanId: 1,
  });
  assert.equal(reqRes.status, 201);
  const requestId = reqRes.data.id;

  // 2. Erreurs de validation
  const badOp = await call("POST", "/api/payments", { requestId, operator: "paypal", phone: "0708091011", amount: 20000 });
  assert.equal(badOp.status, 400);

  const badAmt = await call("POST", "/api/payments", { requestId, operator: "wave", phone: "0708091011", amount: 500 });
  assert.equal(badAmt.status, 400);

  // 3. Paiement réussi avec Wave
  const payRes = await call("POST", "/api/payments", {
    requestId,
    operator: "wave",
    phone: "0708091011",
    amount: 25000,
    customerName: "Amadou Traoré",
  });
  assert.equal(payRes.status, 201);
  assert.equal(payRes.data.status, "completed");
  assert.equal(payRes.data.amount, 25000);
  assert.ok(payRes.data.reference.startsWith("PRX-WAV-"), "La référence doit débuter par PRX-WAV-");

  // 4. Vérification mise à jour du statut de la demande
  const reqRow = app.db.prepare("SELECT status, amount FROM requests WHERE id = ?").get(requestId);
  assert.equal(reqRow.status, "Acompte versé");
  assert.equal(reqRow.amount, 25000);

  // 5. Consultation du reçu public
  const receipt = await call("GET", `/api/payments/receipt/${payRes.data.reference}`);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.data.reference, payRes.data.reference);
  assert.equal(receipt.data.amount, 25000);
  assert.equal(receipt.data.operator, "wave");
  assert.equal(receipt.data.request.title, "Installation climatiseur split");
  assert.ok(receipt.data.artisan.name.length > 0);

  // 6. Reçu inexistant renvoie 404
  const unknownReceipt = await call("GET", "/api/payments/receipt/PRX-WAV-000000");
  assert.equal(unknownReceipt.status, 404);
});

