/**
 * Surf Intent Definitions
 *
 * Used by intent pages (/beginner/[city], /least-crowded/[city], etc.)
 * to generate SEO-optimized content templates.
 */

import { getClimateZone } from "@/lib/seo/regional-surf-data";

export type SurfIntentSlug =
  | "beginner"
  | "least-crowded"
  | "tide"
  | "water-temp"
  | "longboard"
  | "dawn-patrol"
  | "sunset";

export interface SurfIntentDefinition {
  slug: SurfIntentSlug;
  label: string;
  titleTemplate: (args: { cityName: string }) => string;
  heading: (args: { cityName: string }) => string;
  metaDescription: (args: { cityName: string; topSpots: string[] }) => string;
  intro: (args: { cityName: string; stateSlug?: string }) => string;
  focusPoints: string[];
  /** CTA headline for conversion-focused signup prompt */
  ctaHeadline?: string;
  /** CTA supporting description */
  ctaDescription?: string;
  /** CTA button text */
  ctaButton?: string;
}

export const SURF_INTENTS: Record<SurfIntentSlug, SurfIntentDefinition> = {
  beginner: {
    slug: "beginner",
    label: "Beginner Friendly",
    titleTemplate: ({ cityName }) =>
      `${cityName} Beginner Surf Spots, Lessons & Safety Tips`,
    heading: ({ cityName }) =>
      `Beginner-friendly breaks in ${cityName}`,
    metaDescription: ({ cityName, topSpots }) =>
      `Find the safest beginner surf spots in ${cityName}, including ${topSpots
        .slice(0, 3)
        .join(
          ", "
        )}. Get coaching tips, mellow wave forecasts, and session planning advice designed for new surfers.`,
    intro: ({ cityName }) =>
      `${cityName} has a long season of approachable peelers, surf schools, and forgiving sandbars. This guide highlights where new surfers can practice, how to pick a window with manageable tides, and what to expect from parking to post-surf snacks.`,
    focusPoints: [
      "Soft wave takeoff zones and sand-bottom channels",
      "Typical crowd patterns and local school schedules",
      "Weather, tide, and swell ranges that keep waves manageable",
      "Nearby shops for rentals, foamies, and lessons",
    ],
  },
  "least-crowded": {
    slug: "least-crowded",
    label: "Less Crowded",
    titleTemplate: ({ cityName }) =>
      `${cityName} Least Crowded Surf Spots & Backup Plans`,
    heading: ({ cityName }) =>
      `Where to surf in ${cityName} when the crowd packs the peak`,
    metaDescription: ({ cityName, topSpots }) =>
      `Skip the pack and score cleaner sessions in ${cityName}. Explore lower-profile spots like ${topSpots
        .slice(0, 3)
        .join(
          ", "
        )}, learn the best tide swings for stealth windows, and get quick pivot options if the lot is full.`,
    intro: ({ cityName }) =>
      `${cityName} can get claustrophobic on swell pulses, but shifting a few blocks or timing the tide flip often unlocks empty shoulders. Use this playbook to pivot quickly with backup spots, parking intel, and crowd-aware forecasting.`,
    focusPoints: [
      "Secondary peaks and tide windows that thin crowds",
      "Parking tricks and walk-in trails most visitors skip",
      "Forecast cues that trigger locals-only surges",
      "Nearby alternates when the primary target turns into a zoo",
    ],
    ctaHeadline: "Skip the pack with real-time crowd data",
    ctaDescription: "See which peaks are emptiest right now — no guessing, just data.",
    ctaButton: "See your surf call",
  },
  tide: {
    slug: "tide",
    label: "Tide Timing",
    titleTemplate: ({ cityName }) =>
      `${cityName} Tide Chart & Best Tidal Windows for Surfing`,
    heading: ({ cityName }) =>
      `${cityName} tide charts — today's highs, lows & surf windows`,
    metaDescription: ({ cityName, topSpots }) =>
      `Dial in the tide for ${cityName} surf spots like ${topSpots
        .slice(0, 3)
        .join(
          ", "
        )}. See optimal tide heights, upcoming swings, and how changing water levels reshuffle sandbars and reefs.`,
    intro: ({ cityName }) =>
      `Tides dictate which banks fire in ${cityName}. This breakdown maps upcoming highs and lows to the sandbars, reefs, and piers that flip on with just a foot of variance.`,
    focusPoints: [
      "Annotated tide windows tied to specific breaks",
      "How lunar cycles reshape sandbars through the season",
      "Safety notes for rip-prone outbound tides",
      "Session planning tips for dawn patrol versus sunset",
    ],
  },
  "water-temp": {
    slug: "water-temp",
    label: "Water Temperature",
    titleTemplate: ({ cityName }) =>
      `${cityName} Water Temperature & Wetsuit Guide`,
    heading: ({ cityName }) =>
      `Live water temps and wetsuit planner for ${cityName}`,
    metaDescription: ({ cityName, topSpots }) =>
      `Stay warm and surf longer in ${cityName}. Track water temperatures, upwelling events, and recommended wetsuit thickness for breaks like ${topSpots
        .slice(0, 3)
        .join(", ")}.`,
    intro: ({ cityName, stateSlug }) => {
      if (stateSlug) {
        const zone = getClimateZone(stateSlug);
        switch (zone) {
          case "tropical":
            return `${cityName} stays warm year-round with water temps rarely dipping below the mid-70s. A rashguard handles most sessions, and reef booties are more important than neoprene here. Use this guide to plan around trade wind shifts and seasonal swell patterns.`;
          case "warm-atlantic":
            return `${cityName} water stays swimmable most of the year, but winter cold fronts can drop temps fast. Hurricane season brings the warmest water alongside the best waves. This guide helps you pick the right rubber for each season.`;
          case "cold-pacific":
            return `${cityName} water runs cold year-round - you'll want a thick wetsuit even in summer. The upside: powerful swells, uncrowded lineups, and dramatic coastline. Use this guide to stay warm and surf longer.`;
          case "temperate-pacific":
            return `From spring upwelling chills to balmy south-swell summers, ${cityName} water temps fluctuate more than the forecast suggests. Use this guide to pick the right rubber and understand when sudden drops are coming.`;
          case "cold-atlantic":
            return `${cityName} water temps swing dramatically with the seasons - from frigid winter surf requiring full hooded suits to warm summer sessions in trunks or a spring suit. This guide helps you gear up right for every month.`;
        }
      }
      return `From spring upwelling chills to balmy south-swell summers, ${cityName} water temps fluctuate more than the forecast suggests. Use this guide to pick the right rubber and understand when sudden drops are coming.`;
    },
    focusPoints: [
      "Weekly temperature trends and seasonal averages",
      "Gear recommendations for dawn patrol versus midday",
      "Upwelling signals that drop temps overnight",
      "Health and recovery tips for long cold sessions",
    ],
    ctaHeadline: "A wetsuit planner that tracks your comfort zone",
    ctaDescription: "Log board + rubber → dialed gear recs next time.",
    ctaButton: "See your surf call",
  },
  longboard: {
    slug: "longboard",
    label: "Longboard Friendly",
    titleTemplate: ({ cityName }) =>
      `${cityName} Longboard Surf Spots & Mellow Waves`,
    heading: ({ cityName }) =>
      `Best longboard waves in ${cityName}`,
    metaDescription: ({ cityName, topSpots }) =>
      `Find the best longboard-friendly waves in ${cityName}. Mellow point breaks and rolling beach breaks at ${topSpots.slice(0, 3).join(", ")}.`,
    intro: ({ cityName }) =>
      `${cityName} offers plenty of mellow, longboard-friendly waves. These spots feature gentle shoulders, long rides, and a classic surfing vibe.`,
    focusPoints: [
      "Long, peeling waves perfect for noseriding",
      "Mellow takeoff zones with forgiving shoulders",
      "Classic surf spots with old-school vibes",
      "Best tide windows for logging sessions",
    ],
    ctaHeadline: "Your longboard forecast, tuned by your sessions",
    ctaDescription: "15-second log → smarter spot picks next time.",
    ctaButton: "See your surf call",
  },
  "dawn-patrol": {
    slug: "dawn-patrol",
    label: "Dawn Patrol",
    titleTemplate: ({ cityName }) =>
      `${cityName} Dawn Patrol Surf Spots | Best Sunrise Sessions`,
    heading: ({ cityName }) =>
      `Best dawn patrol spots in ${cityName}`,
    metaDescription: ({ cityName, topSpots }) =>
      `Catch the best sunrise surf sessions in ${cityName}. Early morning waves with less crowds at ${topSpots.slice(0, 3).join(", ")}.`,
    intro: ({ cityName }) =>
      `Early risers in ${cityName} are rewarded with glassy conditions and empty lineups. These spots offer the best dawn patrol sessions before the wind picks up.`,
    focusPoints: [
      "Glassy morning conditions before onshore winds",
      "Less crowded lineups at sunrise",
      "East-facing beaches for sunrise views",
      "Spots with easy parking for early arrivals",
    ],
    ctaHeadline: "A dawn patrol forecast tuned to your schedule",
    ctaDescription: "15-second log → better early windows next time.",
    ctaButton: "See your surf call",
  },
  sunset: {
    slug: "sunset",
    label: "Sunset Sessions",
    titleTemplate: ({ cityName }) =>
      `${cityName} Sunset Surf Spots | Best Evening Sessions`,
    heading: ({ cityName }) =>
      `Best sunset surf spots in ${cityName}`,
    metaDescription: ({ cityName, topSpots }) =>
      `End your day with epic sunset surf sessions in ${cityName}. West-facing beaches with golden hour waves at ${topSpots.slice(0, 3).join(", ")}.`,
    intro: ({ cityName }) =>
      `There's nothing like surfing into the sunset. These ${cityName} spots offer stunning golden hour sessions with west-facing views and often improving afternoon conditions.`,
    focusPoints: [
      "West-facing beaches for stunning sunset views",
      "Often cleaner afternoon conditions",
      "Golden hour photography opportunities",
      "After-work session favorites",
    ],
    ctaHeadline: "A sunset forecast tuned to your after-work windows",
    ctaDescription: "Log when you paddle out → better evening picks next time.",
    ctaButton: "See your surf call",
  },
};
