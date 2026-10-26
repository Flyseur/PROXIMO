import crypto from "node:crypto";
import { hashPassword, randomBase32, otpauthUrl } from "./crypto.js";
import { tx } from "./db.js";

const U = (id, w = 400, h = 400) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format`;
const P = {
  m1: "1507003211169-0a1dd7228f2d", f1: "1494790108377-be9c29b29330", m2: "1500648767791-00dcc994a43e",
  f2: "1438761681033-6461ffad8d80", m3: "1472099645785-5658abf4ff4e", f3: "1544005313-94ddf0286df2",
};

// ── Catalogue de services ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: "batiment", title: "🏗️ Bâtiment & Construction", desc: "Tous les corps de métier du bâtiment", services: [
    ["🔨", "Menuiserie & Ébénisterie", "menuiserie", 148, "15 000 FCFA/h", "1504148455328-c376907d081c"],
    ["⚡", "Électricité", "electricite", 203, "18 000 FCFA/h", "1621905251189-08b45d6a269e"],
    ["🚿", "Plomberie & Sanitaire", "plomberie", 176, "16 500 FCFA/h", "1558618666-fcd25c85cd64"],
    ["🎨", "Peinture & Décoration", "peinture", 264, "12 000 FCFA/h", "1562259949-e8e7689d7828"],
    ["🧱", "Maçonnerie & Carrelage", "maconnerie", 95, "14 000 FCFA/h", "1504307651254-35680f356dfd"],
    ["🏠", "Toiture & Couverture", "toiture", 67, "20 000 FCFA/h", "1558036117-15d82a90b9b1"],
    ["❄️", "Climatisation & VMC", "climatisation", 134, "19 000 FCFA/h", "1585771724684-38269d6639fd"],
    ["🌿", "Jardinage & Paysagisme", "jardinage", 112, "10 000 FCFA/h", "1416879595882-3373a0480b5b"],
    ["🪟", "Vitrerie & Aluminium", "vitrerie", 54, "17 000 FCFA/h", "1497366216548-37526070297c"],
    ["🔩", "Métallerie & Ferronnerie", "metallerie", 43, "16 000 FCFA/h", "1581578731548-c64695cc6952"],
  ]},
  { id: "automobile", title: "🚗 Automobile & Mobilité", desc: "Mécanique, carrosserie et entretien véhicules", services: [
    ["🔧", "Mécanicien auto", "mecanicien", 189, "13 000 FCFA/h", "1530046339160-ce3e530c7d2f"],
    ["🎨", "Carrosserie & Peinture auto", "carrosserie", 76, "15 000 FCFA/h", "1489824904134-891ab64532f1"],
    ["🔋", "Électricité automobile", "electricite-auto", 92, "14 000 FCFA/h", "1565043666747-69f6646db940"],
    ["🚗", "Pneumatique & Pneus", "pneumatique", 118, "5 000 FCFA", "1558618666-fcd25c85cd64"],
    ["🚘", "Chauffeur VTC / Transport", "chauffeur", 241, "25 000 FCFA/j", "1449965408869-eaa3f722e40d"],
  ]},
  { id: "beaute", title: "💅 Beauté & Bien-être", desc: "Coiffure, esthétique et soins à domicile", services: [
    ["💇", "Coiffeur / Coiffeuse", "coiffeur", 312, "8 000 FCFA", "1522337360788-8b13dee7a37e"],
    ["💅", "Esthéticienne / Manucure", "esthetique", 187, "7 000 FCFA", "1604654894610-df63bc536371"],
    ["💆", "Massothérapeute", "massage", 64, "15 000 FCFA/séance", "1544161515-4ab6ce6db874"],
  ]},
  { id: "maison", title: "🏡 Services à domicile", desc: "Aide à la personne, entretien et vie quotidienne", services: [
    ["👶", "Nounou / Garde d'enfants", "nounous", 143, "12 000 FCFA/j", "1471286174890-9c112ffca5b4"],
    ["🧹", "Nettoyage & Entretien", "nettoyage", 228, "10 000 FCFA/j", "1558618666-fcd25c85cd64"],
    ["👨‍🍳", "Cuisinier / Cuisinière", "cuisiniers", 97, "20 000 FCFA/j", "1556909114-f6e7ad7d3136"],
    ["🍽️", "Serveur / Serveuse", "serveurs", 156, "15 000 FCFA/j", "1414235077428-338989a2e8c0"],
  ]},
  { id: "evenement", title: "🎉 Événementiel & Médias", desc: "Photo, vidéo, animation et organisation", services: [
    ["📸", "Photographe", "photographes", 118, "50 000 FCFA/j", "1502920917128-1aa500764cbd"],
    ["🎬", "Vidéaste / Cameraman", "videaste", 72, "60 000 FCFA/j", "1440404653325-ab127d49abc1"],
    ["🎤", "DJ / Animateur", "dj", 89, "80 000 FCFA/soirée", "1493225457124-a3eb161ffa5f"],
  ]},
];

const PAGES = {
  nounous: { label: "Nounous", short: "Gardes d'enfants qualifiées", color: "bg-pink-50 border-pink-200 text-pink-700",
    title: "Nounous & Gardes d'enfants", desc: "Confiez vos enfants à des nounous de confiance, à domicile.",
    long: "Nos nounous sont sélectionnées, formées aux gestes de premiers secours et vérifiées par notre équipe. Elles interviennent à votre domicile à Abidjan et dans les environs.",
    img: "1471286174890-9c112ffca5b4", tasks: ["Garde à domicile (journée ou demi-journée)", "Aide aux devoirs", "Activités d'éveil", "Préparation des repas des enfants", "Sortie d'école"] },
  chauffeur: { label: "Chauffeurs", short: "Transport et VTC", color: "bg-blue-50 border-blue-200 text-blue-700",
    title: "Chauffeurs & Transport VTC", desc: "Des chauffeurs professionnels pour vos trajets et déplacements.",
    long: "Nos chauffeurs sont titulaires du permis de conduire en cours de validité, connaissent parfaitement Abidjan et ses environs. Disponibles à la journée, à la semaine ou pour des trajets ponctuels.",
    img: "1449965408869-eaa3f722e40d", tasks: ["Chauffeur personnel à la journée", "Transport aéroport / hôtel", "Navette entreprise", "Conduite pour événements", "Courses et commissions"] },
  nettoyage: { label: "Nettoyage", short: "Entretien & ménage", color: "bg-cyan-50 border-cyan-200 text-cyan-700",
    title: "Nettoyage & Entretien", desc: "Professionnels du ménage, nettoyage de bureaux et espaces.",
    long: "Des agents de nettoyage qualifiés pour votre domicile, vos bureaux ou vos locaux commerciaux. Intervention ponctuelle ou contrat régulier.",
    img: "1581578731548-c64695cc6952", tasks: ["Ménage domicile", "Nettoyage de bureaux", "Nettoyage après travaux", "Entretien de locaux commerciaux", "Lavage de vitres"] },
  serveurs: { label: "Serveurs", short: "Pour vos événements", color: "bg-amber-50 border-amber-200 text-amber-700",
    title: "Serveurs & Serveuses événement", desc: "Personnel de service pour mariages, soirées et événements.",
    long: "Des serveurs et serveuses expérimentés pour assurer le service lors de vos événements : mariages, baptêmes, séminaires, soirées d'entreprise.",
    img: "1414235077428-338989a2e8c0", tasks: ["Service à table", "Service buffet / cocktail", "Bar et boissons", "Accueil des invités", "Mise en place et débarrassage"] },
  cuisiniers: { label: "Cuisiniers", short: "Cuisine à domicile", color: "bg-orange-50 border-orange-200 text-orange-700",
    title: "Cuisiniers à domicile", desc: "Faites-vous cuisiner des repas savoureux à votre domicile.",
    long: "Des cuisiniers professionnels qui se déplacent chez vous pour préparer vos repas du quotidien ou de fête. Cuisine ivoirienne, africaine, internationale.",
    img: "1556909114-f6e7ad7d3136", tasks: ["Cuisine du quotidien", "Repas de fête & cérémonies", "Traiteur événements", "Cuisine diététique", "Cours de cuisine"] },
  photographes: { label: "Photographes", short: "Photo & vidéo", color: "bg-purple-50 border-purple-200 text-purple-700",
    title: "Photographes professionnels", desc: "Photo et vidéo pour vos événements, portraits et entreprises.",
    long: "Des photographes et vidéastes professionnels pour capturer vos moments importants : mariages, cérémonies, événements d'entreprise, portraits.",
    img: "1502920917128-1aa500764cbd", tasks: ["Mariage & cérémonie", "Portrait professionnel", "Reportage événementiel", "Photo produit & commerce", "Drone & aerial"] },
};

// ── Artisans ──────────────────────────────────────────────────────────────────
// [prénom, nom, métier, commune, note, avis, tarif, valeur, dispo, photo, tags, tel, statut, vérifié, services, inscrit, missions, vedette, années]
const ARTISANS = [
  ["Jean-Baptiste", "Kouassi", "Menuisier ébéniste", "Cocody", 4.9, 87, "15 000 FCFA/h", 15000, 1, P.m1, ["Cuisine", "Parquet", "Mobilier"], "2250701234567", "Actif", 1, ["menuiserie"], "2026-01-12", 184, 1, 10],
  ["Marie-Claire", "Adjoua", "Électricienne certifiée", "Plateau", 4.8, 63, "18 000 FCFA/h", 18000, 1, P.f1, ["Tableau électrique", "Domotique"], "2250702345678", "Actif", 1, ["electricite"], "2026-02-05", 28, 1, 8],
  ["Moussa", "Traoré", "Plombier chauffagiste", "Yopougon", 4.9, 124, "16 500 FCFA/h", 16500, 0, P.m2, ["Chauffe-eau", "Salle de bain"], "2250703456789", "Actif", 1, ["plomberie"], "2026-04-08", 67, 1, 12],
  ["Fatoumata", "Koné", "Peintre décoratrice", "Marcory", 4.7, 52, "12 000 FCFA/h", 12000, 1, P.f2, ["Intérieur", "Façade", "Enduit"], "2250704567890", "Suspendu", 0, ["peinture"], "2026-05-01", 7, 0, 6],
  ["Issouf", "Bamba", "Maçon généraliste", "Abobo", 4.6, 41, "14 000 FCFA/h", 14000, 1, P.m3, ["Carrelage", "Extension", "Rénovation"], "2250705678901", "Actif", 0, ["maconnerie"], "2026-09-12", 0, 0, 9],
  ["Aminata", "Diabaté", "Jardinière paysagiste", "Koumassi", 4.8, 38, "10 000 FCFA/h", 10000, 1, P.f3, ["Taille", "Aménagement extérieur"], "2250706789012", "Actif", 0, ["jardinage"], "2026-03-02", 21, 0, 5],
  // pages dédiées
  ["Fatou", "Adjoua", "Nounou", "Cocody", 4.9, 62, "12 000 FCFA/j", 12000, 1, P.f2, ["Garde d'enfants", "Aide aux devoirs"], "2250701111111", "Actif", 1, ["nounous"], "2026-02-14", 40, 0, 7],
  ["Aminata", "Koné", "Nounou", "Yopougon", 4.8, 45, "11 000 FCFA/j", 11000, 1, P.f3, ["Garde d'enfants"], "2250702222222", "Actif", 0, ["nounous"], "2026-03-10", 25, 0, 5],
  ["Marie", "Diabaté", "Nounou", "Marcory", 4.7, 38, "10 000 FCFA/j", 10000, 1, P.f1, ["Garde d'enfants", "Activités d'éveil"], "2250703333333", "Actif", 0, ["nounous"], "2026-03-22", 18, 0, 4],
  ["Serge", "Kouassi", "Chauffeur", "Plateau", 4.9, 98, "25 000 FCFA/j", 25000, 1, P.m1, ["Transport aéroport", "Chauffeur personnel"], "2250704444444", "Actif", 1, ["chauffeur"], "2026-01-20", 120, 0, 11],
  ["Ismaël", "Traoré", "Chauffeur", "Cocody", 4.8, 74, "20 000 FCFA/j", 20000, 1, P.m2, ["Navette entreprise"], "2250705555555", "Actif", 0, ["chauffeur"], "2026-02-18", 90, 0, 8],
  ["Clarisse", "Yao", "Agente de nettoyage", "Adjamé", 4.8, 113, "10 000 FCFA/j", 10000, 1, P.f2, ["Ménage", "Bureaux"], "2250706666666", "Actif", 1, ["nettoyage"], "2026-01-30", 150, 0, 9],
  ["Rokia", "Coulibaly", "Agente de nettoyage", "Abobo", 4.7, 87, "9 000 FCFA/j", 9000, 1, P.f3, ["Après travaux", "Vitres"], "2250707777777", "Actif", 0, ["nettoyage"], "2026-04-02", 110, 0, 6],
  ["Jean-Paul", "Bamba", "Serveur", "Treichville", 4.9, 52, "15 000 FCFA/j", 15000, 1, P.m3, ["Mariages", "Cocktail"], "2250708888888", "Actif", 0, ["serveurs"], "2026-03-15", 60, 0, 6],
  ["Michel", "Gbagbo", "Cuisinier", "Koumassi", 5.0, 41, "20 000 FCFA/j", 20000, 1, P.m1, ["Cuisine ivoirienne", "Traiteur"], "2250709999999", "Actif", 1, ["cuisiniers"], "2026-02-25", 55, 0, 12],
  ["Evelyne", "N'Dri", "Cuisinière", "Cocody", 4.9, 67, "25 000 FCFA/j", 25000, 1, P.f1, ["Repas de fête", "Cuisine diététique"], "2250700000001", "Actif", 1, ["cuisiniers"], "2026-02-01", 80, 0, 10],
  ["Roland", "Koffi", "Photographe", "Plateau", 4.9, 88, "50 000 FCFA/j", 50000, 1, P.m3, ["Mariage", "Reportage"], "2250700000002", "Actif", 1, ["photographes"], "2026-01-18", 95, 0, 9],
  ["Amandine", "Soro", "Photographe", "Cocody", 4.8, 56, "45 000 FCFA/j", 45000, 1, P.f2, ["Portrait", "Produit"], "2250700000003", "Actif", 0, ["photographes"], "2026-03-05", 48, 0, 6],
  // utilisateurs du back-office
  ["Aminata", "Bamba", "Coiffeuse", "Treichville", 4.8, 90, "8 000 FCFA", 8000, 1, P.f1, ["Mariage", "Tresses"], "2250766778899", "Actif", 1, ["coiffeur"], "2026-06-22", 31, 0, 7],
  ["Serge", "Yao", "Chauffeur", "Koumassi", 0, 0, "25 000 FCFA/j", 25000, 1, P.m2, [], "2250777889900", "En attente", 0, ["chauffeur"], "2026-07-03", 0, 0, 2],
  ["Mamadou", "Touré", "Maçon", "Adjamé", 4.5, 12, "14 000 FCFA/h", 14000, 1, P.m3, ["Clôture", "Dalle"], "2250799001122", "Actif", 1, ["maconnerie"], "2026-08-02", 15, 0, 8],
];
const CLIENTS = [
  ["Mariam", "Coulibaly", "Cocody", "2250711223344", "2026-03-20"],
  ["Ibrahim", "Diallo", "Abobo", "2250755667788", "2026-05-14"],
  ["Cécile", "Ouattara", "Cocody", "2250788990011", "2026-07-18"],
];

const DEMANDES = [
  ["Rénovation salle de bain", "Plomberie", "Yopougon", "Mariam Coulibaly", "Traoré Moussa", 350000, "En cours", "2026-09-12"],
  ["Peinture salon + chambre", "Peinture", "Cocody", "Cécile Ouattara", "Koné Fatoumata", 120000, "Terminé", "2026-08-03"],
  ["Installation tableau électrique", "Électricité", "Plateau", "Ibrahim Diallo", "Adjoua Marie-Claire", 90000, "En attente", "2026-09-20"],
  ["Parquet chambre principale", "Menuiserie", "Cocody", "Mariam Coulibaly", "Kouassi Jean-Baptiste", 180000, "Terminé", "2026-07-15"],
  ["Nettoyage villa post-chantier", "Nettoyage", "Koumassi", "Serge Yao", "Bamba Aminata", 55000, "Terminé", "2026-08-10"],
  ["Coiffure mariage (10 personnes)", "Autre", "Cocody", "Cécile Ouattara", "Bamba Aminata", 200000, "En cours", "2026-09-18"],
  ["Maçonnerie clôture 40m²", "Maçonnerie", "Abobo", "Ibrahim Diallo", "Touré Mamadou", 420000, "En attente", "2026-09-22"],
  ["Remplacement chauffe-eau", "Plomberie", "Yopougon", "Serge Yao", "Traoré Moussa", 75000, "Annulé", "2026-09-08"],
];
const OFFRES = [
  ["Recherche maçon pour construction annexe", "Particulier", "particulier", "Cocody", "Bâtiment & Travaux", "Freelance / Mission", "800 000 FCFA", 7, "Active", "2026-09-10"],
  ["Electricien pour câblage immeuble R+4", "Groupe Immobilier CI", "entreprise", "Plateau", "Bâtiment & Travaux", "CDI", "Négociable", 12, "Active", "2026-09-08"],
  ["Chauffeur particulier – disponibilité immédiate", "Famille Bah", "particulier", "Cocody", "Transport & Logistique", "CDD", "150 000 FCFA", 4, "Active", "2026-09-15"],
  ["Photographe pour lancement produit", "SIMCA Côte d'Ivoire", "entreprise", "Marcory", "Événementiel", "Freelance / Mission", "300 000 FCFA", 9, "Clôturée", "2026-09-01"],
  ["Cuisiniers (x3) pour restaurant Cocody", "Restaurant Le Baobab", "entreprise", "Cocody", "Cuisine & Restauration", "CDI", "120 000 FCFA", 18, "Active", "2026-09-18"],
  ["Nounous expérimentées – garde d'enfants", "Famille Touré", "particulier", "Yopougon", "Services à la personne", "CDD", "80 000 FCFA", 6, "Active", "2026-09-20"],
];
const AUDIT = [
  ["2026-09-20 08:14:22", "Konan Alexandre", "CONNEXION", "Session ouverte", "info", "196.168.1.45"],
  ["2026-09-20 08:18:05", "Konan Alexandre", "SUSPEND_USER", "Koné Fatoumata (ID #4)", "warning", "196.168.1.45"],
  ["2026-09-19 17:42:11", "Awa Diallo", "CONNEXION", "Session ouverte", "info", "196.168.1.72"],
  ["2026-09-19 17:45:33", "Awa Diallo", "CLOSE_OFFER", "Offre #4 — Photographe SIMCA", "warning", "196.168.1.72"],
  ["2026-09-19 15:30:00", "Konan Alexandre", "APPROVE_USER", "Touré Mamadou (ID #21)", "info", "196.168.1.45"],
  ["2026-09-18 11:20:44", "Konan Alexandre", "DECONNEXION", "Session fermée (expiration)", "info", "196.168.1.45"],
];

const ADMINS = [
  ["superadmin", "Konan Alexandre", "Super Admin", P.m1],
  ["moderateur", "Awa Diallo", "Modérateur", P.f2],
  ["analyste", "Yao Franck", "Analyste", P.m2],
];

function randomPassword() {
  const pick = (s) => s[crypto.randomInt(0, s.length)];
  const chars = [pick("ABCDEFGHJKLMNPQRSTUVWXYZ"), pick("abcdefghijkmnpqrstuvwxyz"), pick("23456789"), pick("!@#$%*")];
  const all = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*";
  while (chars.length < 16) chars.push(pick(all));
  return chars.sort(() => crypto.randomInt(0, 2) - 0.5).join("");
}

const tagsOf = (t) => JSON.stringify(t);

export async function seedIfEmpty(db, { log = console.log, devPassword } = {}) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM services").get();
  const n = Number(row?.n ?? 0);
  if (n > 0) return null;
  const credentials = [];

  await tx(db, async () => {
    // Services
    const insSvc = db.prepare(`INSERT INTO services (slug, section_id, section_title, section_desc, section_pos, pos, icon, label, pros_count, avg_price, img,
      page_label, page_title, page_desc, page_long_desc, page_img, page_color, tasks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (let si = 0; si < SECTIONS.length; si++) {
      const s = SECTIONS[si];
      for (let i = 0; i < s.services.length; i++) {
        const [icon, label, slug, count, avg, img] = s.services[i];
        const pg = PAGES[slug];
        await insSvc.run(slug, s.id, s.title, s.desc, si, i, icon, label, count, avg, U(img, 400, 280),
          pg?.label ?? null, pg?.title ?? null, pg?.desc ?? null, pg?.long ?? null, pg ? U(pg.img, 1200, 500) : null, pg?.color ?? null, JSON.stringify(pg?.tasks ?? []));
      }
    }

    // Mot de passe d'amorçage des comptes de démonstration (artisans/clients)
    const demoHash = hashPassword(devPassword ?? randomPassword());

    // Artisans
    const insUser = db.prepare(`INSERT INTO users (role, first_name, last_name, phone, password_hash, commune, status, verified, phone_verified, created_at)
      VALUES (?,?,?,?,?,?,?,?,1,?)`);
    const insArt = db.prepare(`INSERT INTO artisans (user_id, trade, price, price_value, available, rating, reviews_count, img, tags, specialties, zones, zone_label, bio, years_experience, missions, featured)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insLink = db.prepare("INSERT OR IGNORE INTO artisan_services (artisan_id, service_slug) VALUES (?,?)");
    for (const a of ARTISANS) {
      const [first, last, trade, commune, rating, reviews, price, pv, avail, photo, tags, phone, status, verified, svcs, joined, missions, featured, years] = a;
      const uRes = await insUser.run("artisan", first, last, phone, demoHash, commune, status, verified, `${joined} 09:00:00`);
      const id = Number(uRes.lastInsertRowid);
      await insArt.run(id, trade, price, pv, avail, rating, reviews, U(photo), tagsOf(tags), tagsOf(tags), tagsOf([commune]), `${commune}, Abidjan`,
        `${trade} basé(e) à ${commune}. ${years} ans d'expérience. Intervention rapide et travail soigné.`, years, missions, featured);
      for (const s of svcs) {
        await insLink.run(id, s);
      }
    }
    // Profil détaillé de l'artisan #1 (repris de la maquette)
    await db.prepare(`UPDATE artisans SET zone_label=?, bio=?, specialties=?, zones=? WHERE user_id=1`).run(
      "Abidjan (rayon 20 km)",
      "Artisan menuisier-ébéniste depuis 10 ans, basé à Cocody (Abidjan). Je réalise tous vos travaux de menuiserie intérieure et extérieure : cuisines sur mesure, parquet, escaliers, meubles et portes.",
      tagsOf(["Cuisine sur mesure", "Parquet", "Escaliers", "Meubles", "Fenêtres", "Portes"]),
      tagsOf(["Cocody", "Plateau", "Marcory", "Treichville", "Adjamé"]));

    const insRev = db.prepare("INSERT INTO reviews (artisan_id, author, rating, text, created_at) VALUES (?,?,?,?,?)");
    await insRev.run(1, "Coulibaly Mariam", 5, "Travail exceptionnel, ponctuel et très propre. Je recommande vivement pour tous travaux de menuiserie à Cocody.", "2026-08-20 10:00:00");
    await insRev.run(1, "Koffi Pierre", 5, "Excellent artisan, à l'écoute de mes besoins. La cuisine réalisée est magnifique, le prix en FCFA est très raisonnable.", "2026-07-15 10:00:00");
    await insRev.run(1, "Diouf Isabelle", 4, "Très bon travail. Quelques ajustements ont été nécessaires mais au final très satisfaite.", "2026-06-10 10:00:00");

    const insPf = db.prepare("INSERT INTO portfolio (artisan_id, url) VALUES (?,?)");
    for (const p of ["1556909114-f6e7ad7d3136", "1558618666-fcd25c85cd64", "1600585154340-be6161a56a0c", "1484154218962-a197022b5858"]) {
      await insPf.run(1, U(p, 600, 400));
    }

    // Clients
    for (const [first, last, commune, phone, joined] of CLIENTS) {
      await insUser.run("client", first, last, phone, demoHash, commune, "Actif", 0, `${joined} 09:00:00`);
    }

    // Demandes
    const findUser = db.prepare("SELECT u.id, u.first_name, u.last_name, u.phone FROM users u WHERE u.first_name || ' ' || u.last_name = ? OR u.last_name || ' ' || u.first_name = ?");
    const insReq = db.prepare(`INSERT INTO requests (title, category, description, commune, first_name, last_name, phone, artisan_id, amount, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const [title, cat, commune, client, artisan, amount, status, date] of DEMANDES) {
      const c = (await findUser.get(client, client)) ?? { first_name: client.split(" ")[0], last_name: client.split(" ").slice(1).join(" "), phone: "2250700000000" };
      const art = await findUser.get(artisan, artisan);
      await insReq.run(title, cat, title, commune, c.first_name, c.last_name, c.phone, art?.id ?? null, amount, status, `${date} 10:00:00`);
    }

    // Offres d'emploi
    const insJob = db.prepare(`INSERT INTO jobs (poster_type, company, contact_name, phone, title, sector, contract_type, commune, salary, profile, description, applications, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const [title, company, type, commune, sector, contract, salary, apps, status, date] of OFFRES) {
      await insJob.run(type, company, company, "2250700000000", title, sector, contract, commune, salary, "À préciser", title, apps, status, `${date} 09:00:00`);
    }

    // Admins (mots de passe + secrets TOTP aléatoires, affichés une seule fois)
    const insAdmin = db.prepare("INSERT INTO admins (username, display_name, role, password_hash, totp_secret, avatar) VALUES (?,?,?,?,?,?)");
    for (const [username, display, role, photo] of ADMINS) {
      const password = randomPassword();
      const secret = randomBase32();
      await insAdmin.run(username, display, role, hashPassword(password), secret, U(photo, 80, 80));
      credentials.push({ username, role, password, totpSecret: secret, otpauth: otpauthUrl(username, secret) });
    }

    // Journal d'audit initial
    const insAudit = db.prepare("INSERT INTO audit_log (at, admin_name, action, target, severity, ip) VALUES (?,?,?,?,?,?)");
    for (const e of AUDIT) {
      await insAudit.run(...e);
    }
  });

  log("\n🌱 Base initialisée avec les données de démonstration.");
  log("─────────────── COMPTES ADMIN (affichés une seule fois) ───────────────");
  for (const c of credentials) {
    log(`  ${c.role.padEnd(12)} identifiant: ${c.username}`);
    log(`               mot de passe: ${c.password}`);
    log(`               secret TOTP : ${c.totpSecret}   (ajoutez-le dans Google Authenticator / Authy)`);
  }
  log("───────────────────────────────────────────────────────────────────────\n");
  return credentials;
}
