import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma, UserRole } from '@parta5/db';
import { authConfig } from '@/auth.config';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      schoolId: string | null;
      role: UserRole;
    } & DefaultSession['user'];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          schoolId: user.schoolId,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async authorized({ auth: session }) {
      return !!session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.schoolId = (user as { schoolId?: string | null }).schoolId ?? null;
        token.role = (user as { role?: UserRole }).role ?? UserRole.STUDENT;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.schoolId = token.schoolId as string | null;
      session.user.role = token.role as UserRole;
      return session;
    },
  },
});
