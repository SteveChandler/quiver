import type { Metadata } from "next";
import Link from "next/link";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { generateLocationSlug } from "@/lib/utils/location-slug";
import { buildPageMetadata } from "@/lib/seo/meta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Beaches in Mexico",
  description:
    "Browse surf beaches across Mexico. Explore top surf regions and their best beaches.",
  path: "/beaches/mexico",
});

type StateIndexEntry = {
  stateSlug: string;
  stateName: string;
  cityCount: number;
};

type BeachLocationRow = {
  city: string;
  state: string;
  country?: string | null;
};

function normalizeCountryToMexico(country: string | null | undefined): boolean {
  if (!country) return false;
  const normalized = country.trim().toLowerCase();
  return normalized === "mexico" || normalized === "mx" || normalized === "mex";
}

export default async function MexicoStatesIndexPage() {
  const response = await getAllBeachLocations();

  if (!response.success || !response.data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-3xl font-bold text-gray-900">Browse by state</h1>
        <p className="mt-3 text-gray-600">
          We couldn&apos;t load the state directory right now. Try again soon.
        </p>
      </div>
    );
  }

  const citiesByState = new Map<string, { slug: string; name: string; cities: Set<string> }>();

  for (const loc of response.data as BeachLocationRow[]) {
    if (!normalizeCountryToMexico(loc.country)) continue;

    const stateName = String(loc.state || "").trim();
    const cityName = String(loc.city || "").trim();
    if (!stateName || !cityName) continue;

    const stateSlug = generateLocationSlug(stateName);
    if (!stateSlug) continue;

    if (!citiesByState.has(stateSlug)) {
      citiesByState.set(stateSlug, { slug: stateSlug, name: stateName, cities: new Set() });
    }
    citiesByState.get(stateSlug)!.cities.add(cityName);
  }

  const states: StateIndexEntry[] = [...citiesByState.values()]
    .map(({ slug, name, cities }) => ({
      stateSlug: slug,
      stateName: name,
      cityCount: cities.size,
    }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName));

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <header className="mb-8">
        <nav aria-label="breadcrumb" className="text-sm text-gray-600 mb-4">
          <Link href="/" className="hover:underline text-ocean-blue">
            Home
          </Link>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-900 font-medium">Mexico</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Best surf beaches in Mexico
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Pick a state to explore top surf cities and their best beaches across Mexico.
        </p>
      </header>

      <section aria-label="States" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {states.map((s) => (
          <Link
            key={s.stateSlug}
            href={`/beaches/mexico/${s.stateSlug}`}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {s.stateName}
              </h2>
              <span className="text-sm text-slate-600">
                {s.cityCount} {s.cityCount === 1 ? "city" : "cities"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Explore surf spots and ranked beaches across {s.stateName}.
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
