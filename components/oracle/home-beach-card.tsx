"use client";

import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

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
 * The score pill markup is duplicated from `conditions-overlay.tsx`'s
 * `ScoreBadge` (intentionally — exporting that symbol would collide with
 * `components/forecast/score-badge.tsx::ScoreBadge`).
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
      className="bg-[#2D357D] border border-[#404C92] noise-texture rounded-xl cursor-pointer transition-colors hover:border-[#F78E42]/50 focus:outline-none focus:ring-2 focus:ring-[#F78E42]/60"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="self-start inline-flex items-center rounded-full bg-[#F78E42]/15 border border-[#F78E42]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F78E42] -rotate-1">
            Your home
          </span>
          <h3 className="font-heading text-white text-base sm:text-lg font-semibold truncate">
            {rec.beach.name}
          </h3>
          <p className="text-medium text-xs line-clamp-1">
            {rec.summary}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="inline-flex items-center rounded-full bg-[#FDB84B] px-2.5 py-0.5 font-mono text-xs font-bold text-[#252D6B]"
            aria-label={`Surf score ${score.toFixed(1)} out of 10`}
          >
            {score.toFixed(1)}/10
          </span>
          <div className="text-[#4A70D9] text-base font-bold">
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
