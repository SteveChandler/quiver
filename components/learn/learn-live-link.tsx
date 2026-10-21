"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { useTrackEvent } from "@/hooks/use-track-event";
import type { CTAClickMetadata } from "@/types/implicit-preferences";

export type LearnLiveLinkPlacement = "learn_short_answer_live_link" | "learn_sidebar_next_paddle";

interface LearnLiveLinkProps {
  slug: string;
  href: string;
  label: string;
  placement: LearnLiveLinkPlacement;
  className?: string;
  children: ReactNode;
}

/** Tracked hand-off from a guide to the live Quiver page its topic points at. */
export function LearnLiveLink({
  slug,
  href,
  label,
  placement,
  className,
  children,
}: LearnLiveLinkProps): ReactElement {
  const { track } = useTrackEvent();

  const handleClick = (): void => {
    const metadata: CTAClickMetadata & Record<string, unknown> = {
      cta: "other",
      location: placement,
      cta_family: "learn_live_link",
      source: `content-learn-${slug}`,
      surface: "learn",
      placement,
      target: `learn:${slug}`,
      cta_text: label,
      destination_url: href,
      destination_type: "live_page",
    };
    void track("cta_click", { metadata, debounceMs: 0 });
  };

  return (
    <Link href={href} onClick={handleClick} className={className} data-placement={placement}>
      {children}
    </Link>
  );
}
