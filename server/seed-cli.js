// Réinitialise la base : supprime data/proximo.db puis relance le serveur (qui re-sème).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of ["proximo.db", "proximo.db-wal", "proximo.db-shm"]) fs.rmSync(path.join(root, "data", f), { force: true });
const { createApp } = await import("./app.js");
const app = await createApp({ dbFile: path.join(root, "data", "proximo.db"), dataDir: path.join(root, "data") });
await app.close();
console.log("✅ Base réinitialisée.");
