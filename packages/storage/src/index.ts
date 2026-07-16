export type { StorageAdapter } from './adapter.js';
export { buildKey } from './adapter.js';
export { S3StorageAdapter } from './s3.js';
export type { S3StorageConfig } from './s3.js';

import { S3StorageAdapter } from './s3.js';
import type { StorageAdapter } from './adapter.js';

export function createStorageFromEnv(): StorageAdapter {
  const required = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'S3_PUBLIC_URL',
  ] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env variable: ${key}`);
    }
  }

  return new S3StorageAdapter({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    bucket: process.env.S3_BUCKET!,
    publicUrl: process.env.S3_PUBLIC_URL!,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
}
