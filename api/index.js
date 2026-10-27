import { createApp } from "../server/app.js";

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp({
      dataDir: process.env.DATA_DIR || "/tmp",
      distDir: null,
      seed: false,
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
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Erreur serveur / base de données." }));
  }
}
