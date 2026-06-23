/**
 * Beach-badge URL resolution for email templates.
 *
 * Emails can't use next/image or inline SVG (Gmail strips SVG), so badges are
 * referenced as absolute-URL PNGs from public/images/beach-badges/. The brand
 * sticker set is referenced directly by the <Sticker> primitive in components.
 */

import { getBaseUrl } from "@/lib/mailer/client";

// Beach badges ported from Brand-Vault/surf-stickers/beaches into
// public/images/beach-badges/ — vintage surf-club crests for the 15 spots
// with a curated badge. Keyed by beach slug.
const BEACH_BADGE_SLUGS = new Set<string>([
  "blacks-beach",
  "del-mar",
  "huntington-beach",
  "la-jolla-shores",
  "linda-mar",
  "malibu",
  "mission-beach",
  "ocean-beach",
  "oceanside-pier",
  "pacific-beach",
  "ponce-inlet",
  "ponto",
  "san-clemente",
  "tourmaline",
  "windansea",
]);

/** Slugify a beach name the way the badge filenames are keyed. */
function beachSlug(nameOrSlug: string | null | undefined): string | null {
  if (!nameOrSlug) return null;
  const slug = nameOrSlug
    .toLowerCase()
    .trim()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

/**
 * Absolute URL for a beach's badge, or null when no curated badge exists.
 * Accepts a beach name or slug.
 */
export function beachBadgeUrl(
  nameOrSlug: string | null | undefined
): string | null {
  const slug = beachSlug(nameOrSlug);
  if (!slug || !BEACH_BADGE_SLUGS.has(slug)) return null;
  return `${getBaseUrl()}/images/beach-badges/${slug}.png`;
}
