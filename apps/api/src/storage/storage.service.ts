import { randomUUID } from 'node:crypto';

export interface StoredObject {
  buffer: Buffer;
  contentType: string;
}

// Abstraction over ID-photo storage. Implementations keep bytes encrypted at
// rest and are addressed only by opaque object keys (never public URLs).
// `signedUrl` returns a short-lived URL for direct viewing (S3), or null when
// the backend can't issue one (local dev) — callers then stream via `read`.
export abstract class StorageService {
  abstract put(key: string, buffer: Buffer, contentType: string): Promise<void>;
  abstract read(key: string): Promise<StoredObject>;
  abstract delete(key: string): Promise<void>;
  abstract signedUrl(key: string, ttlSeconds: number): Promise<string | null>;

  // Generate a collision-free object key under a logical prefix.
  newKey(prefix: string, ext = 'bin'): string {
    return `${prefix}/${randomUUID()}.${ext}`;
  }
}
