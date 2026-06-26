import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Locale } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from '../auth/hashing.service';
import { MailService } from '../mail/mail.service';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Email verification is collected but is NOT an activation gate (spec §6.3).
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async sendVerification(studentId: string): Promise<{ status: 'sent' }> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        studentId: student.id,
        type: 'email_verify',
        token: this.hashing.hashToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });

    const base = this.config.get<string>('API_PUBLIC_URL', '');
    const link = `${base}/verify-email?token=${rawToken}`;
    const locale = this.config.get<Locale>('DEFAULT_LOCALE', 'el');
    await this.mail.sendEmailVerification(student.email, link, locale);
    return { status: 'sent' };
  }

  async verify(token: string): Promise<{ emailVerified: true }> {
    const tokenHash = this.hashing.hashToken(token);
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        token: tokenHash,
        type: 'email_verify',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id: record.studentId },
        data: { emailVerified: true },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);
    // Note: email is NOT part of the activation rule — no reevaluate here.
    return { emailVerified: true };
  }
}
