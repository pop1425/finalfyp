import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.SNIPPE_API_KEY!;
const BASE_URL = process.env.SNIPPE_BASE_URL || "https://api.snippe.sh";
const API_VERSION = process.env.SNIPPE_API_VERSION || "2026-01-25";

async function snippeFetch(path: string, options: RequestInit = {}, idempotencyKey?: string) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "X-Snippe-Version": API_VERSION,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Snippe API error ${res.status}: ${text}`);
  }

  return JSON.parse(text);
}

export async function getBalance() {
  const data = await snippeFetch("/v1/payments/balance");
  return data.data ?? data.balance ?? data;
}

export async function getFee(amount: number) {
  const data = await snippeFetch(`/v1/payouts/fee?amount=${amount}`);
  return data.data ?? data;
}

export async function sendPayout(params: {
  amount: number;
  recipient_name: string;
  recipient_phone: string;
  narration?: string;
  webhook_url?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}) {
  const payload: Record<string, unknown> = {
    amount: params.amount,
    channel: "mobile",
    recipient_phone: params.recipient_phone,
    recipient_name: params.recipient_name,
  };

  if (params.narration) payload.narration = params.narration;
  if (params.webhook_url) payload.webhook_url = params.webhook_url;
  if (params.metadata) payload.metadata = params.metadata;

  const data = await snippeFetch("/v1/payouts/send", {
    method: "POST",
    body: JSON.stringify(payload),
  }, params.idempotencyKey);

  return data.data ?? data;
}

export async function queryPayout(reference: string) {
  const data = await snippeFetch(`/v1/payouts/${reference}`);
  return data.data ?? data;
}
