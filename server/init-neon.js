import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined && m[2] !== "") process.env[m[1]] = m[2];
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL manquante dans .env");
  process.exit(1);
}

const SCHEMA_PG = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('artisan','client')),
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(30) NOT NULL UNIQUE,
  email         VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  commune       VARCHAR(100),
  status        VARCHAR(20) NOT NULL DEFAULT 'En attente' CHECK (status IN ('Actif','En attente','Suspendu')),
  verified      INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artisans (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  trade        TEXT NOT NULL,
  price        TEXT,
  price_value  INTEGER,
  available    INTEGER NOT NULL DEFAULT 1,
  rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  img          TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  specialties  TEXT NOT NULL DEFAULT '[]',
  zones        TEXT NOT NULL DEFAULT '[]',
  zone_label   TEXT,
  bio          TEXT,
  years_experience INTEGER,
  missions     INTEGER NOT NULL DEFAULT 0,
  featured     INTEGER NOT NULL DEFAULT 0,
  diplome      TEXT, ecole TEXT, certification TEXT
);

CREATE TABLE IF NOT EXISTS services (
  slug       VARCHAR(100) PRIMARY KEY,
  section_id VARCHAR(50) NOT NULL,
  section_title TEXT NOT NULL,
  section_desc  TEXT NOT NULL,
  section_pos   INTEGER NOT NULL,
  pos        INTEGER NOT NULL,
  icon       TEXT NOT NULL,
  label      TEXT NOT NULL,
  pros_count INTEGER NOT NULL DEFAULT 0,
  avg_price  TEXT,
  img        TEXT,
  page_label TEXT, page_title TEXT, page_desc TEXT, page_long_desc TEXT, page_img TEXT,
  page_color TEXT, tasks TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS artisan_services (
  artisan_id   INTEGER NOT NULL REFERENCES artisans(user_id) ON DELETE CASCADE,
  service_slug VARCHAR(100) NOT NULL REFERENCES services(slug) ON DELETE CASCADE,
  PRIMARY KEY (artisan_id, service_slug)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  artisan_id INTEGER NOT NULL REFERENCES artisans(user_id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio (
  id         SERIAL PRIMARY KEY,
  artisan_id INTEGER NOT NULL REFERENCES artisans(user_id) ON DELETE CASCADE,
  url        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  budget      TEXT,
  urgency     TEXT,
  commune     VARCHAR(100) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  email       VARCHAR(255),
  artisan_id  INTEGER REFERENCES artisans(user_id) ON DELETE SET NULL,
  amount      INTEGER,
  status      VARCHAR(30) NOT NULL DEFAULT 'En attente' CHECK (status IN ('En attente','En cours','Terminé','Annulé','Acompte versé')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  request_id    INTEGER REFERENCES requests(id) ON DELETE SET NULL,
  operator      VARCHAR(30) NOT NULL CHECK (operator IN ('wave','orange_money','mtn_momo')),
  phone         VARCHAR(30) NOT NULL,
  amount        INTEGER NOT NULL,
  fee           INTEGER NOT NULL DEFAULT 0,
  reference     VARCHAR(80) NOT NULL UNIQUE,
  status        VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed')),
  customer_name VARCHAR(150),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id            SERIAL PRIMARY KEY,
  poster_type   VARCHAR(20) NOT NULL CHECK (poster_type IN ('entreprise','particulier')),
  company       TEXT,
  contact_name  TEXT NOT NULL,
  phone         VARCHAR(30) NOT NULL,
  email         VARCHAR(255),
  poster_commune VARCHAR(100),
  title         TEXT NOT NULL,
  sector        TEXT NOT NULL,
  contract_type VARCHAR(50) NOT NULL,
  commune       VARCHAR(100) NOT NULL,
  salary        TEXT,
  nb_posts      INTEGER NOT NULL DEFAULT 1,
  profile       TEXT NOT NULL,
  experience    TEXT, studies TEXT, skills TEXT,
  description   TEXT NOT NULL,
  how_to_apply  VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  applications  INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Clôturée')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT, phone VARCHAR(30) NOT NULL, subject TEXT, message TEXT NOT NULL,
  handled    INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id         VARCHAR(100) PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  purpose    VARCHAR(50) NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  role          VARCHAR(50) NOT NULL CHECK (role IN ('Super Admin','Modérateur','Analyste')),
  password_hash TEXT NOT NULL,
  totp_secret   TEXT NOT NULL,
  avatar        TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            VARCHAR(100) PRIMARY KEY,
  admin_id      INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  ip            VARCHAR(50),
  issued_at     BIGINT NOT NULL,
  last_activity BIGINT NOT NULL,
  revoked       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_id   INTEGER,
  admin_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,
  severity   VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  ip         VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`;

async function main() {
  console.log("🚀 Connexion à Neon PostgreSQL...");
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  
  try {
    await pool.query(SCHEMA_PG);
    console.log("✅ Schéma créé avec succès sur Neon !");
    
    // Lister les tables créées
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("📋 Tables créées sur Neon :", res.rows.map(r => r.table_name).join(", "));
  } catch (err) {
    console.error("❌ Erreur de création du schéma :", err);
  } finally {
    await pool.end();
  }
}

main();
