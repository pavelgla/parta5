import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import { parseEmbedUrl } from '@parta5/video';

export const embedRouter = router({
  parseUrl: publicProcedure
    .input(z.object({ url: z.string() }))
    .query(({ input }) => parseEmbedUrl(input.url)),
});
