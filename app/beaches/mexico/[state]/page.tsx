import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { generateLocationSlug } from "@/lib/utils/location-slug";

export const revalidate = 3600; // 1 hour — beach location data changes infrequently

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

// NOTE: generateStaticParams removed — this page uses force-dynamic.
// Pages are rendered on-demand via ISR.

export async function generateMetadata(
  props: {
    params: Promise<{ state: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const stateSlug = (params.state || "").toLowerCase();

  // Try to find the display name from data
  const response = await getAllBeachLocations();
  let stateName = stateSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (response.success && response.data) {
    for (const loc of response.data as BeachLocationRow[]) {
      if (!normalizeCountryToMexico(loc.country)) continue;
      const locStateSlug = generateLocationSlug(loc.state);
      if (locStateSlug === stateSlug) {
        stateName = loc.state;
        break;
      }
    }
  }

  return buildPageMetadata({
    title: `Best Surf Beaches in ${stateName}, Mexico`,
    description: `Explore surf cities and their top beaches across ${stateName}, Mexico.`,
    path: `/beaches/mexico/${stateSlug}`,
  });
}

type CityEntry = {
  citySlug: string;
  cityName: string;
};

const BAJA_CALIFORNIA_FEATURED_LINKS = [
  {
    href: "/mexico/baja-california/rosarito",
    label: "Rosarito surf guide",
  },
  {
    href: "/mexico/baja-california/rosarito/alfonsos",
    label: "Alfonsos surf report",
  },
  {
    href: "/mexico/baja-california/rosarito/el-morro-point-k375",
    label: "El Morro Point surf report",
  },
] as const;

function FeaturedBajaLinks({ stateSlug }: { stateSlug: string }) {
  if (stateSlug !== "baja-california") return null;

  return (
    <section aria-labelledby="featured-baja-links" className="mt-10">
      <h2
        id="featured-baja-links"
        className="text-xl font-semibold text-slate-900 mb-3"
      >
        Featured Baja surf guides
      </h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {BAJA_CALIFORNIA_FEATURED_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block h-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition-colors hover:border-ocean-blue hover:text-ocean-blue"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function MexicoStatePage(
  props: {
    params: Promise<{ state: string }>;
  }
) {
  const params = await props.params;
  const stateSlug = (params.state || "").toLowerCase();

  const response = await getAllBeachLocations();

  if (!response.success || !response.data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Surf beaches in Mexico
        </h1>
        <p className="mt-3 text-gray-600">
          We couldn&apos;t load this state right now. Try again soon.
        </p>
        <FeaturedBajaLinks stateSlug={stateSlug} />
      </div>
    );
  }

  const locations = response.data as BeachLocationRow[];

  // Find the state name and build city list
  let stateName = "";
  const cityBySlug = new Map<string, string>();

  for (const loc of locations) {
    if (!normalizeCountryToMexico(loc.country)) continue;

    const locStateSlug = generateLocationSlug(loc.state);
    if (locStateSlug !== stateSlug) continue;

    // Capture the state name
    if (!stateName) stateName = loc.state;

    const cityName = String(loc.city || "").trim();
    if (!cityName) continue;

    const citySlug = generateLocationSlug(cityName);
    if (!citySlug) continue;

    // Prefer the "most descriptive" name we see
    const prev = cityBySlug.get(citySlug);
    if (!prev || prev.length < cityName.length) cityBySlug.set(citySlug, cityName);
  }

  if (!stateName || cityBySlug.size === 0) notFound();

  const cities: CityEntry[] = [...cityBySlug.entries()]
    .map(([citySlug, cityName]) => ({ citySlug, cityName }))
    .sort((a, b) => a.cityName.localeCompare(b.cityName));

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <header className="mb-8">
        <nav aria-label="breadcrumb" className="text-sm text-gray-600 mb-4">
          <Link href="/" className="hover:underline text-ocean-blue">
            Home
          </Link>
          <span className="mx-2 text-gray-400">›</span>
          <Link href="/beaches/mexico" className="hover:underline text-ocean-blue">
            Mexico
          </Link>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-900 font-medium">{stateName}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Best surf beaches in {stateName}, Mexico
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Explore surf cities across {stateName}. Tap a city to see a ranked list
          of beaches and local intel.
        </p>
      </header>

      <section aria-label="Cities">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          Surf cities in {stateName}
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4 max-w-md">
          <ul className="grid gap-2">
            {cities.map((c) => (
              <li key={c.citySlug}>
                <Link
                  href={`/mexico/${stateSlug}/${c.citySlug}`}
                  className="block rounded-lg px-3 py-2 text-slate-800 hover:bg-slate-50 hover:text-ocean-blue transition-colors"
                >
                  {c.cityName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FeaturedBajaLinks stateSlug={stateSlug} />
    </div>
  );
}
