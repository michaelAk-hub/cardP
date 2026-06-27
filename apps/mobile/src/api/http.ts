import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T = any> {
  status: number;
  data: T;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
}

// Low-level fetch wrapper. Does NOT throw on 4xx/5xx — returns the status so
// callers (e.g. the auth refresh flow) can react to 401s.
export async function apiFetch<T = any>(
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.headers ?? {}),
  };
  if (opts.token) {
    headers.authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(API_URL + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

// Extracts a human-readable message from an error response body.
export function messageOf(data: any, fallback = 'Something went wrong'): string {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  const m = data.message;
  if (Array.isArray(m)) return m.join(', ');
  return typeof m === 'string' ? m : fallback;
}
