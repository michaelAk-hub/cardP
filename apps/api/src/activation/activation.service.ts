import { Injectable, Logger } from '@nestjs/common';
import { AccountStatus, isActivationEligible } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';

// Central enforcement of the activation rule (spec §6.5): a student is `active`
// ONLY when phone_verified AND id_verified. Call after either flag changes.
//
// Transitions only pending <-> active. A manually `deactive` account is left
// untouched (deactivation is admin-only, spec §6.6).
@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      // TODO(milestone: wallet): issue Apple/Google passes.
      // TODO(milestone: notifications): send "card ready" (SMS + email).
      this.logger.log(`Student ${student.id} activated`);
      return AccountStatus.Active;
    }

    if (!eligible && student.accountStatus === AccountStatus.Active) {
      await this.prisma.student.update({
        where: { id: student.id },
        data: { accountStatus: AccountStatus.Pending },
      });
      this.logger.warn(`Student ${student.id} lost eligibility -> pending`);
      return AccountStatus.Pending;
    }

    return student.accountStatus as AccountStatus;
  }
}
