import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Security headers (HSTS, no-sniff, frameguard, etc.).
  app.use(helmet());

  // Global input validation — strips unknown props and rejects bad payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Consistent error responses + 500 logging.
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');
  app.enableCors();

  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Blue Card API listening on :${port}`, 'Bootstrap');
}

void bootstrap();
