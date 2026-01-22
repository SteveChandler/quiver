import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getStateMapBeaches } from "@/actions/beach/beach-state-actions";
import {
  getUsStateDisplayNameFromSlug,
  isValidStateSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { US_STATE_SLUGS } from "@/lib/seo/city-slug-utils";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  generateLocationSlug,
  normalizeCountry,
} from "@/lib/utils/location-slug";
import { StateMapView } from "@/components/state/state-map-view";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";

export const revalidate = 3600; // Revalidate every hour

type BeachLocationRow = {
  city: string;
  state: string;
  country?: string | null;
};

/**
 * Generate static params for all US states at build time.
 * This pre-renders state pages for faster initial loads.
 */
export async function generateStaticParams() {
  // Use the known list of US state slugs
  const stateSlugs = Object.values(US_STATE_SLUGS);
  return stateSlugs.map((state) => ({ state }));
}

export async function generateMetadata({
  params,
}: {
  params: { state: string };
}): Promise<Metadata> {
  const stateSlug = (params.state || "").toLowerCase();
  if (!isValidStateSlug(stateSlug)) {
    return buildPageMetadata({
      title: "Surf Beaches by State",
      description: "Browse surf beaches by state.",
      path: `/beaches/usa/${stateSlug}`,
    });
  }

  const stateName = getUsStateDisplayNameFromSlug(stateSlug);
  return buildPageMetadata({
    title: `Best Surf Beaches in ${stateName}`,
    description: `Explore surf cities and their top beaches across ${stateName}.`,
    path: `/beaches/usa/${stateSlug}`,
  });
}

type CityEntry = {
  citySlug: string;
  cityName: string;
};

/**
 * Get common state value variations for DB queries.
 * Handles different formats: "CA", "California", "ca"
 */
function getStateValuesFromSlug(stateSlug: string): string[] {
  const displayName = getUsStateDisplayNameFromSlug(stateSlug);
  const upper = stateSlug.toUpperCase();
  // Include common variations for robust matching
  return [upper, displayName, stateSlug];
}

export default async function UsaStatePage({
  params,
}: {
  params: { state: string };
}) {
  const stateSlug = (params.state || "").toLowerCase();
  if (!isValidStateSlug(stateSlug)) notFound();

  const stateName = getUsStateDisplayNameFromSlug(stateSlug);

  // Parallelize both data fetches for better performance
  const stateValuesForMap = getStateValuesFromSlug(stateSlug);

  const [locationsResponse, beachesResponse] = await Promise.all([
    getAllBeachLocations(),
    getStateMapBeaches({
      stateValues: stateValuesForMap,
      limit: 300,
    }),
  ]);

  if (!locationsResponse.success || !locationsResponse.data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Best surf beaches in {stateName}
        </h1>
        <p className="mt-3 text-gray-600">
          We couldn&apos;t load this state right now. Try again soon.
        </p>
      </div>
    );
  }

  const locations = locationsResponse.data as BeachLocationRow[];

  // Build city list from locations data
  const cityBySlug = new Map<string, string>();

  for (const loc of locations) {
    const country = normalizeCountry(loc.country);
    if (country !== "USA") continue;

    const locStateSlug = stateToSlug(loc.state);
    if (locStateSlug !== stateSlug) continue;

    const cityName = String(loc.city || "").trim();
    if (!cityName) continue;

    const citySlug = generateLocationSlug(cityName);
    if (!citySlug) continue;

    // Prefer the "most descriptive" name we see (handles casing/diacritics).
    const prev = cityBySlug.get(citySlug);
    if (!prev || prev.length < cityName.length) cityBySlug.set(citySlug, cityName);
  }

  const cities: CityEntry[] = [...cityBySlug.entries()]
    .map(([citySlug, cityName]) => ({ citySlug, cityName }))
    .sort((a, b) => a.cityName.localeCompare(b.cityName));

  if (cities.length === 0) notFound();

  const beaches = beachesResponse.success && beachesResponse.data ? beachesResponse.data : [];

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <header className="mb-8">
        <nav aria-label="breadcrumb" className="text-sm text-gray-600 mb-4">
          <Link href="/" className="hover:underline text-ocean-blue">
            Home
          </Link>
          <span className="mx-2 text-gray-400">›</span>
          <Link href="/beaches/usa" className="hover:underline text-ocean-blue">
            United States
          </Link>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-900 font-medium">{stateName}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Best surf beaches in {stateName}
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Explore surf cities across {stateName}. Tap a city to see a ranked list
          of beaches and local intel.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <section aria-label="Cities" className="order-2 lg:order-1">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            Surf cities in {stateName}
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <ul className="grid gap-2">
              {cities.map((c) => (
                <li key={c.citySlug}>
                  <Link
                    href={`/beaches/usa/${stateSlug}/${c.citySlug}`}
                    className="block rounded-lg px-3 py-2 text-slate-800 hover:bg-slate-50 hover:text-ocean-blue transition-colors"
                  >
                    {c.cityName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-label="Map preview" className="order-1 lg:order-2">
          <StateMapView
            beaches={beaches}
            ariaLabel={`Map of beaches in ${stateName}`}
          />
          <p className="mt-3 text-xs text-slate-500">
            Map shows a subset of beaches for fast loading. Use the city list for
            full rankings.
          </p>
        </section>
      </div>

      <IntentGuidesGrid
        locationSlug={stateSlug}
        locationName={stateName}
        locationType="state"
      />
    </div>
  );
}
