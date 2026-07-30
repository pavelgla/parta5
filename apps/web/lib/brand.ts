import { z } from 'zod';

/**
 * Pure branding helpers — no Next.js / Prisma imports, so this module can be
 * unit-tested in isolation (see brand.test.ts) and safely imported from
 * edge-safe code paths if ever needed.
 */

export const BRAND_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_BRAND_COLOR = '#1D4ED8';

export const footerLinksSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(60),
      url: z.string().trim().url(),
    }),
  )
  .max(8);

export type FooterLink = z.infer<typeof footerLinksSchema>[number];

/**
 * Safe parse of the `footerLinks` Json column. Any shape mismatch (including
 * `null`/`undefined`/garbage written outside the app) yields an empty array
 * rather than throwing — this is display data, not something worth crashing
 * a page render over.
 */
export function parseFooterLinks(value: unknown): FooterLink[] {
  const result = footerLinksSchema.safeParse(value);
  return result.success ? result.data : [];
}

/**
 * Strips a port suffix (`example.com:3000` -> `example.com`) and lower-cases
 * the host, for comparing against `School.domain`. Returns null for empty
 * input so callers can fall through to the next resolution strategy.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  const withoutPort = trimmed.split(':')[0];
  const normalized = withoutPort.toLowerCase();
  return normalized || null;
}

const HEX_COLOR_COMPONENTS = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** sRGB -> linear-light, per the WCAG relative luminance formula. */
function linearizeChannel(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Picks a readable foreground color for text/icons placed on top of a
 * `brandColor` background, using the WCAG relative luminance formula
 * (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance). Light backgrounds
 * (luminance above the 0.179 cutoff commonly used to choose between black
 * and white overlay text) get the near-black `#1d2125`; dark backgrounds get
 * white. Malformed input (should not happen — `brandColor` is validated with
 * {@link BRAND_COLOR_RE} before it ever reaches here) falls back to white,
 * since most school brand colors in practice are mid-to-dark.
 */
export function brandForeground(hex: string): '#ffffff' | '#1d2125' {
  const match = HEX_COLOR_COMPONENTS.exec(hex);
  if (!match) return '#ffffff';

  const [r, g, b] = match.slice(1, 4).map((component) => parseInt(component, 16) / 255);
  const luminance =
    0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);

  return luminance > 0.179 ? '#1d2125' : '#ffffff';
}
