import type { BeginnerConditionsBadge, BeginnerCityEditorial } from "@/types/beginner";

const STATUS_COLORS = {
  great: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  fair: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  challenging: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
} as const;

interface BeginnerHeroProps {
  cityName: string;
  regionLabel: string;
  totalBeaches: number;
  conditionsBadge: BeginnerConditionsBadge | null;
  cityEditorial: BeginnerCityEditorial | null;
}

export function BeginnerHero({
  cityName,
  regionLabel,
  totalBeaches,
  conditionsBadge,
  cityEditorial,
}: BeginnerHeroProps) {
  return (
    <section data-testid="beginner-hero">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Beginner Surf Spots in {cityName}
        </h1>
        <p className="text-lg text-gray-600">
          {regionLabel} &middot; {totalBeaches} beginner-friendly{" "}
          {totalBeaches === 1 ? "break" : "breaks"}
        </p>
      </header>

      {conditionsBadge && (
        <div
          className={`inline-flex items-center gap-3 rounded-xl border border-slate-200 ${STATUS_COLORS[conditionsBadge.status].bg} px-5 py-3`}
        >
          <span
            className={`h-3 w-3 rounded-full ${STATUS_COLORS[conditionsBadge.status].dot}`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${STATUS_COLORS[conditionsBadge.status].text}`}
            >
              {conditionsBadge.statusLabel}
            </p>
            <p className="text-xs text-slate-600">
              {conditionsBadge.waveHeight} &middot; {conditionsBadge.wind}{" "}
              &middot; {conditionsBadge.waterTemp}
            </p>
            <p className="text-xs text-slate-500">
              Based on conditions at {conditionsBadge.spotName}
            </p>
          </div>
        </div>
      )}

      {cityEditorial && cityEditorial.description.length > 0 && (
        <p className="mt-6 text-base text-slate-700 leading-relaxed max-w-3xl">
          {cityEditorial.description[0]}
        </p>
      )}
    </section>
  );
}
