'use client';

import { useRef } from 'react';
import { trpc } from '@/lib/trpc/react';
import { HlsPlayer } from '@/components/hls-player';
import { EmbedPlayer } from '@/components/embed-player';

interface HlsVideoData {
  type: 'hls';
  videoAssetId: string;
}

interface EmbedVideoData {
  type: 'embed';
  provider: string;
  embedUrl: string;
  title?: string;
}

interface Props {
  blockId: string;
  video: HlsVideoData | EmbedVideoData;
}

export function VideoProgressTracker({ blockId, video }: Props) {
  const markCompleted = trpc.progress.markBlockCompleted.useMutation();
  const completedRef = useRef(false);

  function handleCompleted(currentTime?: number) {
    if (completedRef.current) return;
    completedRef.current = true;
    markCompleted.mutate({
      blockId,
      ...(currentTime !== undefined ? { watchedSeconds: Math.round(currentTime) } : {}),
    });
  }

  if (video.type === 'hls') {
    return (
      <HlsPlayer
        videoAssetId={video.videoAssetId}
        onCompleted={(currentTime) => handleCompleted(currentTime)}
      />
    );
  }

  return (
    <EmbedPlayer
      provider={video.provider}
      embedUrl={video.embedUrl}
      title={video.title}
      onCompleted={() => handleCompleted()}
    />
  );
}
