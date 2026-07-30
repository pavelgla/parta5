import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, withTenant } from '@parta5/db';
import { router, adminProcedure } from '../trpc/init';
import { BRAND_COLOR_RE, footerLinksSchema } from '@/lib/brand';

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Empty string from a form field -> null; anything else passes through unchanged. */
function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() === '' ? null : value.trim();
}

const SCHOOL_SELECT = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  displayName: true,
  legalName: true,
  domain: true,
  brandColor: true,
  logoFileAssetId: true,
  tagline: true,
  contactAddress: true,
  contactPhone: true,
  contactEmail: true,
  siteUrl: true,
  footerLinks: true,
} as const;

export const schoolRouter = router({
  get: adminProcedure.query(async ({ ctx }) => {
    const schoolId = ctx.schoolId;
    const school = await withTenant(schoolId, (tx) =>
      tx.school.findUnique({ where: { id: schoolId }, select: SCHOOL_SELECT }),
    );
    if (!school) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Школа не найдена' });
    }
    return school;
  }),

  update: adminProcedure
    .input(
      z.object({
        displayName: z.string().trim().max(200).optional(),
        legalName: z.string().trim().max(300).optional(),
        domain: z.string().trim().max(253).optional(),
        brandColor: z
          .string()
          .trim()
          .refine((v) => v === '' || BRAND_COLOR_RE.test(v), 'Цвет должен быть в формате #RRGGBB')
          .optional(),
        logoFileAssetId: z.string().uuid().nullable().optional(),
        tagline: z.string().trim().max(300).optional(),
        contactAddress: z.string().trim().max(500).optional(),
        contactPhone: z.string().trim().max(50).optional(),
        contactEmail: z
          .string()
          .trim()
          .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Некорректный email')
          .optional(),
        siteUrl: z
          .string()
          .trim()
          .refine((v) => v === '' || z.string().url().safeParse(v).success, 'Некорректный URL')
          .optional(),
        footerLinks: footerLinksSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schoolId = ctx.schoolId;

      return withTenant(schoolId, async (tx) => {
        if (input.logoFileAssetId) {
          const asset = await tx.fileAsset.findFirst({
            where: { id: input.logoFileAssetId, schoolId },
          });
          if (!asset) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Файл логотипа не найден среди файлов школы',
            });
          }
        }

        try {
          return await tx.school.update({
            where: { id: schoolId },
            data: {
              ...(input.displayName !== undefined
                ? { displayName: emptyToNull(input.displayName) }
                : {}),
              ...(input.legalName !== undefined ? { legalName: emptyToNull(input.legalName) } : {}),
              ...(input.domain !== undefined ? { domain: emptyToNull(input.domain) } : {}),
              ...(input.brandColor !== undefined
                ? { brandColor: emptyToNull(input.brandColor) }
                : {}),
              ...(input.logoFileAssetId !== undefined
                ? { logoFileAssetId: input.logoFileAssetId }
                : {}),
              ...(input.tagline !== undefined ? { tagline: emptyToNull(input.tagline) } : {}),
              ...(input.contactAddress !== undefined
                ? { contactAddress: emptyToNull(input.contactAddress) }
                : {}),
              ...(input.contactPhone !== undefined
                ? { contactPhone: emptyToNull(input.contactPhone) }
                : {}),
              ...(input.contactEmail !== undefined
                ? { contactEmail: emptyToNull(input.contactEmail) }
                : {}),
              ...(input.siteUrl !== undefined ? { siteUrl: emptyToNull(input.siteUrl) } : {}),
              ...(input.footerLinks !== undefined
                ? { footerLinks: input.footerLinks as Prisma.InputJsonValue }
                : {}),
            },
            select: SCHOOL_SELECT,
          });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Этот домен уже используется другой школой',
            });
          }
          throw err;
        }
      });
    }),
});
