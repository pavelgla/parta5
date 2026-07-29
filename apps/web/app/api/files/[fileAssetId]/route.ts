import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { withTenant } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ fileAssetId: string }>;
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
  const session = await auth();
  const schoolId = session?.user?.schoolId;
  if (!schoolId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileAssetId } = await params;

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
      'Cache-Control': 'private, max-age=60',
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
