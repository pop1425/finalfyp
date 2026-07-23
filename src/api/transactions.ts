import { apiFetch } from "./client";

export interface DisburseRequest {
  amount: number;
  recipient_name: string;
  recipient_phone: string;
  reference: string;
  sender_name?: string;
}

export interface DisburseResponse {
  success: boolean;
  transaction_id: string;
  snippe_reference?: string;
  status: string;
  message: string;
}

export interface FeeResponse {
  fee: number | { amount: number; fee: number; total: number };
}

export interface BalanceResponse {
  balance: number | { available: number; currency: string };
}

export interface StatusResponse {
  status: string;
  reference: string;
  amount?: number;
  [key: string]: unknown;
}

export async function disburse(req: DisburseRequest): Promise<DisburseResponse> {
  return apiFetch<DisburseResponse>("/api/transactions/disburse", {
    method: "POST",
    body: req,
  });
}

export async function getStatus(reference: string): Promise<StatusResponse> {
  return apiFetch<StatusResponse>(
    `/api/transactions/${encodeURIComponent(reference)}/status`
  );
}

export async function getFee(amount: number): Promise<FeeResponse> {
  return apiFetch<FeeResponse>(
    `/api/transactions/fee/${encodeURIComponent(String(amount))}`
  );
}

export async function getBalance(): Promise<BalanceResponse> {
  return apiFetch<BalanceResponse>("/api/transactions/balance");
}
