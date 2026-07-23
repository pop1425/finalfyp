// src/config/gemini.ts

export const GEMINI_API_KEY: string = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";

export const isGeminiConfigured = !!(
  GEMINI_API_KEY &&
  GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY" &&
  GEMINI_API_KEY.trim() !== ""
);
