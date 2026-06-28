import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { BroadcastKind, BroadcastService } from './broadcast.service';

const QUEUE_NAME = 'broadcast';

// Producer abstraction for broadcast-on-create. Keeps the admin CRUD request
// fast — the fan-out runs off the request path.
export abstract class BroadcastQueue {
  abstract enqueue(kind: BroadcastKind, entityId: string): Promise<void>;
}

@Injectable()
export class InlineBroadcastQueue extends BroadcastQueue {
  constructor(private readonly broadcast: BroadcastService) {
    super();
  }

  async enqueue(kind: BroadcastKind, entityId: string): Promise<void> {
    setImmediate(() => {
      void this.broadcast.run(kind, entityId).catch(() => undefined);
    });
  }
}

export class BullmqBroadcastQueue
  extends BroadcastQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqBroadcastQueue.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly broadcast: BroadcastService,
    private readonly connection: { host: string; port: number },
    private readonly runWorker: boolean,
  ) {
    super();
  }

  onModuleInit(): void {
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    if (!this.runWorker) {
      this.logger.log('BullMQ broadcast producer ready (worker disabled)');
      return;
    }
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) =>
        this.broadcast.run(
          job.data.kind as BroadcastKind,
          job.data.entityId as string,
        ),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`job ${job?.id} failed: ${err.message}`),
    );
    this.logger.log('BullMQ broadcast queue + worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(kind: BroadcastKind, entityId: string): Promise<void> {
    await this.queue.add(
      kind,
      { kind, entityId },
      { removeOnComplete: true, removeOnFail: 50 },
    );
  }
}
