"use client";

import { DoodleWave, DoodleWind, DoodleTide } from "@/components/beach-detail/zine/atoms";
import { getCanonicalVerdictCall } from "@/components/forecast/score-band-call";
import { compassPointToWord, type CompassPoint } from "@/lib/utils/distance-utils";
import type { SwellPartition } from "@/lib/domains/conditions/map-forecast";
import type { CanonicalDecisionVerdict } from "@/lib/recommendations/canonical-decision/types";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import { HomeHeroMedia } from "./home-hero-media";

const INK = "#11100D";
const CREAM = "#F4EBD8";
const STAMP_BLUE = "#0B3A75";

/**
 * Tier colours over the dark media band, matching the native verdict band:
 * teal for the positive tiers, gold for the qualified ones, plain for MEH.
 */
const TIER_COLOR = {
  EPIC: "#00D4AA",
  GOOD: "#00D4AA",
  FAIR: "#FDB84B",
  RIDEABLE: "#FDB84B",
  MEH: CREAM,
} as const;

/** DOM keeps sentence case so the accessible name reads "Fair", not "F-A-I-R". */
function sentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

interface HomeCallPlateProps {
  beachName: string;
  lat: number | null;
  lon: number | null;
  /** A real photo of the beach, or null when only stock imagery exists. */
  photoUrl: string | null;
  sources?: BeachSources | null;
  verdict: CanonicalDecisionVerdict | null;
  /** Recommendation score; picks the tier inside the verdict's band. */
  score: number | null;
  /** The selected window opens later than now, so positive calls say "plan" not "go". */
  isUpcoming?: boolean;
  waveHeight: string;
  swellDirection: string;
  swellPeriod: number;
  /** Primary, secondary and wind from one forecast row, for the swell field. */
  swellPartition: SwellPartition | null;
  windSpeed: number;
  windDirection: string | number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
  bestWindowTime: string;
  isTomorrow?: boolean;
  /** Why the window works, drawn from the recommendation's own reasons. */
  reason?: string | null;
  /** Editorial one-liner — regional call or generated greeting. */
  greeting?: string;
  driveContext?: {
    distanceMiles: number;
    bearing: CompassPoint;
    homeBeachName: string;
  };
}

export function HomeCallPlate({
  beachName,
  lat,
  lon,
  photoUrl,
  sources,
  verdict,
  score,
  isUpcoming = false,
  waveHeight,
  swellDirection,
  swellPeriod,
  swellPartition,
  windSpeed,
  windDirection,
  tideHeight,
  tideDirection,
  waterTemp,
  bestWindowTime,
  isTomorrow,
  reason,
  greeting,
  driveContext,
}: HomeCallPlateProps) {
  const call = verdict
    ? getCanonicalVerdictCall(verdict, score, isUpcoming ? "upcoming" : "now")
    : null;
  const labelWord = call ? sentenceCase(call.label) : "—";
  // The one place the page states when to go.
  const when =
    verdict === "no"
      ? "Wait for swell"
      : bestWindowTime && bestWindowTime !== "—"
        ? `${isTomorrow ? "Tomorrow" : "Best"} at ${bestWindowTime}`
        : "Check the windows";

  return (
    <section role="banner" aria-label={`${beachName} surf conditions`}>
      <HomeHeroMedia
        beachName={beachName}
        lat={lat}
        lon={lon}
        photoUrl={photoUrl}
        sources={sources}
        swellPartition={swellPartition}
      >
        <div className="px-4 pb-4 sm:px-6 sm:pb-5">
          <p
            className="m-0 text-[30px] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: CREAM,
            }}
          >
            {beachName}
          </p>
          {driveContext && (
            <p
              className="m-0 mt-1.5"
              data-testid="hero-drive-subtitle"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: CREAM,
                opacity: 0.8,
              }}
            >
              {Math.round(driveContext.distanceMiles)} mi{" "}
              {compassPointToWord(driveContext.bearing)} of{" "}
              {driveContext.homeBeachName}
            </p>
          )}

          <div
            className="mt-3 border-t pt-3"
            style={{ borderColor: "rgba(244,235,216,0.22)" }}
          >
            {/* The call is the page's headline: Quiver makes the call rather
                than handing over a forecast to interpret. */}
            <div
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
              data-testid="hero-decision-badge"
              aria-label={`Session decision: ${labelWord}`}
            >
              <h1
                className="zine-display m-0 text-[44px] sm:text-[56px]"
                style={{
                  fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                  lineHeight: 0.9,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color: call ? TIER_COLOR[call.label] : CREAM,
                }}
              >
                {labelWord}
              </h1>
              {call && (
                <span
                  className="text-[18px] sm:text-[22px]"
                  style={{
                    fontFamily: "var(--font-sans), 'DM Sans', system-ui, sans-serif",
                    fontWeight: 700,
                    color: CREAM,
                  }}
                >
                  {call.action}
                </span>
              )}
            </div>
            <p
              className="m-0 mt-2"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: CREAM,
                opacity: 0.88,
              }}
            >
              <span>{when}</span>
              {reason ? (
                <>
                  <span aria-hidden>{" · "}</span>
                  <span style={{ textTransform: "none", letterSpacing: "0.02em", fontWeight: 400 }}>
                    {reason}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </HomeHeroMedia>

      {/* The local's read, as a margin note rather than a second headline. */}
      {greeting && (
        <p
          className="m-0 mt-4 max-w-[560px]"
          style={{
            fontFamily: "var(--font-handwritten), cursive",
            fontSize: 19,
            lineHeight: 1.25,
            color: INK,
            opacity: 0.82,
          }}
        >
          <span aria-hidden style={{ color: STAMP_BLUE, marginRight: 4 }}>
            &ldquo;
          </span>
          {greeting}
          <span aria-hidden style={{ color: STAMP_BLUE, marginLeft: 2 }}>
            &rdquo;
          </span>
        </p>
      )}

      <ConditionStrip
        waveHeight={waveHeight}
        swellDirection={swellDirection}
        swellPeriod={swellPeriod}
        windSpeed={windSpeed}
        windDirection={windDirection}
        tideHeight={tideHeight}
        tideDirection={tideDirection}
        waterTemp={waterTemp}
      />
    </section>
  );
}

function ConditionStrip({
  waveHeight,
  swellDirection,
  swellPeriod,
  windSpeed,
  windDirection,
  tideHeight,
  tideDirection,
  waterTemp,
}: {
  waveHeight: string;
  swellDirection: string;
  swellPeriod: number;
  windSpeed: number;
  windDirection: string | number;
  tideHeight: number;
  tideDirection: "rising" | "falling";
  waterTemp: number;
}) {
  const cells = [
    {
      label: "SWELL",
      icon: <DoodleWave size={26} />,
      big: waveHeight,
      ariaLabel: `Wave height ${waveHeight}`,
      testId: "hero-wave-height",
      sub: swellPeriod > 0 ? `${swellDirection} @ ${swellPeriod}s` : swellDirection,
      color: STAMP_BLUE,
    },
    {
      label: "WIND",
      icon: <DoodleWind size={26} />,
      big: windSpeed > 0 ? `${windDirection} ${Math.round(windSpeed)}` : "—",
      sub: windSpeed > 0 ? "MPH" : null,
      color: INK,
    },
    {
      label: "TIDE",
      icon: <DoodleTide size={20} />,
      big: tideHeight ? `${tideHeight.toFixed(1)}FT` : "—",
      sub: tideDirection.toUpperCase(),
      color: INK,
    },
    {
      label: "WATER",
      icon: null,
      big: waterTemp > 0 ? `${Math.round(waterTemp)}°` : "—",
      sub: null,
      color: INK,
    },
  ];

  return (
    <div className="condition-strip mt-7" role="group" aria-label="Current conditions">
      {cells.map((c) => (
        <div key={c.label} style={{ padding: "0 8px", minWidth: 0 }}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: INK,
              }}
            >
              {c.label}
            </span>
            {c.icon && <span style={{ marginLeft: "auto", opacity: 0.85 }}>{c.icon}</span>}
          </div>
          <div
            className="text-[20px] md:text-[28px]"
            aria-label={"ariaLabel" in c ? c.ariaLabel : undefined}
            data-testid={"testId" in c ? c.testId : undefined}
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontWeight: 900,
              lineHeight: 1.05,
              color: c.color,
              letterSpacing: "-0.01em",
              wordBreak: "keep-all",
            }}
          >
            {c.big}
          </div>
          {c.sub && (
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: INK,
                opacity: 0.72,
              }}
            >
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
