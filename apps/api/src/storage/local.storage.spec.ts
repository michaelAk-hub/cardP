import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from './local.storage';

describe('LocalStorage (encrypted at rest)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bc-store-'));
  const storage = new LocalStorage(dir, randomBytes(32));

  it('round-trips bytes and content type through encryption', async () => {
    const data = Buffer.from('fake-jpeg-bytes-\x00\x01\x02', 'binary');
    const key = storage.newKey('id-photos/student-1', 'jpg');
    await storage.put(key, data, 'image/jpeg');

    const out = await storage.read(key);
    expect(out.contentType).toBe('image/jpeg');
    expect(out.buffer.equals(data)).toBe(true);
  });

  it('writes ciphertext to disk, not the plaintext', async () => {
    const secret = Buffer.from('TOP-SECRET-PLAINTEXT-MARKER');
    const key = storage.newKey('id-photos/student-2', 'png');
    await storage.put(key, secret, 'image/png');

    const onDisk = readFileSync(join(dir, key));
    expect(onDisk.includes('TOP-SECRET-PLAINTEXT-MARKER')).toBe(false);
  });

  it('local backend issues no signed URL (callers stream via read)', async () => {
    expect(await storage.signedUrl()).toBeNull();
  });

  it('delete removes the object', async () => {
    const key = storage.newKey('id-photos/student-3', 'jpg');
    await storage.put(key, Buffer.from('x'), 'image/jpeg');
    await storage.delete(key);
    await expect(storage.read(key)).rejects.toThrow();
  });
});
