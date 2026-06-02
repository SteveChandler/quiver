import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowUpRight, CalendarDays, Thermometer, Waves, Wind } from "lucide-react";
import {
  getSessionIntelligenceSurfacePolicy,
  type SessionIntelligenceSeoSurface,
} from "@/lib/recommendations/session-intelligence-rollout";

type UtilitySessionIntent = Extract<
  SessionIntelligenceSeoSurface,
  "tide" | "water-temp" | "dawn-patrol" | "sunset"
>;

interface UtilitySessionHandoffProps {
  intent: UtilitySessionIntent;
  cityName: string;
  citySlug: string;
  stateSlug: string;
  bestTimeToSurfUrl?: string;
}

interface UtilitySessionHandoffVariant {
  eyebrow: string;
  heading: string;
  description: string;
  companionLabel: string;
  companionHref: (citySlug: string) => string;
  stickerSrc: string;
  companionIcon: typeof CalendarDays;
}

const VARIANTS: Record<UtilitySessionIntent, UtilitySessionHandoffVariant> = {
  tide: {
    eyebrow: "Tide into session",
    heading: "Turn the tide chart into a surf call",
    description:
      "Use the tide window as one piece of the call, then check live wave height, wind, and the exact spot page before driving.",
    companionLabel: "Check water temperature",
    companionHref: (citySlug: string): string => `/water-temp/${citySlug}`,
    stickerSrc: "/images/quiver-stickers/spot-tide-window.png",
    companionIcon: Thermometer,
  },
  "water-temp": {
    eyebrow: "Gear then go",
    heading: "Use water temperature to pick gear",
    description:
      "Water temperature sets the wetsuit call. Pair that gear choice with tide timing and live spot conditions before choosing the session.",
    companionLabel: "Watch the tide window",
    companionHref: (citySlug: string): string => `/tide/${citySlug}`,
    stickerSrc: "/images/quiver-stickers/spot-water-temp.png",
    companionIcon: CalendarDays,
  },
  "dawn-patrol": {
    eyebrow: "First light check",
    heading: "Pair first light with live conditions",
    description:
      "Dawn timing gets you in position. Confirm wind, tide, and the live spot page before making the early call.",
    companionLabel: "Watch the tide window",
    companionHref: (citySlug: string): string => `/tide/${citySlug}`,
    stickerSrc: "/images/quiver-stickers/spot-wind-read.png",
    companionIcon: CalendarDays,
  },
  sunset: {
    eyebrow: "Golden hour check",
    heading: "Pair golden hour with live conditions",
    description:
      "Sunset timing narrows the window. Confirm the latest wind, tide, and live spot read before chasing the evening session.",
    companionLabel: "Watch the tide window",
    companionHref: (citySlug: string): string => `/tide/${citySlug}`,
    stickerSrc: "/images/quiver-stickers/orange-right-arrow.png",
    companionIcon: CalendarDays,
  },
};

export function UtilitySessionHandoff({
  intent,
  cityName,
  citySlug,
  stateSlug,
  bestTimeToSurfUrl,
}: UtilitySessionHandoffProps): ReactElement | null {
  const policy = getSessionIntelligenceSurfacePolicy(intent);
  if (!policy.handoffOnly) return null;

  const variant = VARIANTS[intent];
  const seasonalHref = bestTimeToSurfUrl ?? `/best-time-to-surf/${citySlug}`;
  const CompanionIcon = variant.companionIcon;
  const links = [
    {
      label: `Open live ${cityName} conditions`,
      href: `/${stateSlug}/${citySlug}`,
      icon: Waves,
    },
    {
      label: variant.companionLabel,
      href: variant.companionHref(citySlug),
      icon: CompanionIcon,
    },
    {
      label: "Compare seasonal windows",
      href: seasonalHref,
      icon: CalendarDays,
    },
    {
      label: "Scan the forecast",
      href: "/forecast",
      icon: Wind,
    },
  ];

  return (
    <aside
      aria-label={variant.heading}
      className="relative overflow-hidden rounded-2xl border border-[#11100D]/15 bg-[#FBF6E8] p-5 text-[#11100D] shadow-[0_16px_36px_rgba(17,16,13,0.12)]"
      role="region"
    >
      <div className="pointer-events-none absolute right-4 top-3 hidden rotate-2 sm:block">
        <Image
          alt=""
          aria-hidden="true"
          className="h-auto w-24 drop-shadow-lg"
          height={112}
          src={variant.stickerSrc}
          width={112}
        />
      </div>
      <div className="max-w-4xl pr-0 sm:pr-28">
        <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-[#F78E42]">
          {variant.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#11100D]">
          {variant.heading}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#655C4C]">
          {variant.description}
        </p>
        <div className="mt-5 grid gap-2 md:grid-cols-4">
          {links.map(({ href, icon: Icon, label }) => (
            <Link
              className="group flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#11100D]/12 bg-white/70 px-3 py-2 text-sm font-semibold text-[#11100D] transition hover:border-[#F78E42]/70 hover:bg-white"
              href={href}
              key={`${href}-${label}`}
            >
              <span className="inline-flex items-center gap-2">
                <Icon aria-hidden="true" className="h-4 w-4 text-[#0B7C78]" />
                {label}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 text-[#F78E42] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
