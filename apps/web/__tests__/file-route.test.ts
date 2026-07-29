import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Readable } from 'node:stream';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const findFirstMock = vi.fn();
const getObjectStreamMock = vi.fn();

vi.mock('@parta5/db', () => ({
  withTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
    fn({ fileAsset: { findFirst: findFirstMock } }),
}));

vi.mock('@parta5/storage', () => ({
  createStorageFromEnv: () => ({ getObjectStream: getObjectStreamMock }),
}));

import { auth } from '@/auth';
import { GET } from '../app/api/files/[fileAssetId]/route';

const authMock = auth as unknown as Mock;

function ctxFor(fileAssetId: string) {
  return { params: Promise.resolve({ fileAssetId }) };
}

function sessionFor(schoolId: string | null) {
  return {
    user: { id: 'user-1', role: 'TEACHER', schoolId },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function streamOf(contents: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(contents)]);
}

describe('GET /api/files/[fileAssetId]', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    getObjectStreamMock.mockReset();
    authMock.mockReset();
  });

  it('returns 401 when there is no session', async () => {
    authMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the session has no schoolId', async () => {
    authMock.mockResolvedValue(sessionFor(null) as never);

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the file belongs to another school', async () => {
    authMock.mockResolvedValue(sessionFor('school-1') as never);
    findFirstMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(404);
  });

  it('returns 404 when the file status is PENDING', async () => {
    authMock.mockResolvedValue(sessionFor('school-1') as never);
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/uuid-a.pdf',
      originalName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 123,
      status: 'PENDING',
    });

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(404);
    expect(getObjectStreamMock).not.toHaveBeenCalled();
  });

  it('streams the object body with the right headers on the happy path', async () => {
    authMock.mockResolvedValue(sessionFor('school-1') as never);
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/uuid-a.pdf',
      originalName: 'вопрос.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 5,
      status: 'UPLOADED',
    });
    getObjectStreamMock.mockResolvedValue(streamOf('hello'));

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(200);
    expect(getObjectStreamMock).toHaveBeenCalledWith('schools/school-1/files/uuid-a.pdf');
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-length')).toBe('5');
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toContain('inline');
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain(encodeURIComponent('вопрос.pdf'));

    const body = await res.text();
    expect(body).toBe('hello');
  });

  it('falls back to application/octet-stream when mimeType is missing', async () => {
    authMock.mockResolvedValue(sessionFor('school-1') as never);
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/uuid-a.bin',
      originalName: 'a.bin',
      mimeType: '',
      sizeBytes: 0,
      status: 'UPLOADED',
    });
    getObjectStreamMock.mockResolvedValue(streamOf('data'));

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-length')).toBeNull();
  });

  it('returns 502 when the storage adapter fails to produce a stream', async () => {
    authMock.mockResolvedValue(sessionFor('school-1') as never);
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/uuid-a.pdf',
      originalName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 5,
      status: 'UPLOADED',
    });
    getObjectStreamMock.mockRejectedValue(new Error('boom'));

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(502);
  });
});
