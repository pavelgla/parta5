import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { TRPCError } from '@trpc/server';
import { Prisma, UserRole, withTenant } from '@parta5/db';
import { router, adminProcedure } from '../trpc/init';
import { parseRosterCsv } from '../roster/parse-roster-csv';

const BCRYPT_ROUNDS = 12;

/**
 * `User` is a global-scope table (see CLAUDE.md) — it has NO Row Level
 * Security policy, unlike every other tenant table. Every query/mutation here
 * MUST filter by `schoolId` explicitly, or an admin from school A could read
 * or edit users from school B.
 */

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function generatePassword(): string {
  // 9 random bytes -> 12 base64url chars: crypto-strong, well above the 8-char minimum.
  return randomBytes(9).toString('base64url');
}

async function requireUserInSchool(
  tx: Prisma.TransactionClient,
  id: string,
  schoolId: string,
): Promise<{ id: string; role: UserRole }> {
  const user = await tx.user.findUnique({
    where: { id },
    select: { id: true, schoolId: true, role: true },
  });
  if (!user || user.schoolId !== schoolId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
  }
  return user;
}

export const userRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          search: z.string().trim().min(1).optional(),
          role: z.nativeEnum(UserRole).optional(),
          activeOnly: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, (tx) =>
        tx.user.findMany({
          where: {
            schoolId,
            ...(input?.role ? { role: input.role } : {}),
            ...(input?.activeOnly ? { isActive: true } : {}),
            ...(input?.search
              ? {
                  OR: [
                    { name: { contains: input.search, mode: 'insensitive' } },
                    { email: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: { select: { enrollments: true } },
          },
        }),
      );
    }),

  get: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const schoolId = ctx.schoolId;
    return withTenant(schoolId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: input.id, schoolId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          groupMemberships: { include: { group: { select: { id: true, name: true } } } },
          enrollments: {
            include: { course: { select: { id: true, title: true, status: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
      }
      const { groupMemberships, enrollments, ...profile } = user;
      return {
        ...profile,
        groups: groupMemberships.map((m) => m.group),
        courses: enrollments.map((e) => ({
          ...e.course,
          enrollmentRole: e.role,
          enrolledAt: e.createdAt,
        })),
      };
    });
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().toLowerCase().email(),
        role: z
          .nativeEnum(UserRole)
          .refine(
            (role) => role !== UserRole.SUPER_ADMIN,
            'Нельзя создать пользователя с ролью SUPER_ADMIN',
          ),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      return withTenant(schoolId, async (tx) => {
        try {
          return await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              role: input.role,
              hashedPassword,
              schoolId,
              isActive: true,
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Пользователь с таким email уже существует',
            });
          }
          throw err;
        }
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200).optional(),
        role: z
          .nativeEnum(UserRole)
          .refine((role) => role !== UserRole.SUPER_ADMIN, 'Нельзя назначить роль SUPER_ADMIN')
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.role !== undefined && input.id === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя изменить свою роль' });
      }
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await requireUserInSchool(tx, input.id, schoolId);
        return tx.user.update({
          where: { id: input.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });
      });
    }),

  setActive: adminProcedure
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!input.isActive && input.id === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя деактивировать самого себя' });
      }
      const schoolId = ctx.schoolId;
      return withTenant(schoolId, async (tx) => {
        await requireUserInSchool(tx, input.id, schoolId);
        return tx.user.update({
          where: { id: input.id },
          data: { isActive: input.isActive },
          select: { id: true, isActive: true },
        });
      });
    }),

  resetPassword: adminProcedure
    .input(z.object({ id: z.string().uuid(), password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;
      const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      await withTenant(schoolId, async (tx) => {
        await requireUserInSchool(tx, input.id, schoolId);
        await tx.user.update({ where: { id: input.id }, data: { hashedPassword } });
      });
      return { success: true };
    }),

  importRoster: adminProcedure
    .input(
      z.object({
        fileBase64: z.string().min(1),
        courseId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let parsed: ReturnType<typeof parseRosterCsv>;
      try {
        parsed = parseRosterCsv(Buffer.from(input.fileBase64, 'base64'));
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Не удалось разобрать CSV',
        });
      }

      const schoolId = ctx.schoolId;
      const credentials: Array<{ email: string; password: string }> = [];
      let existingCount = 0;

      const summary = await withTenant(
        schoolId,
        async (tx) => {
          const groupNames = Array.from(
            new Set(parsed.rows.map((r) => r.group).filter((g): g is string => !!g)),
          );
          const groupIdByName = new Map<string, string>();
          for (const name of groupNames) {
            const group = await tx.group.upsert({
              where: { schoolId_name: { schoolId, name } },
              create: { schoolId, name },
              update: {},
            });
            groupIdByName.set(name, group.id);
          }

          const userIdByEmail = new Map<string, string>();
          for (const row of parsed.rows) {
            const emailKey = row.email.toLowerCase();
            const existing = await tx.user.findUnique({ where: { email: emailKey } });
            if (existing) {
              existingCount++;
              userIdByEmail.set(emailKey, existing.id);
              continue;
            }
            const password = generatePassword();
            const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
            const created = await tx.user.create({
              data: {
                name: row.name,
                email: emailKey,
                role: row.role,
                hashedPassword,
                schoolId,
                isActive: true,
              },
            });
            credentials.push({ email: created.email, password });
            userIdByEmail.set(emailKey, created.id);
          }

          for (const row of parsed.rows) {
            if (!row.group) continue;
            const groupId = groupIdByName.get(row.group);
            const userId = userIdByEmail.get(row.email.toLowerCase());
            if (!groupId || !userId) continue;
            await tx.groupMembership.upsert({
              where: { groupId_userId: { groupId, userId } },
              create: { schoolId, groupId, userId },
              update: {},
            });
          }

          if (input.courseId) {
            for (const row of parsed.rows) {
              const userId = userIdByEmail.get(row.email.toLowerCase());
              if (!userId) continue;
              await tx.enrollment.upsert({
                where: { courseId_userId: { courseId: input.courseId, userId } },
                create: { courseId: input.courseId, userId, role: row.role },
                update: {},
              });
            }
          }

          return { created: credentials.length, existing: existingCount };
        },
        { timeout: 30_000, maxWait: 10_000 },
      );

      return {
        ...summary,
        credentials,
        parseErrors: parsed.errors,
      };
    }),
});
