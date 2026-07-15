import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/auth';
import { UserRole } from '@parta5/db';
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
export const createCallerFactory = t.createCallerFactory;

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

export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.user.schoolId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No school context' });
  }
  return next({
    ctx: {
      schoolId: ctx.session.user.schoolId,
      userId: ctx.session.user.id,
    },
  });
});

const TEACHER_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];
const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN];

export const teacherProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!TEACHER_ROLES.includes(ctx.session.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Teacher role required' });
  }
  return next({ ctx });
});

export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!ADMIN_ROLES.includes(ctx.session.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
  }
  return next({ ctx });
});
