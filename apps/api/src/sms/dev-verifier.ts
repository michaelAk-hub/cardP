import { Injectable, Logger } from '@nestjs/common';
import { SmsVerifier } from './sms-verifier';

// Dev/test fallback when no Twilio creds are configured. Accepts a fixed code
// (OTP_DEV_CODE) so flows are exercisable without sending real SMS.
@Injectable()
export class DevVerifier extends SmsVerifier {
  private readonly logger = new Logger(DevVerifier.name);

  constructor(private readonly devCode: string) {
    super();
  }

  async startVerification(phone: string): Promise<void> {
    this.logger.warn(
      `[dev] pretend-sent OTP to ${phone}; accept code "${this.devCode}"`,
    );
  }

  async checkVerification(_phone: string, code: string): Promise<boolean> {
    return code === this.devCode;
  }
}
