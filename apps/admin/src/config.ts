// API base URL. Set VITE_API_URL at build/dev time (defaults to local API).
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';
