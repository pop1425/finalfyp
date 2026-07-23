import { apiFetch } from "./client";

export interface ParsedCommand {
  intent: string;
  amount: number | null;
  recipient: string | null;
  recipient_number: string | null;
  recipient_type: null;
  sender_name: string | null;
  confidence: number;
  raw_text: string;
}

export async function parseVoiceCommand(text: string): Promise<ParsedCommand> {
  return apiFetch<ParsedCommand>("/api/nlp/parse", {
    method: "POST",
    body: { text },
  });
}
