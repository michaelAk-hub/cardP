import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// Opt-out tokens for marketing messages. A token is `${studentId}.${hmac}` so
// the opt-out link needs no DB lookup to validate and can't be forged.
@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET', 'dev-unsub-secret');
  }

  private sign(studentId: string): string {
    return createHmac('sha256', this.secret())
      .update(studentId)
      .digest('base64url');
  }

  mintToken(studentId: string): string {
    return `${studentId}.${this.sign(studentId)}`;
  }

  optOutUrl(studentId: string): string {
    const base = this.config.get<string>('API_PUBLIC_URL', '');
    return `${base}/unsubscribe?token=${this.mintToken(studentId)}`;
  }

  // Idempotent: verifies the token and clears marketing_consent.
  async unsubscribe(token: string): Promise<void> {
    const [studentId, sig] = token.split('.');
    if (!studentId || !sig) {
      throw new BadRequestException('Invalid token');
    }
    const expected = this.sign(studentId);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid token');
    }
    await this.prisma.student.updateMany({
      where: { id: studentId },
      data: { marketingConsent: false },
    });
  }
}
