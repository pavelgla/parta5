import { createStorageFromEnv } from '@parta5/storage';

export function getFileUrl(asset: { key: string }): string {
  return createStorageFromEnv().publicUrl(asset.key);
}
