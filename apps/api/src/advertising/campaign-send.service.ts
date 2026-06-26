import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignChannel, DeliveryStatus, Locale } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SmsSender } from '../sms/sms-sender';
import { UnsubscribeService } from '../notifications/unsubscribe.service';

// Executes a campaign (spec §6.9): drops non-consenting students as
// skipped_optout, appends an opt-out affordance, sends per channel, and records
// per-recipient delivery_status. Transactional messages do NOT go through here.
@Injectable()
export class CampaignSendService {
  private readonly logger = new Logger(CampaignSendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsSender,
    private readonly unsubscribe: UnsubscribeService,
    private readonly config: ConfigService,
  ) {}

  async run(campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      this.logger.warn(`campaign ${campaignId} not found`);
      return;
    }

    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId, deliveryStatus: DeliveryStatus.Queued },
      include: {
        student: {
          select: { id: true, email: true, phone: true, marketingConsent: true },
        },
      },
    });

    const locale = this.config.get<Locale>('DEFAULT_LOCALE', 'el');
    const counts = { sent: 0, failed: 0, skipped_optout: 0 };

    for (const r of recipients) {
      // Consent filter: non-consenters are skipped (recorded), never sent.
      if (!r.student.marketingConsent) {
        await this.setStatus(r.id, DeliveryStatus.SkippedOptout);
        counts.skipped_optout++;
        continue;
      }
      try {
        if (campaign.channel === CampaignChannel.Email) {
          await this.mail.sendCampaignEmail(
            r.student.email,
            campaign.subject ?? '',
            campaign.body,
            this.unsubscribe.optOutUrl(r.student.id),
            locale,
          );
        } else {
          // SMS opt-out is the STOP keyword (handled by the carrier/Twilio).
          await this.sms.send(r.student.phone, `${campaign.body}\nReply STOP to opt out.`);
        }
        await this.setStatus(r.id, DeliveryStatus.Sent);
        counts.sent++;
      } catch (err) {
        await this.setStatus(r.id, DeliveryStatus.Failed);
        counts.failed++;
        this.logger.error(`recipient ${r.id} failed: ${(err as Error).message}`);
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { sentAt: new Date() },
    });
    this.logger.log(
      `campaign ${campaignId} (${campaign.channel}): sent=${counts.sent} ` +
        `failed=${counts.failed} skipped_optout=${counts.skipped_optout}`,
    );
  }

  private setStatus(recipientId: string, status: DeliveryStatus): Promise<unknown> {
    return this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { deliveryStatus: status },
    });
  }
}
