import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  validateUpload,
  mimeToAssetType,
  MAX_FILE_SIZE_BYTES,
} from '../server/schemas/file-upload';

describe('validateUpload', () => {
  it('accepts a valid image', () => {
    expect(() =>
      validateUpload({ originalName: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 * 100 }),
    ).not.toThrow();
  });

  it('accepts a valid PDF', () => {
    expect(() =>
      validateUpload({
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 200,
      }),
    ).not.toThrow();
  });

  it('rejects a file that is too large', () => {
    expect(() =>
      validateUpload({
        originalName: 'big.png',
        mimeType: 'image/png',
        sizeBytes: MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toThrow(TRPCError);
  });

  it('rejects video MIME types', () => {
    expect(() =>
      validateUpload({ originalName: 'video.mp4', mimeType: 'video/mp4', sizeBytes: 1024 }),
    ).toThrow(TRPCError);
  });

  it('rejects unknown MIME types', () => {
    expect(() =>
      validateUpload({
        originalName: 'file.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      }),
    ).toThrow(TRPCError);
  });
});

describe('mimeToAssetType', () => {
  it('maps image/* to images', () => {
    expect(mimeToAssetType('image/png')).toBe('images');
    expect(mimeToAssetType('image/jpeg')).toBe('images');
  });

  it('maps application/* to documents', () => {
    expect(mimeToAssetType('application/pdf')).toBe('documents');
    expect(mimeToAssetType('application/zip')).toBe('documents');
  });
});
