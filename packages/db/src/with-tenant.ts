import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './index';

type TransactionClient = Prisma.TransactionClient;

export interface WithTenantOptions {
  /** Max duration of the transaction in ms (Prisma default: 5000). */
  timeout?: number;
  /** Max time to wait for a connection from the pool in ms (Prisma default: 2000). */
  maxWait?: number;
}

/**
 * Run `fn` in a transaction scoped to one school (RLS reads app.current_school_id).
 *
 * Request-path callers should keep the Prisma defaults — a slow transaction there
 * is a bug, not something to wait out. Batch jobs that legitimately write
 * thousands of rows (course import) pass an explicit timeout.
 */
export async function withTenant<T>(
  schoolId: string,
  fn: (tx: TransactionClient) => Promise<T>,
  options?: WithTenantOptions,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  }, options);
}
