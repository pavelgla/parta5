import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@parta5/db';

const SLUG_SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MAX_SLUG_ATTEMPTS = 3;

function randomSlugSuffix(length = 6): string {
  const bytes = randomBytes(length);
  let suffix = '';
  for (let i = 0; i < length; i++) {
    suffix += SLUG_SUFFIX_ALPHABET[bytes[i] % SLUG_SUFFIX_ALPHABET.length];
  }
  return suffix;
}

function isSlugConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function createWithUniqueSlug<T>(
  baseSlug: string,
  attemptCreate: (slug: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSlugSuffix()}`;
    try {
      return await attemptCreate(slug);
    } catch (err) {
      if (!isSlugConflict(err)) throw err;
      lastError = err;
    }
  }
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Не удалось создать курс: не удалось подобрать уникальный slug',
    cause: lastError,
  });
}
