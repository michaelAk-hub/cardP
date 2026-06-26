import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { SmsVerifier } from './sms-verifier';
import { TwilioVerifyService } from './twilio-verify.service';
import { DevVerifier } from './dev-verifier';
import { SmsSender } from './sms-sender';
import { TwilioSmsSender } from './twilio-sms-sender';
import { DevSmsSender } from './dev-sms-sender';

// Phone OTP (SmsVerifier, Twilio Verify) and raw marketing SMS (SmsSender,
// Twilio Messages). Each falls back to a dev impl when creds are absent.
@Global()
@Module({
  providers: [
    {
      provide: SmsVerifier,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsVerifier => {
        const sid = config.get<string>('TWILIO_ACCOUNT_SID');
        const token = config.get<string>('TWILIO_AUTH_TOKEN');
        const serviceSid = config.get<string>('TWILIO_VERIFY_SERVICE_SID');
        const logger = new Logger('SmsModule');
        if (sid && token && serviceSid) {
          logger.log('Using Twilio Verify for phone OTP');
          return new TwilioVerifyService(twilio(sid, token), serviceSid);
        }
        logger.warn('Twilio Verify not configured — using DEV phone verifier');
        return new DevVerifier(config.get<string>('OTP_DEV_CODE', '000000'));
      },
    },
    {
      provide: SmsSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsSender => {
        const sid = config.get<string>('TWILIO_ACCOUNT_SID');
        const token = config.get<string>('TWILIO_AUTH_TOKEN');
        const from = config.get<string>('TWILIO_FROM_NUMBER');
        const logger = new Logger('SmsModule');
        if (sid && token && from) {
          logger.log('Using Twilio Messages for marketing SMS');
          return new TwilioSmsSender(twilio(sid, token), from);
        }
        logger.warn('Twilio SMS not configured — using DEV SMS sender');
        return new DevSmsSender();
      },
    },
  ],
  exports: [SmsVerifier, SmsSender],
})
export class SmsModule {}
