import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@blue-card/shared';

// Transactional email (OTP, verify, password reset, ID rejection, card-ready).
// These are EXEMPT from the marketing-consent filter (spec §6.9).
//
// Foundation/auth milestone: this logs instead of sending. The real provider
// (Resend/Postmark/SES) and BullMQ queueing are wired in a later milestone —
// keep all call sites going through this service so that swap is localized.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(
    to: string,
    resetLink: string,
    _locale: Locale,
  ): Promise<void> {
    // TODO(milestone: email): send via provider + queue; localize el/en body.
    this.logger.log(`[password_reset] to=${to} link=${resetLink}`);
    return Promise.resolve();
  }

  async sendEmailVerification(
    to: string,
    verifyLink: string,
    _locale: Locale,
  ): Promise<void> {
    // TODO(milestone: email): send via provider + queue; localize el/en body.
    this.logger.log(`[email_verify] to=${to} link=${verifyLink}`);
    return Promise.resolve();
  }

  // Marketing campaign email (advertising page). Subject to the consent
  // filter; MUST carry an opt-out link.
  async sendCampaignEmail(
    to: string,
    subject: string,
    body: string,
    optOutUrl: string,
    _locale: Locale,
  ): Promise<void> {
    // TODO(milestone: email): send via provider + queue; localize el/en body.
    this.logger.log(`[campaign] to=${to} subject="${subject}" optOut=${optOutUrl}`);
    return Promise.resolve();
  }

  // Promotional broadcast (new store / new offer, marketing campaigns).
  // Subject to the marketing-consent filter; MUST carry an opt-out link.
  async sendBroadcast(
    to: string,
    subject: string,
    body: string,
    optOutUrl: string,
    _locale: Locale,
  ): Promise<void> {
    // TODO(milestone: email): send via provider + queue; localize el/en body.
    this.logger.log(`[broadcast] to=${to} subject="${subject}" optOut=${optOutUrl}`);
    return Promise.resolve();
  }

  // Automatic email on ID rejection (spec §6.4). Transactional — exempt from
  // the marketing-consent filter.
  async sendIdRejection(
    to: string,
    reason: string,
    description: string,
    _locale: Locale,
  ): Promise<void> {
    // TODO(milestone: email): send via provider + queue; localize el/en body.
    this.logger.log(`[id_rejected] to=${to} reason="${reason}" desc="${description}"`);
    return Promise.resolve();
  }
}
