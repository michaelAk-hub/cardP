import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnsubscribeService } from './unsubscribe.service';
import { UnsubscribeController } from './unsubscribe.controller';
import { BroadcastService } from './broadcast.service';
import {
  BroadcastQueue,
  BullmqBroadcastQueue,
  InlineBroadcastQueue,
} from './broadcast-queue';

// Marketing/notification fan-out + opt-out. Global so the catalog module can
// enqueue broadcasts on store/offer creation.
@Global()
@Module({
  controllers: [UnsubscribeController],
  providers: [
    UnsubscribeService,
    BroadcastService,
    {
      provide: BroadcastQueue,
      inject: [ConfigService, BroadcastService],
      useFactory: (config: ConfigService, broadcast: BroadcastService): BroadcastQueue => {
        const logger = new Logger('NotificationsModule');
        if (config.get<string>('QUEUE_DRIVER', 'inline') === 'bullmq') {
          logger.log('Broadcast using BullMQ driver');
          return new BullmqBroadcastQueue(
            broadcast,
            {
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
            },
            config.get<boolean>('RUN_WORKERS', true),
          );
        }
        logger.warn('Broadcast using inline driver (no Redis)');
        return new InlineBroadcastQueue(broadcast);
      },
    },
  ],
  exports: [BroadcastQueue, UnsubscribeService, BroadcastService],
})
export class NotificationsModule {}
