import { createApp } from "../server/app.js";

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp({
      dataDir: process.env.DATA_DIR || "/tmp",
      distDir: null,
      seed: false,
    }).catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const { handler: appHandler } = await getApp();
    return await appHandler(req, res);
  } catch (err) {
    console.error("Vercel Serverless Function Error:", err);
    const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: !hasDbUrl
          ? "Base de données non configurée en production. Ajoutez la variable DATABASE_URL dans les paramètres Vercel."
          : "Erreur serveur / base de données.",
        detail: err?.message,
      })
    );
  }
}
