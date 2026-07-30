'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/react';

interface Props {
  videoAssetId: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onProgress?: (info: { currentTime: number; duration: number; percent: number }) => void;
  /** Called once when playback reaches 90%, with the current playback position in seconds. */
  onCompleted?: (currentTime: number) => void;
}

export function HlsPlayer({ videoAssetId, onTimeUpdate, onEnded, onProgress, onCompleted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);
  const lastProgressRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  const { data } = trpc.video.getVideo.useQuery(
    { videoAssetId },
    { enabled: !!videoAssetId, refetchInterval: false },
  );

  useEffect(() => {
    completedRef.current = false;
    lastProgressRef.current = 0;
  }, [data?.hlsPlaylistUrl]);

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
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
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

        const now = Date.now();
        if (now - lastProgressRef.current >= 5000) {
          lastProgressRef.current = now;
          const percent = v.duration > 0 ? v.currentTime / v.duration : 0;
          onProgress?.({ currentTime: v.currentTime, duration: v.duration, percent });
        }

        if (!completedRef.current && v.duration > 0 && v.currentTime / v.duration >= 0.9) {
          completedRef.current = true;
          onCompleted?.(v.currentTime);
        }
      }}
      onEnded={onEnded}
    />
  );
}
