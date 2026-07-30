import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { withTenant } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';
import { getCurrentSchool } from '@/lib/school-context';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ fileAssetId: string }>;
}

/**
 * Anonymous visitors have no `schoolId` to scope a tenant query with, so by
 * default every file behind this endpoint is private. Two narrow exceptions
 * need to be visible before any session exists:
 *  - a school's logo, shown on the branded /login page and (eventually) its
 *    public storefront;
 *  - a course cover, shown in the public course catalogue — but only once
 *    the course is PUBLISHED, never for a draft still being edited.
 * `getCurrentSchool()` resolves the school the request already belongs to
 * (via session, host, or the single-school self-host fallback), so this
 * never exposes files belonging to some *other* school.
 */
async function isPubliclyReadable(fileAssetId: string): Promise<boolean> {
  const school = await getCurrentSchool();
  if (!school) return false;

  if (school.logoFileAssetId === fileAssetId) return true;

  const course = await withTenant(school.id, (tx) =>
    tx.course.findFirst({
      where: { coverFileAssetId: fileAssetId, schoolId: school.id, status: 'PUBLISHED' },
      select: { id: true },
    }),
  );
  return !!course;
}

/**
 * Build a `Content-Disposition: inline` header that survives non-ASCII
 * (e.g. Russian) file names: an ASCII-safe `filename` fallback for old
 * clients plus the correctly percent-encoded `filename*` per RFC 5987/6266.
 */
function buildContentDisposition(originalName: string): string {
  const asciiFallback = originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'") || 'file';
  const encoded = encodeURIComponent(originalName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { fileAssetId } = await params;
  const session = await auth();

  let schoolId = session?.user?.schoolId ?? null;
  let isPublic = false;

  if (!schoolId) {
    // No session: only serve the two publicly-readable cases (see
    // isPubliclyReadable) — everything else is a 404, not a 401/403, so we
    // don't leak whether a private file exists.
    if (!(await isPubliclyReadable(fileAssetId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const school = await getCurrentSchool();
    schoolId = school?.id ?? null;
    isPublic = true;
  }

  if (!schoolId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const asset = await withTenant(schoolId, (tx) =>
    tx.fileAsset.findFirst({ where: { id: fileAssetId, schoolId } }),
  );

  if (!asset || asset.status !== 'UPLOADED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const storage = createStorageFromEnv();
    const nodeStream = await storage.getObjectStream(asset.key);
    const body = Readable.toWeb(
      nodeStream as unknown as Readable,
    ) as unknown as ReadableStream<Uint8Array>;

    const headers = new Headers({
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Content-Disposition': buildContentDisposition(asset.originalName),
      'Cache-Control': isPublic ? 'public, max-age=3600' : 'private, max-age=60',
    });
    if (asset.sizeBytes) {
      headers.set('Content-Length', String(asset.sizeBytes));
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    // We stream files instead of redirecting to a presigned MinIO URL because in
    // production the storage endpoint is an internal docker-network address the
    // browser cannot resolve (see docs/architecture/ADR-005-file-serving.md).
    console.error('[files] failed to stream download', { fileAssetId, error });
    return NextResponse.json({ error: 'Storage error' }, { status: 502 });
  }
}
