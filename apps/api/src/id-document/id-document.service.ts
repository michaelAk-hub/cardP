import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per photo

export interface UploadResult {
  uploaded: true;
  uploadedAt: Date;
}

@Injectable()
export class IdDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    studentId: string,
    front?: Express.Multer.File,
    back?: Express.Multer.File,
  ): Promise<UploadResult> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, idVerified: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.idVerified) {
      throw new BadRequestException('ID is already verified');
    }

    const frontExt = this.validate(front, 'front');
    const backExt = this.validate(back, 'back');

    // Replace any previous upload (e.g. after a rejection): write new objects,
    // then best-effort delete the old ones.
    const existing = await this.prisma.idDocument.findUnique({
      where: { studentId },
    });

    const prefix = `id-photos/${studentId}`;
    const frontKey = this.storage.newKey(prefix, frontExt);
    const backKey = this.storage.newKey(prefix, backExt);

    await this.storage.put(frontKey, front!.buffer, front!.mimetype);
    await this.storage.put(backKey, back!.buffer, back!.mimetype);

    const doc = await this.prisma.idDocument.upsert({
      where: { studentId },
      create: { studentId, frontKey, backKey },
      // Reset tamper fields so the (later) tamper-check re-runs on the new images.
      update: {
        frontKey,
        backKey,
        tamperScore: null,
        tamperStatus: null,
        uploadedAt: new Date(),
      },
    });

    if (existing) {
      await Promise.allSettled([
        this.storage.delete(existing.frontKey),
        this.storage.delete(existing.backKey),
      ]);
    }

    // TODO(milestone: tamper-check): enqueue scoring job for doc.id.
    return { uploaded: true, uploadedAt: doc.uploadedAt };
  }

  private validate(file: Express.Multer.File | undefined, field: string): string {
    if (!file) {
      throw new BadRequestException(`Missing ${field} image`);
    }
    const ext = ALLOWED.get(file.mimetype);
    if (!ext) {
      throw new BadRequestException(`${field} must be a JPEG or PNG image`);
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`${field} image exceeds 10MB`);
    }
    return ext;
  }
}
