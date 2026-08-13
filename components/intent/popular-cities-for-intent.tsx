import Link from "next/link";
import {
  buildCityIntentUrl,
  type IntentKey,
} from "@/lib/constants/intent-definitions";

interface CityLink {
  slug: string;
  name: string;
}

interface PopularCitiesForIntentProps {
  intentKey: IntentKey;
  intentLabel: string;
  stateName: string;
  cities: CityLink[];
}

/**
 * PopularCitiesForIntent - State-level backstop for crawl loops
 *
 * Displayed on state intent pages (e.g., /beginner/ca) to link DOWN
 * to city intent pages, creating the crawl loop:
 * state intent -> city intent -> city hub -> state intent
 *
 * Two-tier display:
 * - Top 8 cities: prominent grid (existing style)
 * - Remaining cities (9+): compact grid, always server-rendered for crawler discovery
 */
export function PopularCitiesForIntent({
  intentKey,
  intentLabel,
  stateName,
  cities,
}: PopularCitiesForIntentProps) {
  if (cities.length === 0) return null;

  const topCities = cities.slice(0, 8);
  const moreCities = cities.slice(8);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">
        Popular cities for {intentLabel} in {stateName}
      </h2>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {topCities.map((city) => (
          <li key={city.slug}>
            <Link
              href={buildCityIntentUrl(intentKey, city.slug)}
              className="block p-3 rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 hover:border-blue-200 hover:shadow-md transition-[border-color,box-shadow]"
              aria-label={`${intentLabel} guide for ${city.name}`}
            >
              {city.name}
            </Link>
          </li>
        ))}
      </ul>

      {moreCities.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-blue-100/60" />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              More {intentLabel} cities in {stateName}
            </span>
            <div className="h-px flex-1 bg-blue-100/60" />
          </div>
          <ul className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
            {moreCities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={buildCityIntentUrl(intentKey, city.slug)}
                  className="block px-2.5 py-1.5 rounded-lg border border-blue-100/40 bg-gradient-to-br from-white/70 to-blue-50/20 text-sm text-sky-700 hover:border-blue-200 hover:bg-blue-50/40 transition-[background-color,border-color]"
                  aria-label={`${intentLabel} guide for ${city.name}`}
                >
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
