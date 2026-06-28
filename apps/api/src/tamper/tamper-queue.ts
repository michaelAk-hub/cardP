import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { TamperCheckService } from './tamper-check.service';

const QUEUE_NAME = 'tamper-check';

// Producer abstraction so callers (ID upload) don't care which driver runs the
// job. Keeps the API responsive — scoring never happens on the request path.
export abstract class TamperQueue {
  abstract enqueue(idDocumentId: string): Promise<void>;
}

// Dev / single-process driver: runs the job out-of-band (next tick) without
// Redis. Errors are swallowed by TamperCheckService's own try/catch.
@Injectable()
export class InlineTamperQueue extends TamperQueue {
  private readonly logger = new Logger(InlineTamperQueue.name);

  constructor(private readonly check: TamperCheckService) {
    super();
  }

  async enqueue(idDocumentId: string): Promise<void> {
    setImmediate(() => {
      void this.check.run(idDocumentId);
    });
    this.logger.debug(`inline tamper-check scheduled for ${idDocumentId}`);
  }
}

// Production driver: enqueues to Redis/BullMQ and runs a worker that consumes
// the queue (can be split into a dedicated worker process at deploy time).
export class BullmqTamperQueue
  extends TamperQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqTamperQueue.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly check: TamperCheckService,
    private readonly connection: { host: string; port: number },
    private readonly runWorker: boolean,
  ) {
    super();
  }

  onModuleInit(): void {
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    if (!this.runWorker) {
      this.logger.log('BullMQ tamper-check producer ready (worker disabled)');
      return;
    }
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => this.check.run(job.data.idDocumentId as string),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`job ${job?.id} failed: ${err.message}`),
    );
    this.logger.log('BullMQ tamper-check queue + worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(idDocumentId: string): Promise<void> {
    await this.queue.add(
      'score',
      { idDocumentId },
      { removeOnComplete: true, removeOnFail: 50 },
    );
  }
}
