import { createHash } from 'node:crypto';
import { HashingService } from './hashing.service';

describe('HashingService', () => {
  const svc = new HashingService();

  it('hashes and verifies a password (argon2 roundtrip)', async () => {
    const hash = await svc.hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await svc.verifyPassword(hash, 'correct horse battery')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await svc.hashPassword('s3cret-password');
    expect(await svc.verifyPassword(hash, 'not-it')).toBe(false);
  });

  it('returns false (not throw) on a malformed hash', async () => {
    expect(await svc.verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });

  it('hashToken is deterministic sha256', () => {
    const expected = createHash('sha256').update('abc123').digest('hex');
    expect(svc.hashToken('abc123')).toBe(expected);
    expect(svc.hashToken('abc123')).toBe(svc.hashToken('abc123'));
  });
});
