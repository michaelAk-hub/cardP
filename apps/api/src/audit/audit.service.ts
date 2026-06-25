import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Central admin audit trail (spec §5 audit_log, GDPR §8). Every admin action —
// notably every ID-photo view (later milestone) — is recorded here.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    adminId: string,
    action: string,
    detail: Prisma.InputJsonValue = {},
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { adminId, action, detail },
    });
  }
}
