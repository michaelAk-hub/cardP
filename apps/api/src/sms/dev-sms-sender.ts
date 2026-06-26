import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms-sender';

// Dev fallback when Twilio SMS isn't configured — logs instead of sending.
@Injectable()
export class DevSmsSender extends SmsSender {
  private readonly logger = new Logger(DevSmsSender.name);

  async send(to: string, body: string): Promise<void> {
    this.logger.log(`[dev-sms] to=${to} body="${body}"`);
  }
}
