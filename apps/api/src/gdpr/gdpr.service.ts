import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Right-to-access (spec §8): a machine-readable export of everything we hold on
// a student. Excludes secrets (password hash, token hashes, storage keys).
@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  async exportStudent(studentId: string): Promise<Record<string, unknown>> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        accountStatus: true,
        phoneVerified: true,
        emailVerified: true,
        idVerified: true,
        marketingConsent: true,
        cardSerial: true,
        deactivationReason: true,
        createdAt: true,
        updatedAt: true,
        university: { select: { nameEn: true, nameEl: true } },
        idDocument: { select: { tamperStatus: true, uploadedAt: true } },
        idReviews: {
          select: { decision: true, reason: true, description: true, reviewedAt: true },
          orderBy: { reviewedAt: 'desc' },
        },
        walletPasses: {
          select: { platform: true, serialNumber: true, state: true, issuedAt: true },
        },
        verificationTokens: {
          select: { type: true, used: true, expiresAt: true, createdAt: true },
        },
        campaignRecipients: {
          select: { campaignId: true, deliveryStatus: true, createdAt: true },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return { exportedAt: new Date().toISOString(), student };
  }
}
