'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc/react';

interface Props {
  onReady: (videoAssetId: string) => void;
}

type Stage = 'idle' | 'uploading' | 'transcoding' | 'ready' | 'failed';

export function VideoUploader({ onReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestUpload = trpc.video.requestUpload.useMutation();
  const confirmUploaded = trpc.video.confirmUploaded.useMutation();
  const utils = trpc.useUtils();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!videoAssetId || (stage !== 'transcoding' && stage !== 'uploading')) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await utils.video.getVideo.fetch({ videoAssetId });
        if (data.status === 'ready') {
          stopPolling();
          setStage('ready');
          onReady(videoAssetId);
        } else if (data.status === 'failed') {
          stopPolling();
          setStage('failed');
          setError(data.errorMessage ?? 'Transcoding failed');
        } else if (data.status === 'transcoding') {
          setStage('transcoding');
        }
      } catch {
        // keep polling
      }
    }, 5000);

    return stopPolling;
  }, [videoAssetId, stage, utils, onReady, stopPolling]);

  async function handleFile(file: File) {
    setError(null);
    setUploadProgress(0);
    setStage('uploading');

    try {
      const { videoAssetId: assetId, uploadUrl } = await requestUpload.mutateAsync({
        originalName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'video/mp4',
      });

      setVideoAssetId(assetId);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.send(file);
      });

      await confirmUploaded.mutateAsync({ videoAssetId: assetId });
      setStage('transcoding');
    } catch (err) {
      setStage('failed');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const stageLabel: Record<Stage, string> = {
    idle: '',
    uploading: `Загрузка ${uploadProgress}%`,
    transcoding: 'Транскодинг HLS...',
    ready: 'Готово',
    failed: 'Ошибка',
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={handleChange}
      />

      {stage === 'idle' || stage === 'failed' ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 text-center hover:border-blue-400 transition-colors"
        >
          <p className="text-sm text-gray-500">
            Перетащите MP4/WebM/MOV или{' '}
            <span className="text-blue-600 underline">выберите файл</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">Макс. 1 ГБ</p>
        </div>
      ) : null}

      {(stage === 'uploading' || stage === 'transcoding' || stage === 'ready') && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(['uploading', 'transcoding', 'ready'] as Stage[]).map((s) => (
              <div
                key={s}
                className={`flex-1 rounded-full h-1.5 transition-colors ${
                  stage === s
                    ? 'bg-blue-500'
                    : ['ready'].includes(stage) || s === 'uploading'
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-center text-gray-600">{stageLabel[stage]}</p>
          {stage === 'uploading' && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
