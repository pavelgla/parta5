import { describe, it, expect, vi } from 'vitest';

const getSignedUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { S3StorageAdapter } from '../src/s3';

describe('S3StorageAdapter.presignDownload', () => {
  it('returns a presigned GET URL for the given key and expiry', async () => {
    getSignedUrlMock.mockResolvedValue(
      'https://minio.local/parta5-uploads/schools/s1/files/uuid-a.pdf?X-Amz-Signature=abc',
    );

    const adapter = new S3StorageAdapter({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKeyId: 'admin',
      secretAccessKey: 'secret123',
      bucket: 'parta5-uploads',
      publicUrl: 'http://localhost:9000/parta5-uploads',
    });

    const url = await adapter.presignDownload('schools/s1/files/uuid-a.pdf', 300);

    expect(url).toBe(
      'https://minio.local/parta5-uploads/schools/s1/files/uuid-a.pdf?X-Amz-Signature=abc',
    );
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'parta5-uploads',
          Key: 'schools/s1/files/uuid-a.pdf',
        }),
      }),
      { expiresIn: 300 },
    );
  });
});
