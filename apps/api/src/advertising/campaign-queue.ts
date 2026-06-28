import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { CampaignSendService } from './campaign-send.service';

const QUEUE_NAME = 'campaign-send';

export abstract class CampaignQueue {
  abstract enqueue(campaignId: string): Promise<void>;
}

@Injectable()
export class InlineCampaignQueue extends CampaignQueue {
  constructor(private readonly send: CampaignSendService) {
    super();
  }

  async enqueue(campaignId: string): Promise<void> {
    setImmediate(() => {
      void this.send.run(campaignId).catch(() => undefined);
    });
  }
}

export class BullmqCampaignQueue
  extends CampaignQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqCampaignQueue.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly send: CampaignSendService,
    private readonly connection: { host: string; port: number },
    private readonly runWorker: boolean,
  ) {
    super();
  }

  onModuleInit(): void {
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    if (!this.runWorker) {
      this.logger.log('BullMQ campaign producer ready (worker disabled)');
      return;
    }
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => this.send.run(job.data.campaignId as string),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`job ${job?.id} failed: ${err.message}`),
    );
    this.logger.log('BullMQ campaign queue + worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(campaignId: string): Promise<void> {
    await this.queue.add(
      'send',
      { campaignId },
      { removeOnComplete: true, removeOnFail: 50 },
    );
  }
}
