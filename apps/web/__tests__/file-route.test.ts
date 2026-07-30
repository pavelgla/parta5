import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Readable } from 'node:stream';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/school-context', () => ({ getCurrentSchool: vi.fn() }));

const findFirstMock = vi.fn();
const courseFindFirstMock = vi.fn();
const getObjectStreamMock = vi.fn();

vi.mock('@parta5/db', () => ({
  withTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
    fn({ fileAsset: { findFirst: findFirstMock }, course: { findFirst: courseFindFirstMock } }),
}));

vi.mock('@parta5/storage', () => ({
  createStorageFromEnv: () => ({ getObjectStream: getObjectStreamMock }),
}));

import { auth } from '@/auth';
import { getCurrentSchool } from '@/lib/school-context';
import { GET } from '../app/api/files/[fileAssetId]/route';

const authMock = auth as unknown as Mock;
const getCurrentSchoolMock = getCurrentSchool as unknown as Mock;

function ctxFor(fileAssetId: string) {
  return { params: Promise.resolve({ fileAssetId }) };
}

function sessionFor(schoolId: string | null) {
  return {
    user: { id: 'user-1', role: 'TEACHER', schoolId },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function schoolFor(overrides: Partial<{ id: string; logoFileAssetId: string | null }> = {}) {
  return {
    id: 'school-1',
    slug: 'school-1',
    name: 'Школа №1',
    displayName: null,
    legalName: null,
    brandColor: '#1D4ED8',
    logoFileAssetId: null,
    tagline: null,
    contactAddress: null,
    contactPhone: null,
    contactEmail: null,
    siteUrl: null,
    footerLinks: [],
    ...overrides,
  };
}

function streamOf(contents: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(contents)]);
}

describe('GET /api/files/[fileAssetId]', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    courseFindFirstMock.mockReset();
    getObjectStreamMock.mockReset();
    authMock.mockReset();
    getCurrentSchoolMock.mockReset();
    getCurrentSchoolMock.mockResolvedValue(null);
  });

  it('returns 404 when there is no session and no school resolves', async () => {
    authMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(404);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns 404 when there is no session and the file is neither a logo nor a published cover', async () => {
    authMock.mockResolvedValue(null);
    getCurrentSchoolMock.mockResolvedValue(schoolFor());
    courseFindFirstMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(404);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('serves a school logo without a session', async () => {
    authMock.mockResolvedValue(null);
    getCurrentSchoolMock.mockResolvedValue(schoolFor({ logoFileAssetId: 'abc' }));
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/logo.png',
      originalName: 'logo.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      status: 'UPLOADED',
    });
    getObjectStreamMock.mockResolvedValue(streamOf('hello'));

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(200);
    expect(courseFindFirstMock).not.toHaveBeenCalled();
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('serves a published course cover without a session', async () => {
    authMock.mockResolvedValue(null);
    getCurrentSchoolMock.mockResolvedValue(schoolFor());
    courseFindFirstMock.mockResolvedValue({ id: 'course-1' });
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/cover.png',
      originalName: 'cover.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      status: 'UPLOADED',
    });
    getObjectStreamMock.mockResolvedValue(streamOf('hello'));

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(200);
    expect(courseFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coverFileAssetId: 'abc',
          schoolId: 'school-1',
          status: 'PUBLISHED',
        }),
      }),
    );
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('returns 404 when the session has no schoolId and the file is not publicly readable', async () => {
    authMock.mockResolvedValue(sessionFor(null) as never);
    getCurrentSchoolMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(404);
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
