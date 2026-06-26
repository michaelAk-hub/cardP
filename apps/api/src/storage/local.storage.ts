import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { StorageService, StoredObject } from './storage.service';

const IV_LEN = 12;
const TAG_LEN = 16;

// Dev-only storage: AES-256-GCM encrypted blobs on local disk. The on-disk
// layout is: iv(12) || authTag(16) || ciphertext, where the plaintext is
// `${contentType}\n${bytes}` so reads recover the content type too.
@Injectable()
export class LocalStorage extends StorageService {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer, // 32 bytes
  ) {
    super();
  }

  private resolve(key: string): string {
    // Guard against path traversal in object keys.
    const safe = normalize(key).replace(/^(\.\.[/\\])+/, '');
    return join(this.baseDir, safe);
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = Buffer.concat([
      Buffer.from(`${contentType}\n`, 'utf8'),
      buffer,
    ]);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.concat([iv, tag, ciphertext]));
  }

  async read(key: string): Promise<StoredObject> {
    const raw = await readFile(this.resolve(key));
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = raw.subarray(IV_LEN + TAG_LEN);

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const sep = plaintext.indexOf(0x0a); // first newline
    const contentType = plaintext.subarray(0, sep).toString('utf8');
    const buffer = plaintext.subarray(sep + 1);
    return { buffer, contentType };
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  // Local dev can't mint a real signed URL — caller streams via read().
  async signedUrl(): Promise<string | null> {
    return null;
  }
}
