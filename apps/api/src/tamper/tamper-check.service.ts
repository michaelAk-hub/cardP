import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TamperScorer } from './tamper-scorer';

// The job body: score an uploaded ID document's photos and persist the advisory
// tamper flag for the admin review UI. Worst (highest) score across the two
// photos wins. NEVER changes id_verified / account_status — advisory only.
@Injectable()
export class TamperCheckService {
  private readonly logger = new Logger(TamperCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly scorer: TamperScorer,
  ) {}

  async run(idDocumentId: string): Promise<void> {
    const doc = await this.prisma.idDocument.findUnique({
      where: { id: idDocumentId },
      select: { id: true, frontKey: true, backKey: true },
    });
    if (!doc) {
      this.logger.warn(`tamper-check: id_document ${idDocumentId} not found`);
      return;
    }

    try {
      const [front, back] = await Promise.all([
        this.storage.read(doc.frontKey),
        this.storage.read(doc.backKey),
      ]);
      const [frontResult, backResult] = await Promise.all([
        this.scorer.score(front),
        this.scorer.score(back),
      ]);
      const worst =
        frontResult.score >= backResult.score ? frontResult : backResult;

      await this.prisma.idDocument.update({
        where: { id: doc.id },
        data: { tamperScore: worst.score, tamperStatus: worst.status },
      });
      this.logger.log(
        `tamper-check ${doc.id}: ${worst.status} (${worst.score})`,
      );
    } catch (err) {
      // A scoring failure must not block verification — leave the flag unset
      // so the reviewer simply sees "not scored".
      this.logger.error(
        `tamper-check ${doc.id} failed: ${(err as Error).message}`,
      );
    }
  }
}
