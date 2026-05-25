import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './index';

type TransactionClient = Prisma.TransactionClient;

export async function withTenant<T>(
  schoolId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}
