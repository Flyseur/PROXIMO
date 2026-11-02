// Module d'intégration GeniusPay pour Proximo CI
// Documentation : https://geniuspay.ci/docs/api
// Base URL : https://geniuspay.ci/api/v1/merchant

import { randomDigits } from "./crypto.js";

const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || "https://geniuspay.ci/api/v1/merchant";

export function isGeniusPayConfigured() {
  const key = process.env.GENIUSPAY_API_KEY;
  const secret = process.env.GENIUSPAY_API_SECRET;
  return Boolean(key && secret && !key.includes("votre_cle") && !key.includes("xxxxxxxx"));
}

/**
 * Mappe l'opérateur local Proximo vers la méthode GeniusPay
 * Proximo: wave, orange_money, mtn_momo -> GeniusPay: wave, orange_money, mtn_money, card
 */
export function mapPaymentMethod(op) {
  if (!op) return undefined;
  const lower = String(op).toLowerCase().trim();
  if (lower === "wave") return "wave";
  if (lower === "orange_money" || lower === "orange") return "orange_money";
  if (lower === "mtn_momo" || lower === "mtn" || lower === "mtn_money") return "mtn_money";
  if (lower === "card" || lower === "carte") return "card";
  return lower;
}

/**
 * Crée un paiement via GeniusPay API (POST /api/v1/merchant/payments)
 */
export async function createGeniusPayment({
  amount,
  currency = "XOF",
  paymentMethod,
  description,
  customer = {},
  successUrl,
  errorUrl,
  metadata = {},
}) {
  const apiKey = process.env.GENIUSPAY_API_KEY;
  const apiSecret = process.env.GENIUSPAY_API_SECRET;

  const mappedMethod = mapPaymentMethod(paymentMethod);

  // Si clés configurées : appel réel à l'API GeniusPay
  if (isGeniusPayConfigured()) {
    const payload = {
      amount: Number(amount),
      currency,
      ...(mappedMethod ? { payment_method: mappedMethod } : {}),
      ...(description ? { description: String(description).slice(0, 500) } : {}),
      customer: {
        ...(customer.name ? { name: String(customer.name).slice(0, 100) } : {}),
        ...(customer.email ? { email: String(customer.email).slice(0, 100) } : {}),
        ...(customer.phone ? { phone: String(customer.phone) } : {}),
        country: customer.country || "CI",
      },
      ...(successUrl ? { success_url: successUrl } : {}),
      ...(errorUrl ? { error_url: errorUrl } : {}),
      metadata: metadata || {},
    };

    const res = await fetch(`${GENIUSPAY_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const errMsg = json.error?.message || json.message || `Erreur GeniusPay (${res.status})`;
      throw new Error(errMsg);
    }

    return json.data;
  }

  // Mode Sandbox / Simulation réaliste (conforme à l'API GeniusPay)
  const randomRef = "MTX-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  const fee = Math.round(Number(amount) * 0.02); // Frais standard 2%
  const checkoutUrl = `https://geniuspay.ci/checkout/${randomRef}`;

  return {
    id: Number(randomDigits(6)),
    reference: randomRef,
    amount: Number(amount),
    currency,
    fees: fee,
    net_amount: Number(amount) - fee,
    status: "completed", // En simulation sandbox : statut complété direct
    payment_method: mappedMethod || "wave",
    payment_url: checkoutUrl,
    checkout_url: checkoutUrl,
    gateway: mappedMethod || "checkout",
    environment: "sandbox_simulated",
    customer,
    metadata,
    created_at: new Date().toISOString(),
  };
}

/**
 * Récupère les détails d'un paiement via sa référence GeniusPay (GET /api/v1/merchant/payments/{reference})
 */
export async function getGeniusPayment(reference) {
  const apiKey = process.env.GENIUSPAY_API_KEY;
  const apiSecret = process.env.GENIUSPAY_API_SECRET;

  if (isGeniusPayConfigured()) {
    const res = await fetch(`${GENIUSPAY_BASE_URL}/payments/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const errMsg = json.error?.message || json.message || "Transaction GeniusPay introuvable.";
      throw new Error(errMsg);
    }

    return json.data;
  }

  // Simulation Sandbox
  return {
    id: 12345,
    reference,
    amount: 15000,
    currency: "XOF",
    status: "completed",
    payment_method: "wave",
    metadata: {},
    environment: "sandbox_simulated",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };
}
