"use client";

import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

const INK = "#11100D";
const STAMP_BLUE = "#0B3A75";

export interface HomeBeachCardProps {
  /** Recommendation row for the user's home beach (from useSurfDiscovery). */
  rec: SurfDiscoveryRecommendation;
  /** Click handler — should navigate to the beach detail page. */
  onClick: (beachId: string) => void;
}

/**
 * Labeled "Your home" card surfaced below the Oracle hero whenever the
 * regional best is *not* the user's home beach. Visually mirrors
 * `SpotCard` from `nearby-spots.tsx` (Twilight + noise texture) but is
 * full-width and carries a Charming Orange "Your home" sticker chip per
 * the Quiver design system.
 *
 * The score pill markup is local to this file rather than shared — the name
 * `ScoreBadge` is already taken by `components/forecast/score-badge.tsx`,
 * which is a different (circular) treatment.
 */
export function HomeBeachCard({ rec, onClick }: HomeBeachCardProps) {
  const score = Math.min(rec.score / 10, 9.9);

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={() => onClick(rec.beach.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(rec.beach.id);
        }
      }}
      data-testid="home-beach-card"
      aria-label={`Your home beach: ${rec.beach.name}`}
      className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F78E42]/60"
      style={{
        background: "#F0E5CC",
        boxShadow: "2px 4px 0 rgba(0,0,0,0.18)",
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            className="self-start rot-neg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "#F78E42",
              color: "#11100D",
              boxShadow: "2px 2px 0 rgba(17,16,13,0.3)",
            }}
          >
            Your home
          </span>
          <h3
            className="truncate"
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontSize: 20,
              lineHeight: 1.1,
              textTransform: "uppercase",
              color: INK,
              margin: 0,
            }}
          >
            {rec.beach.name}
          </h3>
          <p className="line-clamp-1 text-xs" style={{ color: INK, opacity: 0.7 }}>
            {rec.summary}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="px-2.5 py-0.5 font-mono text-xs font-bold"
            style={{ background: INK, color: "#F4EBD8" }}
            aria-label={`Surf score ${score.toFixed(1)} out of 10`}
          >
            {score.toFixed(1)}/10
          </span>
          <div
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontSize: 20,
              color: STAMP_BLUE,
            }}
          >
            <WaveHeightDisplay
              height={rec.waveHeightBadge ?? rec.forecast.wave_height}
              dataSource={rec.forecast.data_source}
              isCalibrated={rec.forecast.isCalibrated}
              showTooltip={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
