import { UserRole } from '@parta5/db';

/** Roles an admin is allowed to assign via the UI (SUPER_ADMIN is reserved). */
export const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.STUDENT,
  UserRole.SCHOOL_ADMIN,
];

/** All roles that can show up in the list/filter, in a sensible display order. */
export const ALL_ROLES: UserRole[] = [
  UserRole.SCHOOL_ADMIN,
  UserRole.TEACHER,
  UserRole.STUDENT,
  UserRole.PARENT,
  UserRole.SUPER_ADMIN,
];

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Суперадминистратор',
  [UserRole.SCHOOL_ADMIN]: 'Администратор школы',
  [UserRole.TEACHER]: 'Преподаватель',
  [UserRole.STUDENT]: 'Ученик',
  [UserRole.PARENT]: 'Родитель',
};
