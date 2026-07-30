import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Providers } from '@/components/providers';
import { getCurrentSchool } from '@/lib/school-context';
import { brandForeground } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getCurrentSchool();
  return {
    title: school ? (school.displayName ?? school.name) : 'Парта5',
    description: 'LMS для школ и учреждений дополнительного образования',
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const school = await getCurrentSchool();

  // Exposed as CSS custom properties so any component can brand itself with
  // Tailwind arbitrary values (bg-[var(--brand)], text-[var(--brand-foreground)])
  // without threading the school's color through props everywhere.
  const brandStyle = school
    ? ({
        '--brand': school.brandColor,
        '--brand-foreground': brandForeground(school.brandColor),
      } as CSSProperties)
    : undefined;

  return (
    <html lang="ru" style={brandStyle}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
