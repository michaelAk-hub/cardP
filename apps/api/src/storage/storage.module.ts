import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';
import { LocalStorage } from './local.storage';
import { S3Storage } from './s3.storage';

// Picks the storage backend from STORAGE_DRIVER. Global so any feature module
// (ID upload now, admin ID review later) can inject StorageService.
@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local');
        const logger = new Logger('StorageModule');

        if (driver === 's3') {
          const bucket = config.get<string>('S3_BUCKET');
          if (!bucket) {
            throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET');
          }
          const endpoint = config.get<string>('S3_ENDPOINT') || undefined;
          const client = new S3Client({
            region: config.get<string>('S3_REGION', 'auto'),
            endpoint,
            forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE', true),
            credentials: {
              accessKeyId: config.get<string>('S3_ACCESS_KEY_ID', ''),
              secretAccessKey: config.get<string>('S3_SECRET_ACCESS_KEY', ''),
            },
          });
          logger.log(`Using S3 storage (bucket=${bucket})`);
          return new S3Storage(client, {
            bucket,
            sse: config.get<string>('S3_SSE') || undefined,
          });
        }

        // Local dev driver — requires a stable 32-byte encryption key.
        const hexKey = config.get<string>('STORAGE_ENCRYPTION_KEY');
        if (!hexKey) {
          throw new Error(
            'STORAGE_DRIVER=local requires STORAGE_ENCRYPTION_KEY (64 hex chars)',
          );
        }
        const baseDir = config.get<string>('LOCAL_STORAGE_DIR', './var/id-photos');
        logger.warn(`Using LOCAL encrypted storage at ${baseDir} (dev only)`);
        return new LocalStorage(baseDir, Buffer.from(hexKey, 'hex'));
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
