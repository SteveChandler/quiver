"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowUpRight, CalendarDays, MapPin, Waves } from "lucide-react";

import { useTrackEvent } from "@/hooks/use-track-event";

export type SessionIntelligenceIntentIcon =
  | "arrow-up-right"
  | "calendar-days"
  | "map-pin"
  | "waves";

interface SessionIntelligenceIntentLinkProps {
  href: string;
  label: string;
  index: number;
  cityName: string;
  citySlug: string;
  stateSlug: string;
  icon: SessionIntelligenceIntentIcon;
  className?: string;
}

const ICONS = {
  "arrow-up-right": ArrowUpRight,
  "calendar-days": CalendarDays,
  "map-pin": MapPin,
  waves: Waves,
} as const;

export function SessionIntelligenceIntentLink({
  href,
  label,
  index,
  cityName,
  citySlug,
  stateSlug,
  icon: Icon,
  className,
}: SessionIntelligenceIntentLinkProps): ReactElement {
  const { track } = useTrackEvent();
  const LeadingIcon = ICONS[Icon];

  function handleClick(): void {
    void track("seo_intent_page_window_clicked", {
      metadata: {
        surface: "intent_handoff",
        city_name: cityName,
        city_slug: citySlug,
        state_slug: stateSlug,
        target_href: href,
        link_label: label,
        link_index: index,
      },
      debounceMs: 0,
    });
  }

  return (
    <Link className={className} href={href} onClick={handleClick}>
      <span className="inline-flex items-center gap-2">
        <LeadingIcon aria-hidden="true" className="h-4 w-4 text-[#f68b33]" />
        {label}
      </span>
      <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-white/65" />
    </Link>
  );
}
