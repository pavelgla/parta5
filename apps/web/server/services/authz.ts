import { TRPCError } from '@trpc/server';
import { UserRole, type Prisma } from '@parta5/db';

type TransactionClient = Prisma.TransactionClient;

export async function assertCanEditCourse(
  tx: TransactionClient,
  courseId: string,
  userId: string,
  role: UserRole,
): Promise<void> {
  const course = await tx.course.findUnique({
    where: { id: courseId },
    select: { id: true, createdById: true },
  });

  if (!course) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
  }

  if (role === UserRole.SCHOOL_ADMIN || role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (role === UserRole.TEACHER && course.createdById === userId) {
    return;
  }

  throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your course' });
}
