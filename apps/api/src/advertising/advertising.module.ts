import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { CampaignService } from './campaign.service';
import { CampaignSendService } from './campaign-send.service';
import {
  BullmqCampaignQueue,
  CampaignQueue,
  InlineCampaignQueue,
} from './campaign-queue';

@Module({
  controllers: [AdminCampaignsController],
  providers: [
    CampaignService,
    CampaignSendService,
    {
      provide: CampaignQueue,
      inject: [ConfigService, CampaignSendService],
      useFactory: (config: ConfigService, send: CampaignSendService): CampaignQueue => {
        const logger = new Logger('AdvertisingModule');
        if (config.get<string>('QUEUE_DRIVER', 'inline') === 'bullmq') {
          logger.log('Campaign send using BullMQ driver');
          return new BullmqCampaignQueue(send, {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          });
        }
        logger.warn('Campaign send using inline driver (no Redis)');
        return new InlineCampaignQueue(send);
      },
    },
  ],
})
export class AdvertisingModule {}
