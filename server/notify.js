// Envoi des codes OTP aux artisans / clients.
// En développement (OTP_MODE=console) : affiche le code dans la console du serveur.
// En production : branchez ici WhatsApp Business Cloud API, Orange SMS API, MTN, Twilio…
export async function sendOtp(phone, code) {
  if (process.env.OTP_MODE === "provider") {
    // Exemple (à adapter) :
    // await fetch("https://graph.facebook.com/v20.0/<PHONE_ID>/messages", { method: "POST", headers: {...}, body: JSON.stringify({...}) });
    throw new Error("OTP_MODE=provider : implémentez l'envoi dans server/notify.js");
  }
  console.log(`📲 [OTP] +${phone} → code ${code}`);
}
