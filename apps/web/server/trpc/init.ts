import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/auth';
import type { Session } from 'next-auth';

export interface Context {
  session: Session | null;
}

export async function createContext(): Promise<Context> {
  const session = await auth();
  return { session };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});
