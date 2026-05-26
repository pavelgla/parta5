'use client';

import { useState } from 'react';
import { VideoUploader } from '@/components/video-uploader';
import { HlsPlayer } from '@/components/hls-player';
import { EmbedPlayer } from '@/components/embed-player';
import { trpc } from '@/lib/trpc/react';

export default function TestVideoPage() {
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState('');

  const { data: myVideos, refetch: refetchVideos } = trpc.video.listMyVideos.useQuery();
  const { data: parsedEmbed } = trpc.embed.parseUrl.useQuery(
    { url: embedUrl },
    { enabled: embedUrl.length > 10 },
  );

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <h1 className="text-2xl font-bold">Тест видео</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Self-hosted видео</h2>
        <VideoUploader
          onReady={(id) => {
            setUploadedVideoId(id);
            refetchVideos();
          }}
        />
        {uploadedVideoId && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-gray-500">Плеер:</p>
            <HlsPlayer videoAssetId={uploadedVideoId} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Embed из внешнего сервиса</h2>
        <input
          type="url"
          value={embedUrl}
          onChange={(e) => setEmbedUrl(e.target.value)}
          placeholder="Вставьте URL с YouTube, RuTube, VK..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {parsedEmbed && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Провайдер: <span className="font-mono">{parsedEmbed.provider}</span>
            </p>
            <EmbedPlayer provider={parsedEmbed.provider} embedUrl={parsedEmbed.embedUrl} />
          </div>
        )}
        {embedUrl.length > 10 && !parsedEmbed && (
          <p className="text-sm text-red-500">URL не распознан. Попробуйте YouTube/RuTube/VK.</p>
        )}
      </section>

      {myVideos && myVideos.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Мои видео ({myVideos.length})</h2>
          <div className="space-y-3">
            {myVideos.map((v) => (
              <div key={v.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-gray-600">{v.id.slice(0, 8)}...</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      v.status === 'ready'
                        ? 'bg-green-100 text-green-700'
                        : v.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
                {v.status === 'ready' && <HlsPlayer videoAssetId={v.id} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
