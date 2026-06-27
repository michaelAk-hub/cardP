import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, Student, University } from '@prisma/client';
import { AccountStatus, WalletPassState, WalletPlatform } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleWalletService } from './google-wallet.service';
import { AppleWalletService, PkpassResult } from './apple-wallet.service';
import { PassData } from './wallet.types';

type StudentWithUni = Pick<
  Student,
  'id' | 'name' | 'surname' | 'accountStatus' | 'cardSerial'
> & { university: Pick<University, 'nameEn' | 'nameEl'> };

// Issues visual wallet passes on activation and revokes them on deactivation
// (spec §6.7). Pass artifacts (Apple .pkpass, Google save URL) are produced on
// demand by the per-platform services; only the pass records live in the DB.
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleWalletService,
    private readonly apple: AppleWalletService,
  ) {}

  // Called when a student becomes active. Ensures a card serial and `issued`
  // pass records for both platforms. Idempotent; no-op for non-active students.
  async issueForStudent(studentId: string): Promise<void> {
    const student = await this.load(studentId);
    if (!student || student.accountStatus !== AccountStatus.Active) {
      return;
    }
    await this.ensureSerial(student);
    await this.upsertPasses(studentId);
    this.logger.log(`Issued wallet passes for student ${studentId}`);
  }

  // Called on deactivation / loss of eligibility.
  async revokeForStudent(studentId: string): Promise<void> {
    await this.prisma.walletPass.updateMany({
      where: { studentId, state: WalletPassState.Issued },
      data: { state: WalletPassState.Revoked },
    });
  }

  async googleSaveUrl(studentId: string): Promise<{ saveUrl: string }> {
    const pass = await this.activePassData(studentId);
    return { saveUrl: this.google.buildSaveUrl(pass) };
  }

  async applePkpass(studentId: string): Promise<PkpassResult> {
    const pass = await this.activePassData(studentId);
    return this.apple.generate(pass);
  }

  async status(studentId: string) {
    const student = await this.load(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const passes = await this.prisma.walletPass.findMany({
      where: { studentId },
      select: { platform: true, state: true, issuedAt: true },
    });
    return {
      active: student.accountStatus === AccountStatus.Active,
      cardSerial: student.cardSerial,
      providers: { google: this.google.configured, apple: this.apple.configured },
      passes,
    };
  }

  // Gate: wallet artifacts are only available for active accounts (spec §6.7).
  private async activePassData(studentId: string): Promise<PassData> {
    const student = await this.load(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.accountStatus !== AccountStatus.Active) {
      throw new ForbiddenException('Wallet is available only for active accounts');
    }
    const cardSerial = await this.ensureSerial(student);
    await this.upsertPasses(studentId);
    return {
      studentId,
      fullName: `${student.name} ${student.surname}`,
      universityName: student.university.nameEn,
      cardSerial,
    };
  }

  private load(studentId: string): Promise<StudentWithUni | null> {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        surname: true,
        accountStatus: true,
        cardSerial: true,
        university: { select: { nameEn: true, nameEl: true } },
      },
    });
  }

  private async ensureSerial(student: StudentWithUni): Promise<string> {
    if (student.cardSerial) {
      return student.cardSerial;
    }
    for (let i = 0; i < 5; i++) {
      const cardSerial = `BC-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      try {
        await this.prisma.student.update({
          where: { id: student.id },
          data: { cardSerial },
        });
        return cardSerial;
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
    throw new Error('Could not allocate a unique card serial');
  }

  private async upsertPasses(studentId: string): Promise<void> {
    for (const platform of [WalletPlatform.Apple, WalletPlatform.Google]) {
      const serialNumber = `${platform}:${studentId}`;
      await this.prisma.walletPass.upsert({
        where: { serialNumber },
        create: { studentId, platform, serialNumber, state: WalletPassState.Issued },
        update: { state: WalletPassState.Issued, issuedAt: new Date() },
      });
    }
  }
}
