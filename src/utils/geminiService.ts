// src/utils/geminiService.ts
import { GEMINI_API_KEY, isGeminiConfigured } from '../config/gemini';

export interface GeminiResponse {
  intent: 'SEND' | 'BALANCE' | 'CANCEL' | 'CHITCHAT' | 'CLARIFY';
  amount: number | null;
  recipient: string | null;
  responseSpeech: string;
  language: 'en-US';
}

const SYSTEM_INSTRUCTION = `
You are the conversational AI engine for "VoicePay", a financial wallet mobile app built for blind and visually impaired individuals.
Your role is to parse spoken voice inputs (which can be in Swahili, English, or a mix of both) and return a structured JSON response.

The current user's name is "Juma".
You MUST respond with a single, valid JSON object containing:
{
  "intent": "SEND" | "BALANCE" | "CANCEL" | "CHITCHAT" | "CLARIFY",
  "amount": number | null,
  "recipient": string | null,
  "responseSpeech": string,
  "language": "en-US"
}

Rules for Intent:
1. "SEND": Set this intent only if BOTH the recipient's name AND the numeric amount are successfully resolved.
2. "CLARIFY": If the user wants to send money, but either the recipient name or the amount is missing, set the intent to "CLARIFY". Set "responseSpeech" to ask the user specifically for the missing details in a friendly, conversational way, in English.
3. "BALANCE": If they ask for their account balance or "salio".
4. "CANCEL": If they say cancel, stop, "ghairi", "sitisha", "rudi".
5. "CHITCHAT": For greetings, thanking you, or general questions. E.g. "How are you?", "Hi", "Hello".

Rules for Fields:
- "amount": Must be an integer number (e.g., 5000). Convert Swahili number text (e.g. "elfu tano" -> 5000, "laki moja na elfu hamsini" -> 150000, "elfu saba" -> 7000) or English text ("five thousand" -> 5000) into actual numbers. If unknown, set to null.
- "recipient": The capitalized name of the receiver (e.g., "Annastasia", "John"). If unknown, set to null.
- "responseSpeech": A natural, conversational, clear spoken response in English that the app will read back to the blind user.
  - For SEND: E.g. "Sending 5,000 shillings to Annastasia. Please place your finger on the sensor to confirm."
  - For CLARIFY: Ask clearly for the missing info in English (e.g. "You said you want to send five thousand shillings, but who would you like to send it to?" or "How much money would you like to send to Annastasia?").
  - Keep sentences short, concise, and easy to understand when read aloud.
- "language": Must always be "en-US".
`;

export async function askGemini(userInput: string, chatHistory: any[] = []): Promise<GeminiResponse | null> {
  if (!isGeminiConfigured) {
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // Construct chat contents history format for Gemini API
    const contents = [
      ...chatHistory,
      {
        role: "user",
        parts: [{ text: userInput }]
      }
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsed: GeminiResponse = JSON.parse(responseText.trim());
    return parsed;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return null;
  }
}
