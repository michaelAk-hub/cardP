import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, Locale } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UnsubscribeService } from './unsubscribe.service';

export type BroadcastKind = 'store' | 'offer';

// Fan-out for broadcast-on-create (spec §6.8). Promotional: recipients are
// limited to ACTIVE students who have marketing_consent, and every message
// carries an opt-out link. Non-consenting actives are skipped.
@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly unsubscribe: UnsubscribeService,
    private readonly config: ConfigService,
  ) {}

  async run(kind: BroadcastKind, entityId: string): Promise<void> {
    const message = await this.buildMessage(kind, entityId);
    if (!message) {
      this.logger.warn(`broadcast: ${kind} ${entityId} not found/visible`);
      return;
    }

    const locale = this.config.get<Locale>('DEFAULT_LOCALE', 'el');
    const recipients = await this.prisma.student.findMany({
      where: { accountStatus: AccountStatus.Active, marketingConsent: true },
      select: { id: true, email: true },
    });
    const activeTotal = await this.prisma.student.count({
      where: { accountStatus: AccountStatus.Active },
    });

    for (const r of recipients) {
      await this.mail.sendBroadcast(
        r.email,
        message.subject,
        message.body,
        this.unsubscribe.optOutUrl(r.id),
        locale,
      );
    }

    const skipped = activeTotal - recipients.length;
    this.logger.log(
      `broadcast ${kind} ${entityId}: sent=${recipients.length} skipped_optout=${skipped}`,
    );
  }

  private async buildMessage(
    kind: BroadcastKind,
    entityId: string,
  ): Promise<{ subject: string; body: string } | null> {
    if (kind === 'store') {
      const store = await this.prisma.store.findUnique({ where: { id: entityId } });
      if (!store) return null;
      return {
        subject: `New store on Blue Card: ${store.nameEn}`,
        body: store.descriptionEn,
      };
    }
    const offer = await this.prisma.offer.findUnique({
      where: { id: entityId },
      include: { store: true },
    });
    if (!offer) return null;
    return {
      subject: `New offer at ${offer.store.nameEn}: ${offer.titleEn}`,
      body: offer.descriptionEn,
    };
  }
}
