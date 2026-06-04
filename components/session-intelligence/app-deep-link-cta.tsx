"use client";

import { ExternalLink, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/hooks/use-track-event";
import { IOS_APP_STORE_CTA, IOS_APP_STORE_URL } from "@/lib/constants/app-store";
import { cn } from "@/lib/utils";
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
  tracking?: SurfWindowTrackingContext;
}

function resolveHref(links: SurfWindowLinks): string {
  return links.universalLink ?? links.appDeepLink ?? IOS_APP_STORE_URL;
}

export function AppDeepLinkCTA({
  links,
  className,
  label = "Open this window in Quiver",
  tracking,
}: AppDeepLinkCTAProps) {
  const { track } = useTrackEvent();
  const href = resolveHref(links);
  const isFallback = href === IOS_APP_STORE_URL;
  const ctaLabel = isFallback ? IOS_APP_STORE_CTA : label;
  const metadata = buildSurfWindowTrackingMetadata(tracking ?? {}, {
    targetHref: href,
    linkType: resolveAppDeepLinkType(href),
    fallbackToAppStore: isFallback,
  });

  function handleClick(): void {
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
      className={cn(
        "h-10 w-full bg-ocean-blue text-white hover:bg-ocean-blue/90 sm:w-auto",
        className
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
