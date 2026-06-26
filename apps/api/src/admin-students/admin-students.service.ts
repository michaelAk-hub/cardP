import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  AccountStatus,
  Locale,
  ReviewDecision,
  WalletPassState,
} from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredObject } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ActivationService } from '../activation/activation.service';
import { MailService } from '../mail/mail.service';
import { HashingService } from '../auth/hashing.service';
import { TokenService } from '../auth/token.service';
import { StudentDeletionService } from '../gdpr/student-deletion.service';
import { DeactivateDto, IdReviewDto, ListStudentsQueryDto } from './dto';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// Columns the students table needs (spec §7) — never selects password_hash.
const STUDENT_SELECT = {
  id: true,
  name: true,
  surname: true,
  email: true,
  phone: true,
  universityId: true,
  accountStatus: true,
  phoneVerified: true,
  emailVerified: true,
  idVerified: true,
  marketingConsent: true,
  cardSerial: true,
  deactivationReason: true,
  createdAt: true,
} satisfies Prisma.StudentSelect;

@Injectable()
export class AdminStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly activation: ActivationService,
    private readonly mail: MailService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly deletion: StudentDeletionService,
    private readonly config: ConfigService,
  ) {}

  // Admin-initiated right-to-erasure: deletes PII + ID photos (spec §8).
  async erase(adminId: string, studentId: string): Promise<{ deleted: true }> {
    await this.deletion.delete(studentId);
    await this.audit.record(adminId, 'student.erase', { studentId });
    return { deleted: true };
  }

  async list(query: ListStudentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.StudentWhereInput = {};
    if (query.status) {
      where.accountStatus = query.status;
    }
    if (query.universityId) {
      where.universityId = query.universityId;
    }
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: {
          ...STUDENT_SELECT,
          idDocument: { select: { tamperStatus: true, uploadedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async detail(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        ...STUDENT_SELECT,
        university: { select: { id: true, nameEn: true, nameEl: true } },
        idDocument: {
          select: { tamperStatus: true, tamperScore: true, uploadedAt: true },
        },
        idReviews: {
          select: {
            id: true,
            decision: true,
            reason: true,
            description: true,
            reviewedAt: true,
            adminId: true,
          },
          orderBy: { reviewedAt: 'desc' },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  // Returns viewable links for the ID photos. S3 -> short-lived signed URLs;
  // local -> API stream paths. Every access is audit-logged (GDPR §8).
  async idDocumentLinks(adminId: string, studentId: string) {
    const doc = await this.prisma.idDocument.findUnique({ where: { studentId } });
    if (!doc) {
      throw new NotFoundException('No ID document uploaded');
    }
    const ttl = this.config.get<number>('SIGNED_URL_TTL_SECONDS', 120);
    const base = this.config.get<string>('API_PUBLIC_URL', '');

    const linkFor = async (side: 'front' | 'back', key: string) => {
      const signed = await this.storage.signedUrl(key, ttl);
      return signed ?? `${base}/api/admin/students/${studentId}/id-photo/${side}`;
    };

    await this.audit.record(adminId, 'id_photo.access', { studentId });
    return {
      uploadedAt: doc.uploadedAt,
      tamperStatus: doc.tamperStatus,
      tamperScore: doc.tamperScore,
      front: await linkFor('front', doc.frontKey),
      back: await linkFor('back', doc.backKey),
    };
  }

  // Streams a single decrypted photo (used by the local driver). Audit-logged.
  async streamIdPhoto(
    adminId: string,
    studentId: string,
    side: 'front' | 'back',
  ): Promise<StoredObject> {
    const doc = await this.prisma.idDocument.findUnique({ where: { studentId } });
    if (!doc) {
      throw new NotFoundException('No ID document uploaded');
    }
    const key = side === 'front' ? doc.frontKey : doc.backKey;
    await this.audit.record(adminId, 'id_photo.view', { studentId, side });
    return this.storage.read(key);
  }

  async reviewId(adminId: string, studentId: string, dto: IdReviewDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, email: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (dto.decision === ReviewDecision.Approved) {
      await this.prisma.$transaction([
        this.prisma.student.update({
          where: { id: studentId },
          data: { idVerified: true },
        }),
        this.prisma.idReview.create({
          data: { studentId, adminId, decision: ReviewDecision.Approved },
        }),
      ]);
      await this.audit.record(adminId, 'id_review.approve', { studentId });
    } else {
      // Reject: reason + description required (enforced by DTO), email the student.
      await this.prisma.$transaction([
        this.prisma.student.update({
          where: { id: studentId },
          data: { idVerified: false },
        }),
        this.prisma.idReview.create({
          data: {
            studentId,
            adminId,
            decision: ReviewDecision.Rejected,
            reason: dto.reason,
            description: dto.description,
          },
        }),
      ]);
      const locale = this.config.get<Locale>('DEFAULT_LOCALE', 'el');
      await this.mail.sendIdRejection(
        student.email,
        dto.reason!,
        dto.description!,
        locale,
      );
      await this.audit.record(adminId, 'id_review.reject', {
        studentId,
        reason: dto.reason,
      });
    }

    // id_verified changed -> re-run the activation rule.
    const accountStatus = await this.activation.reevaluate(studentId);
    return { decision: dto.decision, accountStatus };
  }

  async deactivate(adminId: string, studentId: string, dto: DeactivateDto) {
    await this.requireStudent(studentId);
    await this.prisma.student.update({
      where: { id: studentId },
      data: {
        accountStatus: AccountStatus.Deactive,
        deactivationReason: dto.reason,
      },
    });
    // Revoke issued wallet passes and log the student out everywhere.
    await this.prisma.walletPass.updateMany({
      where: { studentId, state: WalletPassState.Issued },
      data: { state: WalletPassState.Revoked },
    });
    await this.tokens.revokeAll('student', studentId);
    await this.audit.record(adminId, 'student.deactivate', {
      studentId,
      reason: dto.reason,
    });
    return { accountStatus: AccountStatus.Deactive };
  }

  // Clear manual deactivation and re-evaluate eligibility (active or pending).
  async reactivate(adminId: string, studentId: string) {
    const student = await this.requireStudent(studentId);
    if (student.accountStatus !== AccountStatus.Deactive) {
      throw new BadRequestException('Student is not deactivated');
    }
    await this.prisma.student.update({
      where: { id: studentId },
      data: { accountStatus: AccountStatus.Pending, deactivationReason: null },
    });
    const accountStatus = await this.activation.reevaluate(studentId);
    await this.audit.record(adminId, 'student.reactivate', { studentId });
    return { accountStatus };
  }

  async sendRecovery(adminId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, email: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        studentId,
        type: 'password_reset',
        token: this.hashing.hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    const base = this.config.get<string>('API_PUBLIC_URL', '');
    const locale = this.config.get<Locale>('DEFAULT_LOCALE', 'el');
    await this.mail.sendPasswordReset(
      student.email,
      `${base}/reset-password?token=${rawToken}`,
      locale,
    );
    await this.audit.record(adminId, 'student.send_recovery', { studentId });
    return { status: 'sent' };
  }

  async recreateCardSerial(adminId: string, studentId: string) {
    await this.requireStudent(studentId);
    // Retry on the rare unique collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const cardSerial = generateCardSerial();
      try {
        await this.prisma.student.update({
          where: { id: studentId },
          data: { cardSerial },
        });
        await this.audit.record(adminId, 'student.recreate_card_serial', {
          studentId,
        });
        // TODO(milestone: wallet): re-issue the wallet pass with the new serial.
        return { cardSerial };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException('Could not allocate a unique card serial');
  }

  private async requireStudent(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, accountStatus: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }
}

function generateCardSerial(): string {
  // Compact, human-readable-ish serial used as the displayed barcode value.
  return `BC-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}
