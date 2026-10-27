import { openDb } from './db.js';
import { hashPassword } from './crypto.js';

async function main() {
  const [,, username = 'superadmin', newPassword = ''] = process.argv;
  if (!newPassword) {
    console.log("Usage: node server/set-admin-password.js <username> <new_password>");
    return;
  }
  const db = await openDb();
  try {
    const admin = await db.prepare("SELECT * FROM admins WHERE username = ?").get(username.toLowerCase());
    if (!admin) {
      console.error(`Administrateur '${username}' non trouvé.`);
      return;
    }
    const hash = hashPassword(newPassword);
    await db.prepare("UPDATE admins SET password_hash = ?, failed_attempts = 0, locked_until = 0 WHERE id = ?")
      .run(hash, admin.id);
    console.log(`✅ Mot de passe mis à jour avec succès pour '${username}' !`);
    console.log(`Clé secrète 2FA TOTP pour Google Authenticator : ${admin.totp_secret}`);
  } catch (err) {
    console.error("Erreur:", err);
  } finally {
    await db.close();
  }
}

main();
