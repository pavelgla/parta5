import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, withTenant } from '@parta5/db';
import { router, teacherProcedure, adminProcedure } from '../trpc/init';

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export const groupRouter = router({
  list: teacherProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, (tx) =>
      tx.group.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { memberships: true } } },
      }),
    );
  }),

  get: teacherProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, async (tx) => {
      const group = await tx.group.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          memberships: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      const { memberships, ...rest } = group;
      return { ...rest, members: memberships.map((m) => m.user) };
    });
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        try {
          return await tx.group.create({ data: { schoolId, name: input.name } });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Группа с таким именем уже существует',
            });
          }
          throw err;
        }
      });
    }),

  rename: adminProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        try {
          return await tx.group.update({ where: { id: input.id }, data: { name: input.name } });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Группа с таким именем уже существует',
            });
          }
          throw err;
        }
      });
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      // GroupMembership -> Group is ON DELETE CASCADE (see schema.prisma); users
      // themselves are untouched.
      return withTenant(schoolId, (tx) => tx.group.delete({ where: { id: input.id } }));
    }),

  addMembers: adminProcedure
    .input(z.object({ groupId: z.string().uuid(), userIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        const users = await tx.user.findMany({
          where: { id: { in: input.userIds }, schoolId },
          select: { id: true },
        });
        if (users.length !== input.userIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Некоторые пользователи не принадлежат этой школе',
          });
        }
        await Promise.all(
          input.userIds.map((userId) =>
            tx.groupMembership.upsert({
              where: { groupId_userId: { groupId: input.groupId, userId } },
              create: { schoolId, groupId: input.groupId, userId },
              update: {},
            }),
          ),
        );
        return { added: input.userIds.length };
      });
    }),

  removeMember: adminProcedure
    .input(z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.groupMembership.deleteMany({
          where: { groupId: input.groupId, userId: input.userId },
        }),
      );
    }),
});
