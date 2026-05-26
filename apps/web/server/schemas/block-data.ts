import { z } from 'zod';

const HeadingData = z.object({
  type: z.literal('HEADING'),
  data: z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
});

const TextData = z.object({
  type: z.literal('TEXT'),
  data: z.object({
    html: z.string(),
    text: z.string(),
  }),
});

const ListData = z.object({
  type: z.literal('LIST'),
  data: z.object({
    ordered: z.boolean(),
    items: z.array(z.string()),
  }),
});

const ImageData = z.object({
  type: z.literal('IMAGE'),
  data: z.object({
    fileAssetId: z.string().uuid(),
    caption: z.string().optional(),
    alt: z.string().optional(),
  }),
});

const VideoData = z.object({
  type: z.literal('VIDEO'),
  data: z.object({
    videoAssetId: z.string().uuid(),
  }),
});

const VideoEmbedData = z.object({
  type: z.literal('VIDEO_EMBED'),
  data: z.object({
    provider: z.string(),
    url: z.string().url(),
    embedUrl: z.string().url(),
    providerVideoId: z.string().optional(),
  }),
});

const FileData = z.object({
  type: z.literal('FILE'),
  data: z.object({
    fileAssetId: z.string().uuid(),
    displayName: z.string(),
  }),
});

const CalloutData = z.object({
  type: z.literal('CALLOUT'),
  data: z.object({
    variant: z.enum(['info', 'warning', 'success', 'danger']),
    text: z.string(),
  }),
});

const CodeData = z.object({
  type: z.literal('CODE'),
  data: z.object({
    language: z.string(),
    code: z.string(),
  }),
});

const QuoteData = z.object({
  type: z.literal('QUOTE'),
  data: z.object({
    text: z.string(),
    author: z.string().optional(),
  }),
});

const DividerData = z.object({
  type: z.literal('DIVIDER'),
  data: z.object({}),
});

const EmbedIframeData = z.object({
  type: z.literal('EMBED_IFRAME'),
  data: z.object({
    url: z.string().url(),
    height: z.number().int().positive(),
  }),
});

export const BlockDataSchema = z.discriminatedUnion('type', [
  HeadingData,
  TextData,
  ListData,
  ImageData,
  VideoData,
  VideoEmbedData,
  FileData,
  CalloutData,
  CodeData,
  QuoteData,
  DividerData,
  EmbedIframeData,
]);

export type BlockDataInput = z.infer<typeof BlockDataSchema>;
