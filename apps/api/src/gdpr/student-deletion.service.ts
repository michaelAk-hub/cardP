import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

// Right-to-erasure (spec §8): deleting a student removes their PII AND their
// ID-photo objects. Most related rows cascade via FK; refresh tokens are
// polymorphic (no FK) and are cleaned up explicitly.
@Injectable()
export class StudentDeletionService {
  private readonly logger = new Logger(StudentDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async delete(studentId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, idDocument: { select: { frontKey: true, backKey: true } } },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Purge the sensitive ID photos from object storage first (best-effort).
    if (student.idDocument) {
      await Promise.allSettled([
        this.storage.delete(student.idDocument.frontKey),
        this.storage.delete(student.idDocument.backKey),
      ]);
    }

    // Refresh tokens reference the student polymorphically — no cascade.
    await this.prisma.refreshToken.deleteMany({
      where: { principalType: 'student', principalId: studentId },
    });

    // Cascades: id_documents, id_reviews, wallet_passes, verification_tokens,
    // campaign_recipients (all FK onDelete: Cascade).
    await this.prisma.student.delete({ where: { id: studentId } });
    this.logger.log(`Erased student ${studentId} (PII + ID photos)`);
  }
}
