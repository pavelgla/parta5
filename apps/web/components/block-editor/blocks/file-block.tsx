'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, FileIcon, Download } from 'lucide-react';
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function FileBlock({ block, onChange, onDelete, onSavingChange }: BlockProps) {
  const [fileAssetId, setFileAssetId] = useState<string | undefined>(
    block.data.fileAssetId as string | undefined,
  );
  const [displayName, setDisplayName] = useState<string>((block.data.displayName as string) ?? '');
  const [originalName, setOriginalName] = useState<string>('');
  const [sizeBytes, setSizeBytes] = useState<number | undefined>(undefined);

  const { data: assetData } = trpc.file.getAsset.useQuery(
    { fileAssetId: fileAssetId! },
    { enabled: !!fileAssetId && !originalName },
  );

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback((id: string | undefined, name: string) => {
    updateBlock.mutate({
      id: block.id,
      type: 'FILE',
      data: { fileAssetId: id, displayName: name },
    });
  }, 500);

  const resolvedName = assetData?.originalName ?? originalName;
  const resolvedSize = assetData?.sizeBytes ?? sizeBytes;
  const fileUrl = fileAssetId ? getFileUrl({ id: fileAssetId }) : null;

  const handleUploaded = (asset: UploadedAsset) => {
    setFileAssetId(asset.id);
    setOriginalName(asset.originalName);
    setSizeBytes(asset.sizeBytes);
    const name = displayName || asset.originalName;
    setDisplayName(name);
    onChange({ fileAssetId: asset.id, displayName: name });
    updateBlock.mutate({
      id: block.id,
      type: 'FILE',
      data: { fileAssetId: asset.id, displayName: name },
    });
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    onChange({ fileAssetId, displayName: value });
    save(fileAssetId, value);
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
        <FileUpload
          accept="application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onUploaded={handleUploaded}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <FileIcon size={20} className="shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-700">
                {resolvedName || displayName}
              </p>
              {resolvedSize !== undefined && (
                <p className="text-xs text-gray-400">{formatBytes(resolvedSize)}</p>
              )}
            </div>
            {fileUrl && (
              <a
                href={fileUrl}
                download={resolvedName || displayName}
                className="shrink-0 rounded p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="Скачать"
              >
                <Download size={16} />
              </a>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">Название файла</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="Название для отображения"
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setFileAssetId(undefined);
              setOriginalName('');
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Заменить файл
          </button>
        </div>
      )}
    </div>
  );
}
