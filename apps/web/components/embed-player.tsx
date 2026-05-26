'use client';

interface Props {
  provider: string;
  embedUrl: string;
  title?: string;
}

export function EmbedPlayer({ provider, embedUrl, title }: Props) {
  return (
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
  );
}
