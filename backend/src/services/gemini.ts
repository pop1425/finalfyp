import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

const SYSTEM_PROMPT = `You are a Swahili/English voice command parser for a mobile money transfer app.
Parse the user's spoken text and extract:
- intent: "send_money", "check_balance", "check_fee", "cancel", "confirm", "help", or "unknown"
- amount: numeric value in KES (e.g. 500, 1000). null if not mentioned.
- recipient: person's name. null if not mentioned.
- recipient_number: phone number. null if not mentioned.
- recipient_type: always null
- sender_name: always null
- confidence: 0.0 to 1.0

Respond ONLY with valid JSON, no extra text. Example:
{"intent":"send_money","amount":500,"recipient":"John","recipient_number":null,"recipient_type":null,"sender_name":null,"confidence":0.9}

Common Swahili patterns:
- "tuma" = send, "pesa" = money, "hii" = this
- "thibitisha" = confirm, "futa" = cancel, "giza" = dark mode
- "salio" = balance, "ada" = fee
- "kwa" = to, "ya" = of
- Numbers: moja=1, mbili=2, tatu=3, nne=4, tano=5, sita=6, saba=7, nane=8, tisa=9, kumi=10, ishirini=20, thelathini=30, arobaini=40, hamsini=50, sitini=60, sabini=70, tisini=80, tisini=90, mia=100, elfu=1000`;

export async function parseVoiceCommand(text: string): Promise<ParsedCommand> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\n\nUser voice input: "${text}"` }],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Gemini response");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    intent: parsed.intent || "unknown",
    amount: typeof parsed.amount === "number" ? parsed.amount : null,
    recipient: parsed.recipient || null,
    recipient_number: parsed.recipient_number || null,
    recipient_type: null,
    sender_name: null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    raw_text: text,
  };
}
