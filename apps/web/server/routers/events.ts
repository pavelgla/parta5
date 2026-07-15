import { z } from 'zod';
import { router, adminProcedure } from '../trpc/init';
import { withTenant } from '@parta5/db';

export const eventsRouter = router({
  recent: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }))
    .query(async ({ ctx, input }) => {
      const events = await withTenant(ctx.schoolId, (tx) =>
        tx.learningEvent.findMany({
          where: { schoolId: ctx.schoolId },
          orderBy: { timestamp: 'desc' },
          take: input.limit,
        }),
      );

      return events.map((e) => ({ ...e, id: e.id.toString() }));
    }),
});
