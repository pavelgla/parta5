/**
 * Build the URL for a stored file asset.
 * Always routes through the authorized proxy endpoint (see ADR-005) — never
 * builds a direct S3 URL, since the school files bucket is private.
 */
export function getFileUrl(asset: { id: string }): string {
  return `/api/files/${asset.id}`;
}
