import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.SNIPPE_API_KEY!;
const BASE_URL = process.env.SNIPPE_BASE_URL || "https://api.snippe.sh";
const API_VERSION = process.env.SNIPPE_API_VERSION || "2026-01-25";
const CHANNEL_ID = process.env.SNIPPE_CHANNEL_ID || "64190d8b11b2686616d63472";
const CURRENCY = process.env.SNIPPE_CURRENCY || "KES";
const DEFAULT_SENDER_NAME = process.env.SNIPPE_DEFAULT_SENDER_NAME || "Emmanuel Joseph";
const DEFAULT_SENDER_PHONE = process.env.SNIPPE_DEFAULT_SENDER_PHONE || "255768354170";

async function snippeFetch(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "X-Snippe-Version": API_VERSION,
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
  return data.balance ?? data;
}

export async function getFee(amount: number) {
  const data = await snippeFetch(
    `/v1/payouts/fee?amount=${amount}&currency=${CURRENCY}&channel_id=${CHANNEL_ID}`
  );
  return data.fee ?? data;
}

export async function sendPayout(params: {
  amount: number;
  recipient_name: string;
  recipient_phone: string;
  reference: string;
  sender_name?: string;
}) {
  const payload = {
    amount: params.amount,
    currency: CURRENCY,
    channel_id: CHANNEL_ID,
    recipient: {
      type: "mobile",
      name: params.recipient_name,
      phone_number: params.recipient_phone,
    },
    reference: params.reference,
    sender: {
      name: params.sender_name || DEFAULT_SENDER_NAME,
      phone_number: DEFAULT_SENDER_PHONE,
    },
  };

  const data = await snippeFetch("/v1/payouts/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data;
}

export async function queryPayout(reference: string) {
  const data = await snippeFetch(`/v1/payouts/${reference}`);
  return data;
}
