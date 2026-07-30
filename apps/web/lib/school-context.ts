import { cache } from 'react';
import { headers } from 'next/headers';
import { prisma } from '@parta5/db';
import { auth } from '@/auth';
import {
  BRAND_COLOR_RE,
  DEFAULT_BRAND_COLOR,
  normalizeHost,
  parseFooterLinks,
  type FooterLink,
} from '@/lib/brand';

export interface SchoolBranding {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  legalName: string | null;
  brandColor: string;
  logoFileAssetId: string | null;
  tagline: string | null;
  contactAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  siteUrl: string | null;
  footerLinks: FooterLink[];
}

const SCHOOL_SELECT = {
  id: true,
  slug: true,
  name: true,
  displayName: true,
  legalName: true,
  brandColor: true,
  logoFileAssetId: true,
  tagline: true,
  contactAddress: true,
  contactPhone: true,
  contactEmail: true,
  siteUrl: true,
  footerLinks: true,
} as const;

type RawSchool = {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  legalName: string | null;
  brandColor: string | null;
  logoFileAssetId: string | null;
  tagline: string | null;
  contactAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  siteUrl: string | null;
  footerLinks: unknown;
};

function toBranding(school: RawSchool): SchoolBranding {
  const brandColor =
    school.brandColor && BRAND_COLOR_RE.test(school.brandColor)
      ? school.brandColor
      : DEFAULT_BRAND_COLOR;

  return {
    id: school.id,
    slug: school.slug,
    name: school.name,
    displayName: school.displayName,
    legalName: school.legalName,
    brandColor,
    logoFileAssetId: school.logoFileAssetId,
    tagline: school.tagline,
    contactAddress: school.contactAddress,
    contactPhone: school.contactPhone,
    contactEmail: school.contactEmail,
    siteUrl: school.siteUrl,
    footerLinks: parseFooterLinks(school.footerLinks),
  };
}

/**
 * Resolves the school that owns the current request, in this order:
 *
 * 1. The signed-in user's own school (`session.user.schoolId`).
 * 2. The host header, matched against `School.domain` (public storefront).
 * 3. If there is exactly one school in the whole install, that one — lets a
 *    fresh self-host work out of the box before any domain is configured.
 * 4. `null` if none of the above resolve.
 *
 * `School` is a global-scope table with no `schoolId` column of its own and
 * no Row Level Security policy (see CLAUDE.md) — queried directly through
 * `prisma`, never through `withTenant`.
 *
 * Wrapped in React's `cache()` so a single render only ever issues one query
 * here, no matter how many components call it.
 */
export const getCurrentSchool = cache(async (): Promise<SchoolBranding | null> => {
  const session = await auth();
  if (session?.user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: SCHOOL_SELECT,
    });
    if (school) return toBranding(school);
  }

  const headerList = await headers();
  const host = normalizeHost(headerList.get('x-forwarded-host') ?? headerList.get('host'));
  if (host) {
    const school = await prisma.school.findFirst({
      where: { domain: host },
      select: SCHOOL_SELECT,
    });
    if (school) return toBranding(school);
  }

  const schoolCount = await prisma.school.count();
  if (schoolCount === 1) {
    const school = await prisma.school.findFirstOrThrow({ select: SCHOOL_SELECT });
    return toBranding(school);
  }

  return null;
});

/** Same resolution as {@link getCurrentSchool}, but only the id — for public
 * pages that just need to scope a query and don't need the branding fields. */
export async function getSchoolIdForPublicRequest(): Promise<string | null> {
  const school = await getCurrentSchool();
  return school?.id ?? null;
}
