import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Dedicated worker process: boots the Nest application context (no HTTP server)
// so the BullMQ queue consumers and scheduled jobs run here. Pair with
// QUEUE_DRIVER=bullmq and RUN_WORKERS=true (the API runs RUN_WORKERS=false).
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log('Blue Card worker started', 'Worker');

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
