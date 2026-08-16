import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import {
  getUsStateDisplayNameFromSlug,
  isValidStateSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { buildPageMetadata } from "@/lib/seo/meta";
import { normalizeCountry } from "@/lib/utils/location-slug";
import { OceanBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Beaches by State",
  description:
    "Browse surf beaches by US state. Find live conditions, calibrated forecasts, and community reviews for breaks from California to Hawaii.",
  path: "/beaches/usa",
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

export default async function UsaStatesIndexPage() {
  const response = await getAllBeachLocations();

  if (!response.success || !response.data) {
    return (
      <OceanBackground variant="minimal" showWaves={false}>
        <div className="container mx-auto px-4 py-12 max-w-5xl text-center">
          <h1 className="text-3xl font-bold text-gray-900">Browse by state</h1>
          <p className="mt-3 text-gray-600">
            We couldn&apos;t load the state directory right now. Try again soon.
          </p>
        </div>
      </OceanBackground>
    );
  }

  const citiesByState = new Map<string, Set<string>>();

  for (const loc of response.data as BeachLocationRow[]) {
    const country = normalizeCountry(loc.country);
    if (country !== "USA") continue;

    const stateSlug = stateToSlug(loc.state);
    const cityName = String(loc.city || "").trim();
    if (!stateSlug || !isValidStateSlug(stateSlug) || !cityName) continue;

    if (!citiesByState.has(stateSlug)) citiesByState.set(stateSlug, new Set());
    citiesByState.get(stateSlug)!.add(cityName);
  }

  const states: StateIndexEntry[] = [...citiesByState.entries()]
    .map(([stateSlug, cities]) => ({
      stateSlug,
      stateName: getUsStateDisplayNameFromSlug(stateSlug),
      cityCount: cities.size,
    }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName));

  const totalCities = states.reduce((sum, s) => sum + s.cityCount, 0);

  return (
    <OceanBackground variant="ocean" showWaves animated={false}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <ScrollReveal variant="fadeUp">
          <header className="text-center mb-12">
            <nav
              aria-label="breadcrumb"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4"
            >
              <Link href="/" className="hover:underline text-ocean-blue">
                Home
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-medium">United States</span>
            </nav>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              Best surf beaches by state
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto mb-4">
              Pick a state to explore top surf cities and their best beaches —
              real-time conditions, calibrated forecasts, and community reviews.
            </p>
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <AnimatedCounter value={states.length} duration={600} /> states
              </span>
              <span className="text-gray-400">|</span>
              <span>
                <AnimatedCounter value={totalCities} duration={800} suffix="+" />{" "}
                cities
              </span>
            </div>
          </header>
        </ScrollReveal>

        {/* State Cards Grid */}
        <section aria-label="US states">
        <ScrollReveal
          variant="fadeUp"
          stagger
          staggerDelay={60}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {states.map((s) => (
            <Link
              key={s.stateSlug}
              href={`/beaches/usa/${s.stateSlug}`}
              className="group rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm p-5 transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-lg hover:border-sky-300 hover:bg-gradient-to-br hover:from-sky-50/60 hover:to-blue-50/40"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                  {s.stateName}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 text-sky-700 px-2.5 py-0.5 text-xs font-medium">
                    <AnimatedCounter value={s.cityCount} duration={500} />{" "}
                    {s.cityCount === 1 ? "city" : "cities"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-sky-500 opacity-0 -translate-x-1 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Explore surf spots and ranked beaches across {s.stateName}.
              </p>
            </Link>
          ))}
        </ScrollReveal>
        </section>
      </div>
    </OceanBackground>
  );
}
