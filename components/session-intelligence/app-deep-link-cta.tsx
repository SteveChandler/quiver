"use client";

import { ExternalLink, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/hooks/use-track-event";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";
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
  variant?: "default" | "ghost";
  tracking?: SurfWindowTrackingContext;
}

function resolveHref(links: SurfWindowLinks): string {
  return (
    links.universalLink ?? links.appDeepLink ?? IOS_APP_STORE_WEB_REDIRECT_PATH
  );
}

export function AppDeepLinkCTA({
  links,
  className,
  label,
  variant = "default",
  tracking,
}: AppDeepLinkCTAProps) {
  const { track } = useTrackEvent();
  const resolvedLabel =
    label ??
    (variant === "ghost" ? "Take it with you" : "Open this window in Quiver");
  const href = resolveHref(links);
  const isFallback = href === IOS_APP_STORE_WEB_REDIRECT_PATH;
  const ctaLabel = isFallback ? IOS_APP_STORE_CTA : resolvedLabel;
  const metadata = buildSurfWindowTrackingMetadata(tracking ?? {}, {
    targetHref: href,
    linkType: isFallback ? "app_store" : resolveAppDeepLinkType(href),
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
