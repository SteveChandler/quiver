import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { COVERED_REGIONS } from "@/lib/constants/coverage-areas";
import {
  US_STATE_SLUG_MAP,
  getUsStateDisplayNameFromSlug,
} from "@/lib/utils/beach-url-utils";

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Forecast App Features — Free Reports, Tide Charts & More",
  description:
    "Quiver turns raw buoy data into a clear surf call for your beach. Free surf reports, tide charts, crowd levels, best-time-to-surf windows, and session tracking for 279+ beaches. iOS, Android, and web.",
  path: "/features",
  keywords: [
    "surf forecast app",
    "best surf app",
    "free surf report app",
    "surf tracker app",
    "surf session tracker",
    "tide chart app",
    "surf conditions app",
    "ios surf app",
    "android surf app",
  ],
});

const FEATURED_STATE_SLUGS = ["ca", "fl", "hi"] as const;

type StateEntry = {
  slug: string;
  name: string;
  featured: boolean;
};

function buildStateGrid(): { featured: StateEntry[]; rest: StateEntry[] } {
  // Derive supported USA state slugs from COVERED_REGIONS (source of truth in
  // lib/constants/coverage-areas.ts). PR has a state hub; Baja Mexico does not.
  const slugs = new Set<string>();
  for (const region of COVERED_REGIONS) {
    for (const [key, slug] of Object.entries(US_STATE_SLUG_MAP)) {
      if (key.length <= 2) continue;
      if (region.includes(key)) {
        slugs.add(slug);
        break;
      }
    }
  }

  const all: StateEntry[] = [...slugs].map((slug) => ({
    slug,
    name: getUsStateDisplayNameFromSlug(slug),
    featured: (FEATURED_STATE_SLUGS as readonly string[]).includes(slug),
  }));

  const featured = FEATURED_STATE_SLUGS
    .map((slug) => all.find((s) => s.slug === slug))
    .filter((entry): entry is StateEntry => Boolean(entry));

  const rest = all
    .filter((s) => !s.featured)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { featured, rest };
}

export default function FeaturesPage() {
  const { featured, rest } = buildStateGrid();

  return (
    <div className="min-h-screen bg-[#252D6B]">
      {/* Hero with home-break search */}
      <section className="px-4 pt-20 pb-12">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6">
            Find your home break.
          </h1>
          <p className="text-xl md:text-2xl text-high mb-10 font-sans">
            Pick your spot. Get conditions explained for your level. Free,
            updated every 3 hours.
          </p>

          <div className="bg-white rounded-2xl shadow-2xl p-2 md:p-3 ring-1 ring-[#F78E42]/30">
            <BeachSearchAutocomplete
              source="features-state-finder"
              placeholder="Search for your beach…"
              className="border-none shadow-none"
              maxResults={6}
            />
          </div>

          <p className="mt-4 text-sm text-medium font-sans">
            Or browse by state below — 279+ breaks across the US coasts,
            Hawaii, and Puerto Rico.
          </p>
        </div>
      </section>

      {/* States grid */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-white text-center mb-8">
            Pick your state
          </h2>

          {/* Featured states: CA, FL, HI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {featured.map((state) => (
              <Link
                key={state.slug}
                href={`/beaches/usa/${state.slug}`}
                className="group block rounded-2xl border-2 border-[#F78E42] bg-[#2D357D] p-6 hover:bg-[#343c8a] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                data-state-slug={state.slug}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl md:text-3xl font-heading font-bold text-white">
                    {state.name}
                  </span>
                  <ArrowRight className="h-6 w-6 text-[#F78E42] group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="mt-2 text-sm text-medium font-sans">
                  Browse beaches & cities
                </p>
              </Link>
            ))}
          </div>

          {/* All other states alphabetical */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {rest.map((state) => (
              <Link
                key={state.slug}
                href={`/beaches/usa/${state.slug}`}
                className="group block rounded-xl border border-white/10 bg-[#2D357D] px-4 py-3 hover:border-[#F78E42]/50 hover:bg-[#343c8a] transition-colors"
                data-state-slug={state.slug}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-heading font-semibold text-white">
                    {state.name}
                  </span>
                  <ArrowRight className="h-4 w-4 text-medium group-hover:text-[#F78E42] transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          {/* Brief benefit lines */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-base font-sans text-high">
                Updated every 3 hours from live buoys.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-base font-sans text-high">
                Conditions explained for your level.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Inline signup CTA — home-break framing */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <InlineSignupCta
            title="Save your home spot."
            description="Get personalized alerts when it's firing — free."
            primaryButtonText="Save my home spot"
            source="features-state-finder"
            ctaCopyVariant="features_home_break_v1"
          />
        </div>
      </section>
    </div>
  );
}
