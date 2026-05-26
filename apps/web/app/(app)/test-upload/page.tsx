'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/file-upload';

interface UploadedAsset {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}

export default function TestUploadPage() {
  const [uploaded, setUploaded] = useState<UploadedAsset[]>([]);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 px-4">
      <h1 className="text-xl font-semibold">Test File Upload</h1>

      <FileUpload
        accept="image/*,application/pdf"
        maxSizeMB={50}
        onUploaded={(asset) => setUploaded((prev) => [asset, ...prev])}
      />

      {uploaded.length > 0 && (
        <ul className="space-y-2 text-sm">
          {uploaded.map((a) => (
            <li key={a.id} className="rounded border border-green-200 bg-green-50 px-3 py-2">
              <div className="font-medium">{a.originalName}</div>
              <div className="text-gray-500 text-xs">{a.key}</div>
              <div className="text-gray-500 text-xs">status: {a.status}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
