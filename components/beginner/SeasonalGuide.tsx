import { getBeginnerSeasonalData } from "@/lib/utils/beginner-seasonal-utils";
import type { BeginnerSeasonData } from "@/lib/utils/beginner-seasonal-utils";

interface SeasonalGuideProps {
  cityName: string;
  stateSlug: string;
}

const TIER_STYLES = {
  great: "bg-green-100 text-green-800",
  decent: "bg-amber-100 text-amber-800",
  challenging: "bg-red-100 text-red-800",
} as const;

const TIER_LABELS = {
  great: "Great",
  decent: "Decent",
  challenging: "Tough",
} as const;

function TierBadge({ tier }: { tier: BeginnerSeasonData["tier"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLES[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

function SeasonCard({ season }: { season: BeginnerSeasonData }) {
  return (
    <div className={`rounded-xl border p-4 ${season.color}`}>
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-lg font-semibold text-gray-800">{season.season}</h3>
        <TierBadge tier={season.tier} />
      </div>
      <p className="text-xs text-gray-500 mb-3">{season.months}</p>

      {/* Data pills - only show when data available */}
      {(season.waveRange || season.waterTempRange || season.wetsuit) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {season.waveRange && (
            <span className="inline-flex items-center rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-gray-700">
              {season.waveRange}
            </span>
          )}
          {season.waterTempRange && (
            <span className="inline-flex items-center rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-gray-700">
              {season.waterTempRange}&deg;F
            </span>
          )}
          {season.wetsuit && (
            <span className="inline-flex items-center rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-gray-700">
              {season.wetsuit}
            </span>
          )}
        </div>
      )}

      <p className="text-sm text-gray-700 leading-relaxed">
        {season.description}
      </p>
    </div>
  );
}

export function SeasonalGuide({ cityName, stateSlug }: SeasonalGuideProps) {
  const { seasons } = getBeginnerSeasonalData(stateSlug);

  return (
    <section data-testid="seasonal-guide">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Best Months for Beginner Surfing
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {seasons.map((season) => (
          <SeasonCard key={season.season} season={season} />
        ))}
      </div>
    </section>
  );
}
