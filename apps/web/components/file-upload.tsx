'use client';

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc/react';

interface UploadedAsset {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}

interface Props {
  accept?: string;
  maxSizeMB?: number;
  onUploaded: (asset: UploadedAsset) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function FileUpload({ accept, maxSizeMB = 50, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const requestUpload = trpc.file.requestUpload.useMutation();
  const confirmUpload = trpc.file.confirmUpload.useMutation();

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    setState('uploading');

    try {
      // 1. Request presigned URL
      const { fileAssetId, uploadUrl } = await requestUpload.mutateAsync({
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      // 2. PUT to S3 via XHR (fetch doesn't expose upload progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // 3. Confirm
      const asset = await confirmUpload.mutateAsync({ fileAssetId });

      setState('success');
      onUploaded(asset as UploadedAsset);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Max ${maxSizeMB} MB.`);
      setState('error');
      return;
    }
    handleFile(file);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {state === 'idle' || state === 'error' ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          Выбрать файл (макс. {maxSizeMB} MB)
        </button>
      ) : null}

      {state === 'uploading' && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right">{progress}%</p>
        </div>
      )}

      {state === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <span>✓</span>
          <span>Загружено</span>
          <button
            type="button"
            onClick={() => {
              setState('idle');
              setProgress(0);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            Загрузить другой
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
