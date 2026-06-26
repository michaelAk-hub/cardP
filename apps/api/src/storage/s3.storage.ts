import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService, StoredObject } from './storage.service';

export interface S3StorageOptions {
  bucket: string;
  sse?: string; // e.g. 'AES256' — server-side encryption at rest
}

// S3-compatible storage (R2 / B2 / S3 / MinIO). Encryption at rest is the
// bucket's server-side encryption (SSE); viewing is via short-lived presigned
// GET URLs. Only object keys are ever persisted — never public URLs.
@Injectable()
export class S3Storage extends StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly opts: S3StorageOptions,
  ) {
    super();
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.opts.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: this.opts.sse
          ? (this.opts.sse as 'AES256')
          : undefined,
      }),
    );
  }

  async read(key: string): Promise<StoredObject> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }),
    );
  }

  signedUrl(key: string, ttlSeconds: number): Promise<string | null> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }
}
