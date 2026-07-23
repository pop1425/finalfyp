// src/utils/snippeService.ts
import { SNIPPE_CONFIG } from "../config/ispGateway";

const BASE_URL = "https://api.snippe.sh";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${SNIPPE_CONFIG.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Snippe-Version": "2026-01-25",
  };
}

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return "255" + digits.slice(1);
  return digits;
}

export interface DisbursementParams {
  amount: number;
  phoneNumber: string;
  recipientName: string;
  reference: string;
}

export interface DisbursementResult {
  success: boolean;
  reference?: string;
  status?: string;
  fees?: number;
  totalDebited?: number;
  provider?: string;
  message?: string;
}

async function apiGet(path: string, query?: Record<string, string>): Promise<any> {
  let url = BASE_URL + path;
  if (query) {
    const params = new URLSearchParams(query);
    url += "?" + params.toString();
  }
  const res = await fetch(url, { method: "GET", headers: headers() });
  const json = await res.json();
  if (json.status === "error") throw new Error(json.message || "API error");
  return json.data ?? json;
}

async function apiPost(path: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status === "error") throw new Error(json.message || "API error");
  return json.data ?? json;
}

export async function disburse(params: DisbursementParams): Promise<DisbursementResult> {
  try {
    const feeData = await apiGet("/v1/payouts/fee", { amount: String(params.amount) });
    const feeTotal = feeData.total_amount ?? params.amount + (feeData.fee_amount ?? 0);

    const balanceData = await apiGet("/v1/payments/balance");
    const available = balanceData.available?.value ?? balanceData.available_balance ?? 0;

    if (available < feeTotal) {
      return {
        success: false,
        message: `Salio haijitoshi. Unahitaji TZS ${feeTotal.toLocaleString()}, lakini una TZS ${available.toLocaleString()}`,
      };
    }

    const payout = await apiPost("/v1/payouts/send", {
      channel: "mobile",
      amount: params.amount,
      recipient_phone: normalisePhone(params.phoneNumber),
      recipient_name: params.recipientName,
      narration: params.reference,
    });

    return {
      success: true,
      reference: payout.reference,
      status: payout.status,
      fees: payout.fees?.value ?? 0,
      totalDebited: payout.total?.value ?? params.amount,
      provider: payout.channel?.provider,
    };
  } catch (error: any) {
    console.error("Snippe disbursement error:", error);
    return {
      success: false,
      message: error.message || "Hitilafu wakati wa kutuma pesa",
    };
  }
}

export async function queryTransaction(reference: string): Promise<any> {
  try {
    return await apiGet(`/v1/payouts/${encodeURIComponent(reference)}`);
  } catch (error: any) {
    console.error("Snippe query error:", error);
    return null;
  }
}
