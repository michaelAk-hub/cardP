import { Injectable, Logger } from '@nestjs/common';
import type { Twilio } from 'twilio';
import { SmsVerifier } from './sms-verifier';

// Twilio Verify-backed phone verification. Twilio sends and validates the OTP;
// we never see or store the code.
@Injectable()
export class TwilioVerifyService extends SmsVerifier {
  private readonly logger = new Logger(TwilioVerifyService.name);

  constructor(
    private readonly client: Twilio,
    private readonly serviceSid: string,
  ) {
    super();
  }

  async startVerification(phone: string): Promise<void> {
    await this.client.verify.v2
      .services(this.serviceSid)
      .verifications.create({ to: phone, channel: 'sms' });
    this.logger.log(`Verification sent to ${maskPhone(phone)}`);
  }

  async checkVerification(phone: string, code: string): Promise<boolean> {
    const result = await this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({ to: phone, code });
    return result.status === 'approved';
  }
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? '****' : `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}
