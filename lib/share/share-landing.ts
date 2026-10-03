import {
  loadForecastWindowShareMetadata,
  type ForecastWindowShareMetadata,
} from "@/lib/share/forecast-window-share";
import { APP_HANDOFF_ORIGIN } from "@/lib/constants/app-handoff";
import { isValidUUID } from "@/lib/utils/validation";

const GO_HOST = new URL(APP_HANDOFF_ORIGIN).host;
const BEACH_SLUG_PATTERN = /^[a-z0-9-]+$/;
const NEUTRAL_DESCRIPTION =
  "Wave, wind, and tide conditions can change quickly. Check the latest forecast and official advisories.";

interface ShareLandingBeach {
  name: string;
  slug?: string | null;
}

interface ShareLandingDependencies {
  loadBeach?: (slug: string) => Promise<ShareLandingBeach | null>;
}

/** The share id is a random UUID minted by the sharer's app; anything else is dropped. */
export function parseShareId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !isValidUUID(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function isGoHost(host: string | null | undefined): boolean {
  return host?.trim().toLowerCase() === GO_HOST;
}

/**
 * Cross-host link: a tap from www to go is what makes iOS hand the URL to the
 * installed app. `o=1` marks "already tried the app", so the go page does not
 * offer the same link again.
 */
export function buildOpenInQuiverUrl({
  slug,
  windowValue,
  shareId,
}: {
  slug: string;
  windowValue?: string | null;
  shareId?: string | null;
}): string {
  const search = new URLSearchParams();
  if (windowValue) search.set("window", windowValue);
  if (shareId) search.set("sid", shareId);
  search.set("o", "1");
  return `${APP_HANDOFF_ORIGIN}/app/spot/${encodeURIComponent(slug)}?${search.toString()}`;
}

async function defaultLoadBeach(slug: string): Promise<ShareLandingBeach | null> {
  const { getBeachBySlugOrId } = await import("@/lib/utils/beach-lookup-utils");
  return getBeachBySlugOrId(slug);
}

/**
 * Metadata for the spot share landing. A link with no resolvable window gets
 * the beach card. The og/beach image is cached for a day, so the title must
 * not claim anything about "now".
 */
export async function loadShareLandingMetadata(
  input: Parameters<typeof loadForecastWindowShareMetadata>[0],
  dependencies: ShareLandingDependencies = {},
): Promise<ForecastWindowShareMetadata> {
  const metadata = await loadForecastWindowShareMetadata(input);
  if (!metadata.isFallback || metadata.forecastAt) return metadata;

  try {
    const beach = await (dependencies.loadBeach ?? defaultLoadBeach)(
      metadata.slug,
    );
    const slug = beach?.slug?.trim().toLowerCase();
    const name = beach?.name?.trim();
    if (!beach || !name || !slug || !BEACH_SLUG_PATTERN.test(slug)) {
      return metadata;
    }
    const title = `${name} surf forecast on Quiver`;
    return {
      ...metadata,
      title,
      description: NEUTRAL_DESCRIPTION,
      beachName: name,
      ogImagePath: `/api/og/beach?slug=${encodeURIComponent(slug)}`,
    };
  } catch {
    return metadata;
  }
}
