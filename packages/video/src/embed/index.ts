import { EMBED_PROVIDERS } from './providers.js';

export interface EmbedResult {
  provider: string;
  embedUrl: string;
  videoId?: string;
}

export function parseEmbedUrl(url: string): EmbedResult | null {
  if (!url) return null;
  for (const p of EMBED_PROVIDERS) {
    for (const pattern of p.patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          provider: p.provider,
          embedUrl: p.buildEmbedUrl(match),
          videoId: p.extractVideoId(match),
        };
      }
    }
  }
  return null;
}
