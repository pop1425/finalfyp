// src/config/ispGateway.ts

export const SNIPPE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_SNIPPE_API_KEY ?? "",
  webhookSecret: process.env.EXPO_PUBLIC_SNIPPE_WEBHOOK_SECRET ?? "",
};
