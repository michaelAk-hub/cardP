import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Global input validation — strips unknown props and rejects bad payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors();

  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Blue Card API listening on :${port}`, 'Bootstrap');
}

void bootstrap();
