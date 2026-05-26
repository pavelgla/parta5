import { describe, it, expect, afterEach } from 'vitest';
import { createStorageFromEnv } from '../src/index';
import { S3StorageAdapter } from '../src/s3';

const REQUIRED_VARS = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'parta5admin',
  S3_SECRET_ACCESS_KEY: 'secret123',
  S3_BUCKET: 'parta5-uploads',
  S3_PUBLIC_URL: 'http://localhost:9000/parta5-uploads',
};

afterEach(() => {
  for (const key of Object.keys(REQUIRED_VARS)) {
    delete process.env[key];
  }
  delete process.env.S3_FORCE_PATH_STYLE;
});

describe('createStorageFromEnv', () => {
  it('returns S3StorageAdapter when all env vars are set', () => {
    Object.assign(process.env, REQUIRED_VARS);
    const adapter = createStorageFromEnv();
    expect(adapter).toBeInstanceOf(S3StorageAdapter);
  });

  it('throws when a required env var is missing', () => {
    const partial = { ...REQUIRED_VARS };
    delete (partial as Partial<typeof partial>).S3_BUCKET;
    Object.assign(process.env, partial);
    expect(() => createStorageFromEnv()).toThrowError('S3_BUCKET');
  });

  it('publicUrl returns correct URL for a key', () => {
    Object.assign(process.env, REQUIRED_VARS);
    const adapter = createStorageFromEnv();
    expect(adapter.publicUrl('schools/school1/images/uuid-photo.jpg')).toBe(
      'http://localhost:9000/parta5-uploads/schools/school1/images/uuid-photo.jpg',
    );
  });
});
