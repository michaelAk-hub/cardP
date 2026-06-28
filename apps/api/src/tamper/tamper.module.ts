import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TamperScorer } from './tamper-scorer';
import { HeuristicTamperScorer } from './heuristic-scorer';
import { TamperCheckService } from './tamper-check.service';
import {
  BullmqTamperQueue,
  InlineTamperQueue,
  TamperQueue,
} from './tamper-queue';

// Tamper-check: advisory scorer + the job that fills the review-UI flag, wired
// to a queue driver chosen by QUEUE_DRIVER. Global so ID upload can enqueue.
@Global()
@Module({
  providers: [
    {
      provide: TamperScorer,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new HeuristicTamperScorer({
          suspect: config.get<number>('TAMPER_SUSPECT_THRESHOLD', 0.34),
          flagged: config.get<number>('TAMPER_FLAGGED_THRESHOLD', 0.67),
        }),
    },
    TamperCheckService,
    {
      provide: TamperQueue,
      inject: [ConfigService, TamperCheckService],
      useFactory: (config: ConfigService, check: TamperCheckService): TamperQueue => {
        const logger = new Logger('TamperModule');
        if (config.get<string>('QUEUE_DRIVER', 'inline') === 'bullmq') {
          logger.log('Tamper-check using BullMQ driver');
          return new BullmqTamperQueue(
            check,
            {
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
            },
            config.get<boolean>('RUN_WORKERS', true),
          );
        }
        logger.warn('Tamper-check using inline driver (no Redis)');
        return new InlineTamperQueue(check);
      },
    },
  ],
  exports: [TamperQueue, TamperCheckService],
})
export class TamperModule {}
