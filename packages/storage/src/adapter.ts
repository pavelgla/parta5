export interface StorageAdapter {
  presignUpload(
    key: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<{ url: string; fields?: Record<string, string>; expiresAt: Date }>;
  publicUrl(key: string): string;
  delete(key: string): Promise<void>;
  headObject(key: string): Promise<{ size: number; contentType: string } | null>;
  getObjectStream(key: string): Promise<NodeJS.ReadableStream>;
  putObjectFromPath(key: string, localPath: string, contentType: string): Promise<void>;
}

/** Build canonical S3 key: schools/<schoolId>/<assetType>/<uuid>-<originalName> */
export function buildKey(
  schoolId: string,
  assetType: string,
  uuid: string,
  originalName: string,
): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `schools/${schoolId}/${assetType}/${uuid}-${safe}`;
}
