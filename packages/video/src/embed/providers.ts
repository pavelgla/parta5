export interface EmbedProvider {
  provider: string;
  patterns: RegExp[];
  buildEmbedUrl: (match: RegExpMatchArray) => string;
  extractVideoId: (match: RegExpMatchArray) => string | undefined;
}

export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    provider: 'youtube',
    patterns: [
      /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/,
      /^https?:\/\/youtu\.be\/([\w-]{11})/,
    ],
    buildEmbedUrl: (match) => `https://www.youtube.com/embed/${match[1]}`,
    extractVideoId: (match) => match[1],
  },
  {
    provider: 'rutube',
    patterns: [/^https?:\/\/rutube\.ru\/video\/([\w]+)\/?/],
    buildEmbedUrl: (match) => `https://rutube.ru/play/embed/${match[1]}`,
    extractVideoId: (match) => match[1],
  },
  {
    provider: 'vk',
    patterns: [
      /^https?:\/\/(?:www\.)?vk\.com\/video(-?\d+)_(\d+)/,
      /^https?:\/\/(?:www\.)?vkvideo\.ru\/video(-?\d+)_(\d+)/,
    ],
    buildEmbedUrl: (match) => `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2`,
    extractVideoId: (match) => `${match[1]}_${match[2]}`,
  },
  {
    provider: 'kinescope',
    patterns: [/^https?:\/\/kinescope\.io\/([\w]+)/],
    buildEmbedUrl: (match) => `https://kinescope.io/embed/${match[1]}`,
    extractVideoId: (match) => match[1],
  },
  {
    provider: 'vimeo',
    patterns: [/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/],
    buildEmbedUrl: (match) => `https://player.vimeo.com/video/${match[1]}`,
    extractVideoId: (match) => match[1],
  },
  {
    provider: 'boomstream',
    patterns: [/^https?:\/\/play\.boomstream\.com\/([\w]+)/],
    buildEmbedUrl: (match) => `https://play.boomstream.com/${match[1]}?embed=1`,
    extractVideoId: (match) => match[1],
  },
  {
    provider: 'dzen',
    patterns: [/^https?:\/\/dzen\.ru\/video\/watch\/([\w]+)/],
    buildEmbedUrl: (match) => `https://dzen.ru/embed/${match[1]}`,
    extractVideoId: (match) => match[1],
  },
];
