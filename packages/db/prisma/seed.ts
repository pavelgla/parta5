import { PrismaClient, UserRole, CourseStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: { slug: 'school-1' },
    update: {},
    create: { slug: 'school-1', name: 'Тестовая школа №1' },
  });

  const hashedPassword = await bcrypt.hash('password', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@school1.test' },
    update: {},
    create: {
      email: 'admin@school1.test',
      hashedPassword,
      name: 'Администратор',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'teacher@school1.test' },
    update: {},
    create: {
      email: 'teacher@school1.test',
      hashedPassword,
      name: 'Учитель',
      role: UserRole.TEACHER,
      schoolId: school.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'student@school1.test' },
    update: {},
    create: {
      email: 'student@school1.test',
      hashedPassword,
      name: 'Ученик',
      role: UserRole.STUDENT,
      schoolId: school.id,
    },
  });

  await prisma.course.upsert({
    where: { schoolId_slug: { schoolId: school.id, slug: 'intro-course' } },
    update: {},
    create: {
      schoolId: school.id,
      slug: 'intro-course',
      title: 'Вводный курс',
      description: 'Тестовый черновик курса для разработки',
      status: CourseStatus.DRAFT,
      createdById: admin.id,
    },
  });

  console.log('Seed complete: 1 school, 3 users, 1 course');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
