/**
 * Build a public URL for a stored asset.
 * Uses S3_PUBLIC_URL env var directly to avoid pulling server-only AWS SDK
 * into client bundles.
 */
export function getFileUrl(asset: { key: string }): string {
  const base = (process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? process.env.S3_PUBLIC_URL ?? '').replace(
    /\/$/,
    '',
  );
  return `${base}/${asset.key}`;
}
