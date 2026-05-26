'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, ImageIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { FileUpload } from '@/components/file-upload';
import { getFileUrl } from '@/lib/file-url';
import type { BlockProps } from '../types';

interface UploadedAsset {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}

export function ImageBlock({ block, onChange, onDelete, onSavingChange }: BlockProps) {
  const [fileAssetId, setFileAssetId] = useState<string | undefined>(
    block.data.fileAssetId as string | undefined,
  );
  const [imageKey, setImageKey] = useState<string | undefined>(undefined);
  const [alt, setAlt] = useState<string>((block.data.alt as string) ?? '');
  const [caption, setCaption] = useState<string>((block.data.caption as string) ?? '');

  const { data: assetData } = trpc.file.getAsset.useQuery(
    { fileAssetId: fileAssetId! },
    { enabled: !!fileAssetId && !imageKey },
  );

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((id: string | undefined, a: string, c: string) => {
    updateBlock.mutate({
      id: block.id,
      type: 'IMAGE',
      data: { fileAssetId: id, alt: a, caption: c },
    });
  }, 500);

  const resolvedKey = imageKey ?? assetData?.key;
  const imageUrl = resolvedKey ? getFileUrl({ key: resolvedKey }) : null;

  const handleUploaded = (asset: UploadedAsset) => {
    setFileAssetId(asset.id);
    setImageKey(asset.key);
    onChange({ fileAssetId: asset.id, alt, caption });
    updateBlock.mutate({
      id: block.id,
      type: 'IMAGE',
      data: { fileAssetId: asset.id, alt, caption },
    });
  };

  const handleAltChange = (value: string) => {
    setAlt(value);
    onChange({ fileAssetId, alt: value, caption });
    save(fileAssetId, value, caption);
  };

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    onChange({ fileAssetId, alt, caption: value });
    save(fileAssetId, alt, value);
  };

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Удалить блок"
      >
        <X size={14} />
      </button>

      {!fileAssetId ? (
        <FileUpload accept="image/*" onUploaded={handleUploaded} />
      ) : (
        <div className="space-y-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={alt}
              className="max-w-full rounded-lg object-contain max-h-96"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              <ImageIcon size={16} />
              <span>Изображение загружено</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Alt-текст</label>
              <input
                type="text"
                value={alt}
                onChange={(e) => handleAltChange(e.target.value)}
                placeholder="Описание изображения"
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Подпись</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                placeholder="Подпись под изображением"
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFileAssetId(undefined);
              setImageKey(undefined);
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Заменить изображение
          </button>
        </div>
      )}
    </div>
  );
}
