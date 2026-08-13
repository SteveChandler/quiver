import Link from "next/link";
import type { TopCityInState } from "@/actions/beach/beach-location-actions";

interface SiblingCitiesSectionProps {
  currentCity: string;
  stateSlug: string;
  stateName: string;
  stateUrl: string;
  cities: TopCityInState[];
}

export function SiblingCitiesSection({
  currentCity,
  stateSlug,
  stateName,
  stateUrl,
  cities,
}: SiblingCitiesSectionProps) {
  // Filter out current city and limit to 8
  const siblingCities = cities
    .filter((c) => c.name !== currentCity)
    .slice(0, 8);

  if (siblingCities.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        More Surf Cities in{" "}
        <Link href={stateUrl} className="text-ocean-blue hover:underline">
          {stateName}
        </Link>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {siblingCities.map((city) => (
          <Link
            key={city.slug}
            href={`/${stateSlug}/${city.slug}`}
            className="group flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 transition-[border-color,box-shadow] hover:border-sky-300 hover:shadow-sm"
          >
            <span className="font-medium text-gray-900 text-sm group-hover:text-sky-700">
              {city.name}
            </span>
            <span className="text-xs text-gray-500">
              {city.beachCount} {city.beachCount === 1 ? "beach" : "beaches"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
