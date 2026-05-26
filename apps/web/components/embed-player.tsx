'use client';

interface Props {
  provider: string;
  embedUrl: string;
  title?: string;
  onCompleted?: () => void;
}

// TODO Phase 2: YouTube IFrame API for auto-completed detection
export function EmbedPlayer({ provider, embedUrl, title, onCompleted }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ paddingTop: '56.25%' }}
      >
        <iframe
          src={embedUrl}
          title={title ?? `${provider} video`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
      {onCompleted && (
        <button
          onClick={onCompleted}
          aria-label="Отметить видео как просмотренное"
          className="self-start rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 active:bg-green-800"
        >
          ✓ Я посмотрел
        </button>
      )}
    </div>
  );
}
