'use client';

import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { X, Link } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { EmbedPlayer } from '@/components/embed-player';
import type { BlockProps } from '../types';

export function VideoEmbedBlock({ block, onChange, onDelete, onSavingChange }: BlockProps) {
  const [inputUrl, setInputUrl] = useState<string>((block.data.url as string) ?? '');
  const [queryUrl, setQueryUrl] = useState<string>((block.data.url as string) ?? '');
  const [savedProvider, setSavedProvider] = useState<string | undefined>(
    block.data.provider as string | undefined,
  );
  const [savedEmbedUrl, setSavedEmbedUrl] = useState<string | undefined>(
    block.data.embedUrl as string | undefined,
  );

  const updateBlock = trpc.block.update.useMutation({
    onMutate: () => onSavingChange?.(true),
    onSettled: () => onSavingChange?.(false),
  });

  const save = useDebouncedCallback(
    (data: { provider?: string; url?: string; embedUrl?: string; providerVideoId?: string }) => {
      updateBlock.mutate({ id: block.id, type: 'VIDEO_EMBED', data });
    },
    500,
  );

  // Only fetch when user explicitly triggers (queryUrl changes from user action)
  const isNewQuery = !!queryUrl && queryUrl !== (block.data.url as string | undefined);
  const needsInitialFetch = !!queryUrl && !savedEmbedUrl;

  const {
    data: parseResult,
    isLoading: isParsing,
    error: parseError,
  } = trpc.embed.parseUrl.useQuery(
    { url: queryUrl },
    { enabled: !!queryUrl && (isNewQuery || needsInitialFetch) },
  );

  useEffect(() => {
    if (!parseResult) return;
    if (parseResult.embedUrl === savedEmbedUrl) return;
    setSavedProvider(parseResult.provider);
    setSavedEmbedUrl(parseResult.embedUrl);
    const data = {
      provider: parseResult.provider,
      url: queryUrl,
      embedUrl: parseResult.embedUrl,
      providerVideoId: parseResult.videoId ?? undefined,
    };
    onChange(data);
    save(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseResult]);

  const handleLoad = () => {
    if (!inputUrl.trim()) return;
    setQueryUrl(inputUrl.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLoad();
    }
  };

  const displayProvider = parseResult?.provider ?? savedProvider;
  const displayEmbedUrl = parseResult?.embedUrl ?? savedEmbedUrl;

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

      <div className="flex gap-2 mb-3">
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ссылка на YouTube, RuTube, VK, Kinescope..."
          className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={handleLoad}
          disabled={isParsing}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Link size={14} />
          {isParsing ? 'Загрузка...' : 'Загрузить'}
        </button>
      </div>

      {parseError && <p className="text-sm text-red-500 mb-2">Не удалось распознать ссылку</p>}

      {parseResult === null && queryUrl && !isParsing && (
        <p className="text-sm text-gray-400 mb-2">Провайдер не поддерживается</p>
      )}

      {displayProvider && displayEmbedUrl && (
        <EmbedPlayer provider={displayProvider} embedUrl={displayEmbedUrl} />
      )}
    </div>
  );
}
