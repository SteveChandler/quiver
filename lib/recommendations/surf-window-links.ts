import type { Beach } from "@/types/database";
import { buildBeachUrl, getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import type { SurfWindowLinks } from "@/types/session-intelligence";

export interface BuildSurfWindowLinksInput {
  beach: Beach;
  windowId: string;
  forecastAt?: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://www.quiversurf.app";

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const candidate = baseUrl?.trim() || DEFAULT_BASE_URL;
  return candidate.replace(/\/+$/, "");
}

function absoluteUrl(path: string | null, baseUrl: string): string | null {
  if (!path) return null;
  try {
    return new URL(path, `${baseUrl}/`).toString();
  } catch {
    return null;
  }
}

function windowPath(path: string | null, windowId: string): string | null {
  if (!path) return null;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}window=${encodeURIComponent(windowId)}`;
}

function buildAppSpotPath(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return `/app/spot/${encodeURIComponent(slug)}`;
}

export function buildSurfWindowLinks({
  beach,
  windowId,
  forecastAt,
  baseUrl,
}: BuildSurfWindowLinksInput): SurfWindowLinks {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const appPath =
    buildAppSpotPath(beach.slug) ??
    getBeachHrefSafe({
      id: beach.id,
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
      country: beach.country,
    });
  const appDeepLink = windowPath(appPath, forecastAt ?? windowId);

  const canonicalPath =
    getBeachHrefSafe({
      id: beach.id,
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
      country: beach.country,
    }) ??
    buildBeachUrl({
      slug: beach.slug,
      city: beach.city,
      state: beach.state,
      country: beach.country,
    });

  return {
    appDeepLink,
    universalLink: absoluteUrl(appDeepLink, normalizedBaseUrl),
    canonicalWebUrl: absoluteUrl(
      canonicalPath ? canonicalPath.split("?")[0] : null,
      normalizedBaseUrl
    ),
  };
}
