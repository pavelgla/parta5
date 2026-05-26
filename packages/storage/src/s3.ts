import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { StorageAdapter } from './adapter';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  forcePathStyle?: boolean;
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private basePublicUrl: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.basePublicUrl = config.publicUrl.replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? false,
    });
  }

  async presignUpload(
    key: string,
    contentType: string,
    _sizeBytes: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresIn = 3600; // 1 hour
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  publicUrl(key: string): string {
    return `${this.basePublicUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async headObject(key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`Object not found: ${key}`);
    return res.Body as unknown as NodeJS.ReadableStream;
  }

  async putObjectFromPath(key: string, localPath: string, contentType: string): Promise<void> {
    const { size } = await stat(localPath);
    const stream = createReadStream(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream as unknown as Uint8Array,
        ContentType: contentType,
        ContentLength: size,
      }),
    );
  }
}
