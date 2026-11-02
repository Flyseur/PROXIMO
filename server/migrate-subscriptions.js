import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined && m[2] !== "") {
      process.env[m[1]] = m[2];
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL non configuré.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("🚀 Début de la migration Neon pour les abonnements et quotas...");
  
  // 1. Colonnes sur users
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='plan') THEN
        ALTER TABLE users ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'Gratuit';
        RAISE NOTICE 'Colonne users.plan ajoutée.';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='plan_expires_at') THEN
        ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMPTZ;
        RAISE NOTICE 'Colonne users.plan_expires_at ajoutée.';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='user_id') THEN
        ALTER TABLE jobs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Colonne jobs.user_id ajoutée.';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='is_featured') THEN
        ALTER TABLE jobs ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Colonne jobs.is_featured ajoutée.';
      END IF;
    END $$;
  `);

  // 2. Table subscriptions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan        VARCHAR(20) NOT NULL CHECK (plan IN ('Pro','Entreprise')),
      amount      INTEGER NOT NULL,
      operator    VARCHAR(20) NOT NULL CHECK (operator IN ('wave','orange_money','mtn_momo')),
      phone       VARCHAR(30) NOT NULL,
      reference   VARCHAR(100) NOT NULL UNIQUE,
      status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
      starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_user_month ON jobs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_featured ON jobs(is_featured);
  `);

  console.log("✅ Migration Neon réussie ! Table 'subscriptions' et colonnes de plans prêtes.");
  await pool.end();
}

run().catch((err) => {
  console.error("❌ Erreur de migration :", err);
  process.exit(1);
});
