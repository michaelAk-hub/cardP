import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

// Password hashing (argon2id, the spec's preferred choice) plus a fast
// deterministic hash for high-entropy opaque tokens (refresh / reset / OTP),
// which must be looked up by value and so cannot use a salted password hash.
@Injectable()
export class HashingService {
  hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verifyPassword(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }

  // SHA-256 of a high-entropy random token. Safe without a slow KDF because
  // the input is not a low-entropy human secret.
  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
