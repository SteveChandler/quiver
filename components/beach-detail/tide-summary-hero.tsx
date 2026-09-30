/**
 * TideSummaryHero — server-rendered above-the-fold summary for tide sub-pages.
 *
 * Renders immediately on the server so Google (and users) see the answer to
 * "what time is high tide at [beach]?" without waiting for the client bundle.
 * Intentionally minimal — just the facts, scannable on mobile.
 */

import type { TideMetaData } from "@/lib/seo/tide-meta-data";
import { TrendingUp, TrendingDown, Waves, ArrowDown } from "lucide-react";

interface TideSummaryHeroProps {
  beachName: string;
  tideData: TideMetaData;
}

interface TideBadgeProps {
  label: string;
  time: string | null;
  height: number | null;
  variant: "high" | "low";
}

function TideBadge({ label, time, height, variant }: TideBadgeProps) {
  if (!time) return null;

  const isHigh = variant === "high";

  return (
    <div
      className="noise-texture flex flex-col items-center gap-1 rounded-2xl border px-5 py-4 min-w-[120px] text-center"
      style={{
        background: isHigh
          ? "linear-gradient(135deg, rgba(47, 57, 120, 0.9) 0%, rgba(37, 45, 107, 0.95) 100%)"
          : "linear-gradient(135deg, rgba(37, 45, 107, 0.9) 0%, rgba(30, 37, 88, 0.95) 100%)",
        borderColor: isHigh
          ? "rgba(247, 142, 66, 0.35)"
          : "rgba(184, 199, 224, 0.2)",
        transform: isHigh ? "rotate(-1deg)" : "rotate(0.75deg)",
      }}
    >
      {/* Label with directional icon */}
      <span className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-widest text-medium">
        {isHigh ? (
          <TrendingUp className="h-3.5 w-3.5 text-[#F78E42]" aria-hidden="true" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-[hsl(220,30%,75%)]" aria-hidden="true" />
        )}
        {label}
      </span>

      {/* Time — primary data point */}
      <span
        className="font-heading text-2xl font-bold leading-none text-high"
        aria-label={`${label} at ${time}`}
      >
        {time}
      </span>

      {/* Height in feet */}
      {height !== null && (
        <span className="font-mono text-sm font-medium text-medium">
          {height.toFixed(1)} ft
        </span>
      )}
    </div>
  );
}

/**
 * Determine a simple tide status label from the next high/low timestamps.
 * Returns null when there is not enough data to make a call.
 */
function getTideStatusLabel(
  nextHighAt: string | null,
  nextLowAt: string | null
): { label: string; isRising: boolean } | null {
  // Compare full timestamps, not the display times: a high at 11 PM and a low
  // at 5 AM tomorrow would sort the wrong way by clock time alone.
  if (!nextHighAt || !nextLowAt) return null;

  const highMs = Date.parse(nextHighAt);
  const lowMs = Date.parse(nextLowAt);
  if (Number.isNaN(highMs) || Number.isNaN(lowMs) || highMs === lowMs) return null;

  // If high tide comes next (before low), we are currently rising toward it.
  const isRising = highMs < lowMs;
  return { label: isRising ? "Rising" : "Falling", isRising };
}

export function TideSummaryHero({ beachName, tideData }: TideSummaryHeroProps) {
  const { nextHighTime, nextHighHeight, nextLowTime, nextLowHeight } = tideData;

  // Don't render the hero if we have no tide data at all.
  if (!nextHighTime && !nextLowTime) return null;

  const tideStatus = getTideStatusLabel(tideData.nextHighAt, tideData.nextLowAt);

  return (
    <section
      aria-label={`Today's tide times at ${beachName}`}
      className="noise-texture w-full"
      style={{
        background:
          "linear-gradient(180deg, #1E2558 0%, #252D6B 60%, rgba(37,45,107,0) 100%)",
        borderBottom: "1px solid rgba(64, 76, 146, 0.4)",
      }}
    >
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Heading row */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold leading-tight text-high sm:text-3xl">
              {beachName} Tide Chart & Surf Windows
            </h1>
          </div>

          {/* Tide status badge */}
          {tideStatus && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider"
              style={{
                background: tideStatus.isRising
                  ? "rgba(247, 142, 66, 0.12)"
                  : "rgba(100, 120, 200, 0.15)",
                borderColor: tideStatus.isRising
                  ? "rgba(247, 142, 66, 0.4)"
                  : "rgba(184, 199, 224, 0.25)",
                color: tideStatus.isRising ? "#F78E42" : "#B8C7E0",
              }}
              aria-label={`Tide is currently ${tideStatus.label}`}
            >
              {tideStatus.isRising ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {tideStatus.label}
            </span>
          )}
        </div>

        {/* Tide data badges */}
        <div
          className="flex flex-wrap gap-3 sm:gap-4"
          role="list"
          aria-label="Next tide events"
        >
          <div role="listitem">
            <TideBadge
              label="High Tide"
              time={nextHighTime}
              height={nextHighHeight}
              variant="high"
            />
          </div>
          <div role="listitem">
            <TideBadge
              label="Low Tide"
              time={nextLowTime}
              height={nextLowHeight}
              variant="low"
            />
          </div>
        </div>

        {/* Anchor link to the full chart below */}
        <div className="mt-5">
          <a
            href="#tide-chart"
            className="inline-flex items-center gap-1.5 text-sm text-medium transition-colors hover:text-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
            aria-label="Scroll to full 7-day tide chart"
          >
            <Waves className="h-4 w-4" aria-hidden="true" />
            See full 7-day chart below
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
