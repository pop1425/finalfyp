// src/config/gemini.ts

// TODO: Replace with your actual Gemini API Key from Google AI Studio
export const GEMINI_API_KEY: string = "";

export const isGeminiConfigured = !!(
  GEMINI_API_KEY && 
  GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY" && 
  GEMINI_API_KEY.trim() !== ""
);
