'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/react';

interface Props {
  videoAssetId: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export function HlsPlayer({ videoAssetId, onTimeUpdate, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);

  const { data } = trpc.video.getVideo.useQuery(
    { videoAssetId },
    { enabled: !!videoAssetId, refetchInterval: false },
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data?.hlsPlaylistUrl) return;

    const src = data.hlsPlaylistUrl;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return;
      if (!Hls.isSupported()) return;

      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
    });

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        (hlsRef.current as { destroy(): void }).destroy();
        hlsRef.current = null;
      }
    };
  }, [data?.hlsPlaylistUrl]);

  if (!data?.hlsPlaylistUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
        {data?.status === 'failed' ? 'Ошибка транскодинга' : 'Видео обрабатывается...'}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      poster={data.posterUrl ?? undefined}
      controls
      className="w-full rounded-lg"
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        onTimeUpdate?.(v.currentTime, v.duration);
      }}
      onEnded={onEnded}
    />
  );
}
