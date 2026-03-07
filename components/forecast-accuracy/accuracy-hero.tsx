/**
 * AccuracyHero
 *
 * Server component — renders the hero section for /forecast-accuracy.
 * Displays three stat cards: improvement %, beach count, and predictions validated.
 */

interface AccuracyHeroProps {
  avgImprovementPct: number;
  beachCount: number;
  totalPredictions: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function AccuracyHero({
  avgImprovementPct,
  beachCount,
  totalPredictions,
}: AccuracyHeroProps) {
  const improvementDisplay = `${Math.round(avgImprovementPct)}%`;

  return (
    <header className="mb-12 text-center">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
        How Accurate Is Quiver&apos;s Surf Forecast?
      </h1>
      <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
        Updated daily from live buoy data. Rolling 14-day window comparing our
        Quiver&apos;s forecasts against the NOAA marine baseline.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
        {/* Improvement stat */}
        <div className="rounded-2xl bg-white border border-white/20 px-6 py-6 flex flex-col items-center">
          <span className="text-4xl font-bold text-emerald-400 mb-1">
            {improvementDisplay}
          </span>
          <span className="text-sm font-medium text-white/80 text-center">
            Average Improvement over NOAA Baseline
          </span>
        </div>

        {/* Beach count stat */}
        <div className="rounded-2xl bg-white border border-white/20 px-6 py-6 flex flex-col items-center">
          <span className="text-4xl font-bold text-sky-300 mb-1">
            {formatNumber(beachCount)}
          </span>
          <span className="text-sm font-medium text-white/80 text-center">
            Beaches Tracked
          </span>
        </div>

        {/* Predictions stat */}
        <div className="rounded-2xl bg-white border border-white/20 px-6 py-6 flex flex-col items-center">
          <span className="text-4xl font-bold text-amber-400 mb-1">
            {formatNumber(totalPredictions)}
          </span>
          <span className="text-sm font-medium text-white/80 text-center">
            Predictions Validated
          </span>
        </div>
      </div>
    </header>
  );
}
