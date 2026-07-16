import { z } from 'zod';
import { TRPCError } from '@trpc/server';

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
    fileAssetId: z.string().uuid().optional(),
    caption: z.string().optional(),
    alt: z.string().optional(),
  }),
});

const VideoData = z.object({
  type: z.literal('VIDEO'),
  data: z.object({
    videoAssetId: z.string().uuid().optional(),
  }),
});

const VideoEmbedData = z.object({
  type: z.literal('VIDEO_EMBED'),
  data: z.object({
    provider: z.string().optional(),
    url: z.string().optional(),
    embedUrl: z.string().optional(),
    providerVideoId: z.string().optional(),
  }),
});

const FileData = z.object({
  type: z.literal('FILE'),
  data: z.object({
    fileAssetId: z.string().uuid().optional(),
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
    url: z.string().optional(),
    height: z.number().int().positive().optional(),
  }),
});

const QuizData = z.object({
  type: z.literal('QUIZ'),
  data: z.object({
    quizId: z.string().uuid(),
    title: z.string(),
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
  QuizData,
]);

export type BlockDataInput = z.infer<typeof BlockDataSchema>;

export const BLOCK_TYPES = [
  'HEADING',
  'TEXT',
  'LIST',
  'IMAGE',
  'VIDEO',
  'VIDEO_EMBED',
  'FILE',
  'CALLOUT',
  'CODE',
  'QUOTE',
  'DIVIDER',
  'EMBED_IFRAME',
  'QUIZ',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

// Keyed access to each type's `data` schema only, kept separate from BlockDataSchema
// to sidestep the TS2589 "excessively deep" error a single discriminated union
// triggers when combined with Prisma's JsonValue in a mutation's return type (TD-001).
const blockDataSchemaByType: Record<BlockType, z.ZodTypeAny> = {
  HEADING: HeadingData.shape.data,
  TEXT: TextData.shape.data,
  LIST: ListData.shape.data,
  IMAGE: ImageData.shape.data,
  VIDEO: VideoData.shape.data,
  VIDEO_EMBED: VideoEmbedData.shape.data,
  FILE: FileData.shape.data,
  CALLOUT: CalloutData.shape.data,
  CODE: CodeData.shape.data,
  QUOTE: QuoteData.shape.data,
  DIVIDER: DividerData.shape.data,
  EMBED_IFRAME: EmbedIframeData.shape.data,
  QUIZ: QuizData.shape.data,
};

export function parseBlockData(type: BlockType, data: unknown): Record<string, unknown> {
  const result = blockDataSchemaByType[type].safeParse(data);
  if (!result.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid data for block type ${type}: ${result.error.message}`,
    });
  }
  return result.data as Record<string, unknown>;
}
