// API base URL. On a physical device, localhost won't resolve — set
// EXPO_PUBLIC_API_URL (e.g. https://api.bluecard.example) when building.
// Expo injects EXPO_PUBLIC_* at build time; declare it so TS is happy without
// pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
