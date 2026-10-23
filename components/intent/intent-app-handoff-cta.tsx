import type { ReactElement } from "react";

import { ContentPageAppHandoffCta } from "@/components/app-store/content-page-app-handoff-cta";
import { HideWhenInstallBarOwns } from "@/components/app-store/install-bar-owned-slot";
import type { IntentKey } from "@/lib/constants/intent-definitions";

/*
 * The one ask on /[intent]/[city] pages (Steven, 2026-10-22). It sits right
 * after the page's own data: that slot converts best of the app handoff
 * placements (beach detail after the hourly forecast, ~1.9% of views vs
 * 0.2–0.9% above the fold, 60 days to 2026-10-22), and app signups return
 * about 3x as often as web-only ones.
 */
export const INTENT_APP_HANDOFF_PLACEMENT = "after_intent_data";

interface IntentCopy {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
}

function intentCopy(intent: IntentKey, cityName: string): IntentCopy {
  switch (intent) {
    case "tide":
      return {
        eyebrow: `${cityName} tides · next check`,
        title: "Tides sorted. Is the surf worth it?",
        description: `Take the ${cityName} forecast with you. Quiver lines up tide, swell and wind so you can see when it's worth paddling out.`,
        ctaLabel: "Check the surf in the app",
      };
    case "water-temp":
      return {
        eyebrow: `${cityName} water temp · next check`,
        title: "Water temp sorted. Is it worth paddling out?",
        description: `Take the ${cityName} surf forecast with you and check the conditions when you're ready to go.`,
        ctaLabel: "Check the surf in the app",
      };
    case "sunset":
      return {
        eyebrow: `${cityName} sunset session`,
        title: "Sunset's set. Will the waves show up?",
        description: `Quiver checks the evening swell, wind and tide in ${cityName}, so you know if the last light is worth the drive.`,
        ctaLabel: "Check the evening surf in the app",
      };
    case "dawn-patrol":
      return {
        eyebrow: `${cityName} dawn patrol`,
        title: "First light's set. Is it worth the alarm?",
        description: `Quiver checks the morning swell, wind and tide in ${cityName}, so you know before you set the alarm.`,
        ctaLabel: "Check tomorrow's surf in the app",
      };
    case "beginner":
      return {
        eyebrow: `${cityName} beginner spots`,
        title: "Know when it's small and clean.",
        description: `Quiver checks size, wind and tide at ${cityName} spots for your level, so you can pick a mellow day before you go.`,
        ctaLabel: "Find a beginner day in the app",
      };
    case "longboard":
      return {
        eyebrow: `${cityName} longboard spots`,
        title: "Find the long, clean days.",
        description: `Quiver checks swell, wind and tide at ${cityName} spots, so you can catch the days that suit a log.`,
        ctaLabel: "Find a longboard day in the app",
      };
    case "least-crowded":
      return {
        eyebrow: `${cityName} quieter spots`,
        title: "Catch it before the crowd does.",
        description: `Quiver checks conditions at ${cityName} spots, so you can pick a good window and get there early.`,
        ctaLabel: "Check the surf in the app",
      };
    default:
      return {
        eyebrow: `${cityName} · next check`,
        title: `Take the ${cityName} forecast with you.`,
        description: `Quiver checks swell, wind and tide in ${cityName}, so you know when it's worth paddling out.`,
        ctaLabel: "Check the surf in the app",
      };
  }
}

interface IntentAppHandoffCtaProps {
  intent: IntentKey;
  cityName: string;
  citySlug: string;
  /** Replaces the default description, e.g. to repeat the page's own answer. */
  description?: string;
  className?: string;
}

export function IntentAppHandoffCta({
  intent,
  cityName,
  citySlug,
  description,
  className,
}: IntentAppHandoffCtaProps): ReactElement {
  const copy = intentCopy(intent, cityName);
  // Water temp keeps its existing surface and source so its history stays comparable.
  const isWaterTemp = intent === "water-temp";

  return (
    <HideWhenInstallBarOwns>
      <ContentPageAppHandoffCta
        source={isWaterTemp ? `content-water-temp-${citySlug}` : `content-intent-${intent}-${citySlug}`}
        surface={isWaterTemp ? "water_temp" : "intent"}
        placement={INTENT_APP_HANDOFF_PLACEMENT}
        target={`${intent}:${citySlug}`}
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={description ?? copy.description}
        ctaLabel={copy.ctaLabel}
        className={className}
      />
    </HideWhenInstallBarOwns>
  );
}
