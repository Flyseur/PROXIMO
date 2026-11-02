import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createApp } from "./app.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Chargement minimal du fichier .env (sans dépendance)
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val !== "") process.env[m[1]] = val;
    }
  }
}

const port = Number(process.env.PORT ?? 3001);
const dataDir = path.join(root, "data");
const { server } = await createApp({
  dbFile: path.join(dataDir, "proximo.db"),
  dataDir,
  distDir: path.join(root, "dist"),
  seed: false,
});
server.listen(port, () => console.log(`🚀 Proximo CI — API sur http://localhost:${port}`));
