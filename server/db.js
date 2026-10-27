let DatabaseSync = null;
try {
  const sqliteMod = await import("node:sqlite");
  DatabaseSync = sqliteMod.DatabaseSync;
} catch {
  // node:sqlite est indisponible (ex: Node < 22 sur Vercel serverless)
}
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SCHEMA_SQLITE = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL CHECK (role IN ('artisan','client')),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  commune       TEXT,
  status        TEXT NOT NULL DEFAULT 'En attente' CHECK (status IN ('Actif','En attente','Suspendu')),
  verified      INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artisans (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  trade        TEXT NOT NULL,
  price        TEXT,
  price_value  INTEGER,
  available    INTEGER NOT NULL DEFAULT 1,
  rating       REAL NOT NULL DEFAULT 0,
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
  slug       TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
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
  service_slug TEXT NOT NULL REFERENCES services(slug) ON DELETE CASCADE,
  PRIMARY KEY (artisan_id, service_slug)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  artisan_id INTEGER NOT NULL REFERENCES artisans(user_id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolio (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  artisan_id INTEGER NOT NULL REFERENCES artisans(user_id) ON DELETE CASCADE,
  url        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  budget      TEXT,
  urgency     TEXT,
  commune     TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  artisan_id  INTEGER REFERENCES artisans(user_id) ON DELETE SET NULL,
  amount      INTEGER,
  status      TEXT NOT NULL DEFAULT 'En attente' CHECK (status IN ('En attente','En cours','Terminé','Annulé','Acompte versé')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id    INTEGER REFERENCES requests(id) ON DELETE SET NULL,
  operator      TEXT NOT NULL CHECK (operator IN ('wave','orange_money','mtn_momo')),
  phone         TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  fee           INTEGER NOT NULL DEFAULT 0,
  reference     TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed')),
  customer_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_type   TEXT NOT NULL CHECK (poster_type IN ('entreprise','particulier')),
  company       TEXT,
  contact_name  TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  poster_commune TEXT,
  title         TEXT NOT NULL,
  sector        TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  commune       TEXT NOT NULL,
  salary        TEXT,
  nb_posts      INTEGER NOT NULL DEFAULT 1,
  profile       TEXT NOT NULL,
  experience    TEXT, studies TEXT, skills TEXT,
  description   TEXT NOT NULL,
  how_to_apply  TEXT NOT NULL DEFAULT 'whatsapp',
  applications  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Clôturée')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT, phone TEXT NOT NULL, subject TEXT, message TEXT NOT NULL,
  handled    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Super Admin','Modérateur','Analyste')),
  password_hash TEXT NOT NULL,
  totp_secret   TEXT NOT NULL,
  avatar        TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            TEXT PRIMARY KEY,
  admin_id      INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  ip            TEXT,
  issued_at     INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  revoked       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL DEFAULT (datetime('now')),
  admin_id   INTEGER,
  admin_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  ip         TEXT
);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log est immuable'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log est immuable'); END;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`;

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
  status      VARCHAR(30) NOT NULL DEFAULT 'En attente' CHECK (status IN ('En attente','En cours','Terminé','Annulé')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

export function translateSqlToPg(sql) {
  let s = sql;
  let hasIgnore = false;
  if (/insert\s+or\s+ignore\s+into/i.test(s)) {
    s = s.replace(/insert\s+or\s+ignore\s+into/i, "INSERT INTO ");
    hasIgnore = true;
  }
  s = s.replace(/datetime\('now',\s*'-30 days'\)/gi, "(NOW() - INTERVAL '30 days')");
  s = s.replace(/datetime\('now'\)/gi, "NOW()");
  s = s.replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "to_char($1, 'YYYY-MM')");
  let p = 1;
  s = s.replace(/\?/g, () => `$${p++}`);
  if (hasIgnore && !/on\s+conflict/i.test(s)) {
    s += " ON CONFLICT DO NOTHING";
  }
  return s;
}

function createPgAdapter(target) {
  const queryFn = (sql, params = []) => target.query(sql, params);
  const adapter = {
    isPg: true,
    prepare(sql) {
      const pgSql = translateSqlToPg(sql);
      return {
        async all(...params) {
          const res = await queryFn(pgSql, params);
          return res.rows ?? [];
        },
        async get(...params) {
          const res = await queryFn(pgSql, params);
          return res.rows?.[0];
        },
        async run(...params) {
          let runSql = pgSql;
          if (/^\s*insert\s+into/i.test(runSql) && !/returning/i.test(runSql) && !/on\s+conflict\s+do\s+nothing/i.test(runSql)) {
            runSql += " RETURNING id";
          }
          const res = await queryFn(runSql, params);
          const id = res.rows?.[0]?.id;
          return {
            lastInsertRowid: id !== undefined ? Number(id) : undefined,
            changes: res.rowCount,
          };
        },
      };
    },
    async exec(sql) {
      return await queryFn(sql);
    },
    close() {
      if (typeof target.end === "function") return target.end();
    },
  };
  return adapter;
}

export async function openDb(file) {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && file !== ":memory:") {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
    // Vérification de connexion et schéma
    await pool.query(SCHEMA_PG);
    const adapter = createPgAdapter(pool);
    adapter.pool = pool;
    return adapter;
  }

  // SQLite fallback
  if (!DatabaseSync) {
    throw new Error("SQLite n'est pas disponible dans cet environnement. Définissez DATABASE_URL pour utiliser Neon PostgreSQL.");
  }
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA_SQLITE);
  db.isPg = false;
  return db;
}

export async function tx(db, fn) {
  if (db.isPg && db.pool) {
    const client = await db.pool.connect();
    await client.query("BEGIN");
    try {
      const clientAdapter = createPgAdapter(client);
      const res = await fn(clientAdapter);
      await client.query("COMMIT");
      return res;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  db.exec("BEGIN");
  try {
    const r = await fn(db);
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
