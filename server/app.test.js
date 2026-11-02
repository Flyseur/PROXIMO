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
  assert.ok(payRes.data.reference.startsWith("PRX-WAV-") || payRes.data.reference.startsWith("MTX-"), "La référence doit débuter par PRX-WAV- ou MTX- (GeniusPay)");

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

test("quotas d'offres et abonnements Pro / Entreprise (Mobile Money)", async () => {
  const testPhone = "0799887766";
  
  // 1. Inscription d'un utilisateur pour tester son quota et son abonnement
  const signupRes = await call("POST", "/api/auth/signup", {
    role: "client",
    firstName: "Konan",
    lastName: "Kouamé",
    phone: testPhone,
    commune: "Cocody",
    password: "Password123!",
  });
  assert.equal(signupRes.status, 201);
  const userToken = signupRes.data.token;

  // 2. Vérification initiale du quota (Gratuit : 3 offres max)
  const quotaInit = await call("GET", `/api/jobs/quota?phone=${testPhone}`, null, userToken);
  assert.equal(quotaInit.status, 200);
  assert.equal(quotaInit.data.plan, "Gratuit");
  assert.equal(quotaInit.data.limit, 3);
  assert.equal(quotaInit.data.currentCount, 0);
  assert.equal(quotaInit.data.remaining, 3);
  assert.equal(quotaInit.data.canPost, true);

  const jobPayload = {
    posterType: "particulier",
    contactName: "Konan Kouamé",
    phone: testPhone,
    title: "Recherche Chauffeur Privé",
    sector: "Transport & Logistique",
    contractType: "CDI",
    commune2: "Cocody",
    salary: "150 000 FCFA",
    profile: "Chauffeur expérimenté avec permis B valide.",
    description: "Missions quotidiennes de transport pour une famille.",
    howToApply: "whatsapp",
  };

  // 3. Publication des 3 premières offres autorisées en plan Gratuit
  for (let i = 1; i <= 3; i++) {
    const postRes = await call("POST", "/api/jobs", { ...jobPayload, title: `Offre test ${i}` }, userToken);
    assert.equal(postRes.status, 201);
    assert.equal(postRes.data.isFeatured, false);
    assert.equal(postRes.data.plan, "Gratuit");
  }

  // 4. Vérification que le quota est désormais épuisé
  const quotaFull = await call("GET", `/api/jobs/quota?phone=${testPhone}`, null, userToken);
  assert.equal(quotaFull.data.currentCount, 3);
  assert.equal(quotaFull.data.remaining, 0);
  assert.equal(quotaFull.data.canPost, false);

  // 5. La 4ème offre doit être rejetée avec 403 PLAN_LIMIT_REACHED
  const blockedPost = await call("POST", "/api/jobs", { ...jobPayload, title: "Offre 4 interdite" }, userToken);
  assert.equal(blockedPost.status, 403);
  assert.equal(blockedPost.data.code, "PLAN_LIMIT_REACHED");

  // 6. Souscription à la formule Pro (2 500 FCFA via Wave)
  const subRes = await call("POST", "/api/subscriptions", {
    plan: "Pro",
    operator: "wave",
    phone: testPhone,
  }, userToken);
  assert.equal(subRes.status, 201);
  assert.equal(subRes.data.plan, "Pro");
  assert.equal(subRes.data.amount, 2500);
  assert.equal(subRes.data.operator, "wave");
  assert.equal(subRes.data.billingCycle, "monthly");
  assert.equal(subRes.data.durationDays, 30);
  assert.ok(subRes.data.reference.startsWith("PRX-SUB-WAV-") || subRes.data.reference.startsWith("MTX-"));

  // 7. Vérification du quota Pro (illimité)
  const quotaPro = await call("GET", `/api/jobs/quota?phone=${testPhone}`, null, userToken);
  assert.equal(quotaPro.data.plan, "Pro");
  assert.equal(quotaPro.data.isUnlimited, true);
  assert.equal(quotaPro.data.canPost, true);

  // 8. La 4ème offre est désormais acceptée et mise en avant (isFeatured = true)
  const allowedPost = await call("POST", "/api/jobs", { ...jobPayload, title: "Offre 4 acceptée en Pro" }, userToken);
  assert.equal(allowedPost.status, 201);
  assert.equal(allowedPost.data.isFeatured, true);
  assert.equal(allowedPost.data.plan, "Pro");

  // 9. Vérification du profil /api/me (historique des souscriptions et quota mensuel)
  const meRes = await call("GET", "/api/me", null, userToken);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.user.plan, "Pro");
  assert.ok(meRes.data.subscriptions.length >= 1);
  assert.equal(meRes.data.subscriptions[0].reference, subRes.data.reference);
  assert.equal(meRes.data.monthlyJobs.count, 4);
  assert.equal(meRes.data.monthlyJobs.limit, null); // Illimité
});

test("passerelle GeniusPay : vérification de transaction et webhook", async () => {
  // 1. Vérification d'une référence via GET /api/geniuspay/verify/:reference
  const verifyRes = await call("GET", "/api/geniuspay/verify/MTX-TEST123456");
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.data.success, true);
  assert.equal(verifyRes.data.data.reference, "MTX-TEST123456");

  // 2. Réception d'un webhook GeniusPay
  const webhookRes = await call("POST", "/api/webhooks/geniuspay", {
    success: true,
    data: {
      reference: "MTX-TEST123456",
      status: "completed",
      amount: 15000,
    },
  });
  assert.equal(webhookRes.status, 200);
  assert.equal(webhookRes.data.received, true);
});

test("tarifs annuels Option 3 : souscription Pro (25 000 FCFA/an) et Entreprise (50 000 FCFA/an)", async () => {
  const annualPhone = "0711223344";

  // 1. Souscription Pro Annuelle (25 000 FCFA au lieu de 30 000 FCFA - 2 mois offerts)
  const proAnnual = await call("POST", "/api/subscriptions", {
    plan: "Pro",
    operator: "orange_money",
    phone: annualPhone,
    billingCycle: "yearly",
  });
  assert.equal(proAnnual.status, 201);
  assert.equal(proAnnual.data.plan, "Pro");
  assert.equal(proAnnual.data.amount, 25000);
  assert.equal(proAnnual.data.billingCycle, "yearly");
  assert.equal(proAnnual.data.durationDays, 365);
  assert.ok(proAnnual.data.token, "Un token JWT doit être renvoyé pour auto-connexion");

  // Vérification de la date d'expiration (dans ~365 jours)
  const proExpires = new Date(proAnnual.data.expiresAt);
  const now = new Date();
  const diffDays = Math.round((proExpires - now) / (1000 * 60 * 60 * 24));
  assert.ok(diffDays >= 364 && diffDays <= 366, `Expiration Pro attendue à 365 jours, obtenu: ${diffDays}`);

  // 2. Souscription Entreprise Annuelle (50 000 FCFA au lieu de 60 000 FCFA - 2 mois offerts)
  const entPhone = "0755667788";
  const entAnnual = await call("POST", "/api/subscriptions", {
    plan: "Entreprise",
    operator: "mtn_momo",
    phone: entPhone,
    billingCycle: "yearly",
  });
  assert.equal(entAnnual.status, 201);
  assert.equal(entAnnual.data.plan, "Entreprise");
  assert.equal(entAnnual.data.amount, 50000);
  assert.equal(entAnnual.data.billingCycle, "yearly");
  assert.equal(entAnnual.data.durationDays, 365);

  const entExpires = new Date(entAnnual.data.expiresAt);
  const entDiffDays = Math.round((entExpires - now) / (1000 * 60 * 60 * 24));
  assert.ok(entDiffDays >= 364 && entDiffDays <= 366, `Expiration Entreprise attendue à 365 jours, obtenu: ${entDiffDays}`);
});

test("admin : acceptation de demande, CRM clients et traçabilité", async () => {
  // 1. Authentification superadmin
  const sa = creds.find((c) => c.username === "superadmin");
  const loginRes = await call("POST", "/api/admin/login", { username: "superadmin", password: sa.password });
  assert.equal(loginRes.status, 200);
  const code = totp(sa.totpSecret);
  const verifyRes = await call("POST", "/api/admin/verify-otp", { challenge: loginRes.data.challenge, code });
  assert.equal(verifyRes.status, 200);
  const token = verifyRes.data.token;

  // 2. Création d'une demande client
  const reqRes = await call("POST", "/api/requests", {
    title: "Pose carrelage salon 50m²",
    category: "Maçonnerie",
    description: "Besoin d'un maçon qualifié pour carreler mon salon à Cocody",
    commune: "Cocody",
    firstName: "Konan",
    lastName: "Yao",
    phone: "0711223344",
  });
  assert.equal(reqRes.status, 201);
  const reqId = reqRes.data.id;

  // 3. Acceptation de la demande par l'admin
  const acceptRes = await call("PATCH", `/api/admin/demandes/${reqId}/status`, { status: "En cours", amount: 75000 }, token);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.data.status, "En cours");
  assert.equal(acceptRes.data.amount, 75000);

  // 4. Consultation du CRM clients
  const clientsRes = await call("GET", "/api/admin/clients", null, token);
  assert.equal(clientsRes.status, 200);
  assert.ok(clientsRes.data.clients.length > 0);
  assert.ok(clientsRes.data.kpis.totalReceived >= 1);
  const clientYao = clientsRes.data.clients.find(c => c.phone.includes("0711223344") || c.name.includes("Konan Yao"));
  assert.ok(clientYao, "Client Konan Yao trouvé dans le CRM");
  assert.ok(clientYao.demandesCount >= 1);
  assert.ok(clientYao.totalRevenue >= 75000);

  // 5. Mise à jour du statut de contact du client
  const contactRes = await call("PATCH", `/api/admin/clients/${clientYao.phone}/contact`, {
    contactStatus: "Contacté",
    notes: "Appelé au téléphone, client ravi, rendez-vous fixé demain",
  }, token);
  assert.equal(contactRes.status, 200);
  assert.equal(contactRes.data.contactStatus, "Contacté");

  // 6. Consultation de la traçabilité complète
  const traceRes = await call("GET", "/api/admin/tracabilite", null, token);
  assert.equal(traceRes.status, 200);
  assert.ok(traceRes.data.actions.length > 0);
  assert.ok(traceRes.data.total > 0);
});





