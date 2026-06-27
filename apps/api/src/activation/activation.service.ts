import { Injectable, Logger } from '@nestjs/common';
import { AccountStatus, isActivationEligible } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

// Central enforcement of the activation rule (spec §6.5): a student is `active`
// ONLY when phone_verified AND id_verified. Call after either flag changes.
//
// Transitions only pending <-> active. A manually `deactive` account is left
// untouched (deactivation is admin-only, spec §6.6).
@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async reevaluate(studentId: string): Promise<AccountStatus> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        accountStatus: true,
        phoneVerified: true,
        idVerified: true,
      },
    });
    if (!student) {
      return AccountStatus.Pending;
    }

    // Never auto-flip a manually deactivated account.
    if (student.accountStatus === AccountStatus.Deactive) {
      return AccountStatus.Deactive;
    }

    const eligible = isActivationEligible({
      phoneVerified: student.phoneVerified,
      idVerified: student.idVerified,
    });

    if (eligible && student.accountStatus !== AccountStatus.Active) {
      await this.prisma.student.update({
        where: { id: student.id },
        data: { accountStatus: AccountStatus.Active },
      });
      // Issue wallet passes (best-effort — must not block activation).
      await this.wallet.issueForStudent(student.id).catch((err) =>
        this.logger.error(`wallet issue failed for ${student.id}: ${err.message}`),
      );
      // TODO(milestone: notifications): send "card ready" (SMS + email).
      this.logger.log(`Student ${student.id} activated`);
      return AccountStatus.Active;
    }

    if (!eligible && student.accountStatus === AccountStatus.Active) {
      await this.prisma.student.update({
        where: { id: student.id },
        data: { accountStatus: AccountStatus.Pending },
      });
      await this.wallet.revokeForStudent(student.id).catch(() => undefined);
      this.logger.warn(`Student ${student.id} lost eligibility -> pending`);
      return AccountStatus.Pending;
    }

    return student.accountStatus as AccountStatus;
  }
}
