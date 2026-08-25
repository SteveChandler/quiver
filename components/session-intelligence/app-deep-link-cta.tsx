"use client";

import { useState } from "react";
import { ExternalLink, Smartphone } from "lucide-react";

import { BeachFollowPilot } from "@/components/beach-follow";
import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/hooks/use-track-event";
import {
  trackExactCallHandoffLinkOpened,
} from "@/lib/analytics/app-handoff-tracking";
import type { BfrPageType } from "@/lib/analytics/event-taxonomy";
import {
  isCanonicalHandoffId,
  parseHandoffContext,
  serializeHandoffContext,
} from "@/lib/beach-follow/handoff";
import type { LocalBeachIntentEvidence } from "@/lib/beach-follow/local-storage";
import { qualifyBeachIntent } from "@/lib/beach-follow/intent";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";
import { cn } from "@/lib/utils";
import { FollowTopic } from "@/types/beach-follow";
import type { HandoffContext } from "@/types/exact-handoff";
import type { SurfWindowLinks } from "@/types/session-intelligence";
import {
  buildSurfWindowTrackingMetadata,
  resolveAppDeepLinkType,
  type SurfWindowTrackingContext,
} from "./tracking";

export interface AppDeepLinkCTAProps {
  links: SurfWindowLinks;
  className?: string;
  label?: string;
  variant?: "default" | "ghost";
  tracking?: SurfWindowTrackingContext;
  handoff?: HandoffContext | null;
  handoffId?: string;
  handoffSurface?: BfrPageType;
  intentEvidence?: LocalBeachIntentEvidence;
  generalFollow?: {
    beachId: string;
    beachName: string;
    pageType: BfrPageType;
  };
  now?: Date;
}

function resolveHref(links: SurfWindowLinks): string {
  return (
    links.universalLink ?? links.appDeepLink ?? IOS_APP_STORE_WEB_REDIRECT_PATH
  );
}

const EXACT_QUERY_KEYS = [
  "window",
  "handoff_id",
  "source",
  "surface",
  "placement",
  "handoff_context",
  "context",
] as const;

function withExactContext(
  href: string,
  handoffId: string,
  context: HandoffContext,
  surface: BfrPageType,
): string {
  const absolute = /^https?:\/\//.test(href);
  const url = new URL(href, "https://www.quiversurf.app");
  url.searchParams.set("window", context.windowId);
  url.searchParams.set("handoff_id", handoffId);
  url.searchParams.set("source", "exact_call");
  url.searchParams.set("surface", surface);
  url.searchParams.set("placement", "exact_call");
  url.searchParams.set("handoff_context", "exact_call");
  url.searchParams.set("context", serializeHandoffContext(context));
  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

function beachOnlyHref(href: string): string {
  const absolute = /^https?:\/\//.test(href);
  const url = new URL(href, "https://www.quiversurf.app");
  EXACT_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

export function AppDeepLinkCTA({
  links,
  className,
  label,
  variant = "default",
  tracking,
  handoff,
  handoffId,
  handoffSurface = "other",
  intentEvidence,
  generalFollow,
  now = new Date(),
}: AppDeepLinkCTAProps) {
  const { track } = useTrackEvent();
  const [generatedHandoffId] = useState<string | null>(() => {
    if (typeof crypto === "undefined" || !("randomUUID" in crypto)) return null;
    const value = crypto.randomUUID().toLowerCase();
    return isCanonicalHandoffId(value) ? value : null;
  });
  const resolvedHandoffId = handoffId ?? generatedHandoffId;
  const usesExactContract = handoff !== undefined;
  const qualification = intentEvidence
    ? qualifyBeachIntent(intentEvidence.explicitChoice, intentEvidence.signals)
    : null;
  const isSurfQualified = !usesExactContract || (
    qualification?.intent === "surfing" && qualification.state !== "unknown"
  );

  if (usesExactContract && !isSurfQualified) {
    return generalFollow ? (
      <BeachFollowPilot
        beachId={generalFollow.beachId}
        beachName={generalFollow.beachName}
        defaultTopic={FollowTopic.General}
        pageType={generalFollow.pageType}
      />
    ) : null;
  }

  const baseHref = resolveHref(links);
  const parsedHandoff = handoff ? parseHandoffContext(handoff) : null;
  const exactContext = parsedHandoff?.ok &&
    now.getTime() < Date.parse(parsedHandoff.context.expiresAt) &&
    resolvedHandoffId && isCanonicalHandoffId(resolvedHandoffId)
    ? parsedHandoff.context
    : null;
  const href = usesExactContract
    ? exactContext
      ? withExactContext(baseHref, resolvedHandoffId!, exactContext, handoffSurface)
      : beachOnlyHref(baseHref)
    : baseHref;
  const resolvedLabel = usesExactContract
    ? exactContext
      ? "Open this exact call in Quiver"
      : "Open this beach in Quiver"
    : label ??
      (variant === "ghost" ? "Take it with you" : "Open this window in Quiver");
  const isFallback = href === IOS_APP_STORE_WEB_REDIRECT_PATH;
  const ctaLabel = isFallback ? IOS_APP_STORE_CTA : resolvedLabel;
  const metadata = buildSurfWindowTrackingMetadata(tracking ?? {}, {
    targetHref: href,
    linkType: isFallback ? "app_store" : resolveAppDeepLinkType(href),
    fallbackToAppStore: isFallback,
  });

  function handleClick(): void {
    if (exactContext && resolvedHandoffId) {
      trackExactCallHandoffLinkOpened({
        handoff_id: resolvedHandoffId,
        source: "exact_call",
        handoff_context: "exact_call",
        surface: handoffSurface,
        placement: "exact_call",
      });
      return;
    }
    const payload = {
      ...(tracking?.beachId ? { beachId: tracking.beachId } : {}),
      metadata,
      debounceMs: 0,
    };

    void track("surf_window_click", payload);
    void track("app_deeplink_clicked", payload);
  }

  return (
    <Button
      asChild
      size="sm"
      variant={variant === "ghost" ? "outline" : "default"}
      className={cn(
        variant === "ghost"
          ? "h-10 w-full border-white/15 bg-transparent text-white/75 hover:bg-white/[0.06] hover:text-white sm:w-auto"
          : "h-10 w-full bg-ocean-blue text-white hover:bg-ocean-blue/90 sm:w-auto",
        className,
      )}
    >
      <a
        href={href}
        data-testid="app-deep-link-cta"
        aria-label={ctaLabel}
        onClick={handleClick}
      >
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        <span>{ctaLabel}</span>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </Button>
  );
}
