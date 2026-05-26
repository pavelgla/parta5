'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { VideoUploader } from '@/components/video-uploader';
import { HlsPlayer } from '@/components/hls-player';
import type { BlockProps } from '../types';

export function VideoBlock({ block, onChange, onDelete, onSavingChange }: BlockProps) {
  const [videoAssetId, setVideoAssetId] = useState<string | undefined>(
    block.data.videoAssetId as string | undefined,
  );

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const handleReady = (id: string) => {
    setVideoAssetId(id);
    onChange({ videoAssetId: id });
    updateBlock.mutate({ id: block.id, type: 'VIDEO', data: { videoAssetId: id } });
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

      {videoAssetId ? (
        <div className="space-y-2">
          <HlsPlayer videoAssetId={videoAssetId} />
          <button
            type="button"
            onClick={() => {
              setVideoAssetId(undefined);
              onChange({});
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Заменить видео
          </button>
        </div>
      ) : (
        <VideoUploader onReady={handleReady} />
      )}
    </div>
  );
}
