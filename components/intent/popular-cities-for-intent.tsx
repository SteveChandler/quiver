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
 */
export function PopularCitiesForIntent({
  intentKey,
  intentLabel,
  stateName,
  cities,
}: PopularCitiesForIntentProps) {
  if (cities.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">
        Popular cities for {intentLabel} in {stateName}
      </h2>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {cities.map((city) => (
          <li key={city.slug}>
            <Link
              href={buildCityIntentUrl(intentKey, city.slug)}
              className="block p-3 rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 hover:border-blue-200 hover:shadow-md transition-all"
              aria-label={`${intentLabel} guide for ${city.name}`}
            >
              {city.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
