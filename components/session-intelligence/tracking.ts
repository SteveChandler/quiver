import type { EventMetadata } from "@/types/implicit-preferences";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

export interface SurfWindowTrackingContext {
  surface?: string;
  beachId?: string;
  beachSlug?: string | null;
  beachName?: string;
  windowId?: string;
  rank?: number;
  score?: number;
  verdict?: string;
  localTimeLabel?: string;
  canonicalWebUrl?: string | null;
}

export type AppDeepLinkType = "universal_link" | "app_path" | "app_store";

export function buildSurfWindowTrackingContext(
  recommendation: SurfWindowRecommendation,
  surface: string
): SurfWindowTrackingContext {
  return {
    surface,
    beachId: recommendation.beach.id,
    beachSlug: recommendation.beach.slug,
    beachName: recommendation.beach.name,
    windowId: recommendation.windowId,
    rank: recommendation.rank,
    score: recommendation.score,
    verdict: recommendation.verdict,
    localTimeLabel: recommendation.localTimeLabel,
    canonicalWebUrl: recommendation.canonicalWebUrl,
  };
}

export function buildSurfWindowTrackingMetadata(
  context: SurfWindowTrackingContext,
  extra: {
    targetHref?: string;
    linkType?: AppDeepLinkType | "web";
    fallbackToAppStore?: boolean;
  } = {}
): EventMetadata {
  return {
    surface: context.surface ?? "session_intelligence",
    ...(context.beachId ? { beach_id: context.beachId } : {}),
    ...(context.beachSlug ? { beach_slug: context.beachSlug } : {}),
    ...(context.beachName ? { beach_name: context.beachName } : {}),
    ...(context.windowId ? { window_id: context.windowId } : {}),
    ...(typeof context.rank === "number" ? { rank: context.rank } : {}),
    ...(typeof context.score === "number" ? { score: context.score } : {}),
    ...(context.verdict ? { verdict: context.verdict } : {}),
    ...(context.localTimeLabel ? { local_time_label: context.localTimeLabel } : {}),
    ...(context.canonicalWebUrl ? { canonical_web_url: context.canonicalWebUrl } : {}),
    ...(extra.targetHref ? { target_href: extra.targetHref } : {}),
    ...(extra.linkType ? { link_type: extra.linkType } : {}),
    ...(typeof extra.fallbackToAppStore === "boolean"
      ? { fallback_to_app_store: extra.fallbackToAppStore }
      : {}),
  };
}

export function resolveAppDeepLinkType(href: string): AppDeepLinkType {
  if (href.startsWith("https://apps.apple.com")) return "app_store";
  if (href.startsWith("/")) return "app_path";
  return "universal_link";
}
