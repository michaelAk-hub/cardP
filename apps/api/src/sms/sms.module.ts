import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { SmsVerifier } from './sms-verifier';
import { TwilioVerifyService } from './twilio-verify.service';
import { DevVerifier } from './dev-verifier';

// Uses Twilio Verify when all three creds are present; otherwise a dev verifier.
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

        logger.warn('Twilio not configured — using DEV phone verifier');
        return new DevVerifier(config.get<string>('OTP_DEV_CODE', '000000'));
      },
    },
  ],
  exports: [SmsVerifier],
})
export class SmsModule {}
