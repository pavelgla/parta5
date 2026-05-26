import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/init';
import { TRPCError } from '@trpc/server';
import { prisma } from '@parta5/db';

export const eventsRouter = router({
  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }))
    .query(async ({ ctx, input }) => {
      const { role, schoolId } = ctx.session.user;

      if (role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const events = await prisma.learningEvent.findMany({
        where: { schoolId: schoolId! },
        orderBy: { timestamp: 'desc' },
        take: input.limit,
      });

      return events;
    }),
});
