import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { withTenant } from '@parta5/db';
import { createStorageFromEnv } from '@parta5/storage';

export const runtime = 'nodejs';

const PRESIGN_EXPIRES_SECONDS = 300;

interface RouteContext {
  params: Promise<{ fileAssetId: string }>;
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
    const url = await storage.presignDownload(asset.key, PRESIGN_EXPIRES_SECONDS);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    console.error('[files] failed to presign download', { fileAssetId, error });
    return NextResponse.json({ error: 'Storage error' }, { status: 502 });
  }
}
