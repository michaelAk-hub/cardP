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
}
