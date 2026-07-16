import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const findFirstMock = vi.fn();
const presignDownloadMock = vi.fn();

vi.mock('@parta5/db', () => ({
  withTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
    fn({ fileAsset: { findFirst: findFirstMock } }),
}));

vi.mock('@parta5/storage', () => ({
  createStorageFromEnv: () => ({ presignDownload: presignDownloadMock }),
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

describe('GET /api/files/[fileAssetId]', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    presignDownloadMock.mockReset();
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
      status: 'PENDING',
    });

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(404);
    expect(presignDownloadMock).not.toHaveBeenCalled();
  });

  it('redirects to a presigned URL on the happy path', async () => {
    authMock.mockResolvedValue(sessionFor('school-1') as never);
    findFirstMock.mockResolvedValue({
      id: 'abc',
      schoolId: 'school-1',
      key: 'schools/school-1/files/uuid-a.pdf',
      status: 'UPLOADED',
    });
    presignDownloadMock.mockResolvedValue('https://minio.local/signed-url');

    const res = await GET(new Request('http://localhost/api/files/abc'), ctxFor('abc'));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://minio.local/signed-url');
    expect(presignDownloadMock).toHaveBeenCalledWith('schools/school-1/files/uuid-a.pdf', 300);
  });
});
