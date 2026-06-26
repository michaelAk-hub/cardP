import { Injectable } from '@nestjs/common';
import type { Twilio } from 'twilio';
import { SmsSender } from './sms-sender';

@Injectable()
export class TwilioSmsSender extends SmsSender {
  constructor(
    private readonly client: Twilio,
    private readonly from: string,
  ) {
    super();
  }

  async send(to: string, body: string): Promise<void> {
    await this.client.messages.create({ to, from: this.from, body });
  }
}
