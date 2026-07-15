import { z } from 'zod';
import { router, tenantProcedure } from '../trpc/init';
import { parseEmbedUrl } from '@parta5/video';

export const embedRouter = router({
  parseUrl: tenantProcedure
    .input(z.object({ url: z.string() }))
    .query(({ input }) => parseEmbedUrl(input.url)),
});
