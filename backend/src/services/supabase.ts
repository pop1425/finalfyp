import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function saveTransaction(tx: {
  transaction_id: string;
  amount: number;
  recipient: string;
  recipient_number: string;
  sender_name: string;
}) {
  const { data, error } = await supabase
    .from("transactions")
    .insert(tx)
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return data;
}

export async function updateTransactionStatus(
  transaction_id: string,
  status: string,
  snippe_reference?: string
) {
  const update: Record<string, unknown> = { status };
  if (snippe_reference) update.snippe_reference = snippe_reference;

  const { data, error } = await supabase
    .from("transactions")
    .update(update)
    .eq("transaction_id", transaction_id)
    .select()
    .single();

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return data;
}

export async function getTransactions(limit = 20, offset = 0) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return data;
}
