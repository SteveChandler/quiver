import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Search, Waves } from "lucide-react";
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

const QUICK_BREAKS = [
  { name: "Blacks", href: "/ca/san-diego/blacks" },
  { name: "Lower Trestles", href: "/ca/san-onofre/lower-trestles" },
  { name: "Pipeline", href: "/hi/haleiwa/pipeline" },
  { name: "Ocean Beach SD", href: "/ca/san-diego/ocean-beach" },
] as const;

const FIELD_NOTES = [
  "Pick the break you actually check",
  "Save it as your home break",
  "Get the surf call tuned to your level",
] as const;

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

  const featured = FEATURED_STATE_SLUGS.map((slug) =>
    all.find((s) => s.slug === slug),
  ).filter((entry): entry is StateEntry => Boolean(entry));

  const rest = all
    .filter((s) => !s.featured)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { featured, rest };
}

export default function FeaturesPage() {
  const { featured, rest } = buildStateGrid();

  return (
    <div className="min-h-screen overflow-hidden bg-[#F4EBD8] text-[#11100D]">
      <section className="relative px-4 pb-14 pt-24 md:pb-16 md:pt-28">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.26]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(17,16,13,0.18) 1px, transparent 0), linear-gradient(90deg, rgba(37,45,107,0.08) 1px, transparent 1px)",
            backgroundSize: "12px 12px, 72px 72px",
          }}
        />
        <div
          aria-hidden
          className="absolute right-0 top-14 hidden h-[88%] w-[46%] border-y-2 border-l-2 border-[#11100D] bg-[#252D6B] lg:block"
          style={{
            clipPath: "polygon(10% 0, 100% 0, 100% 100%, 0 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute left-0 top-20 hidden h-10 w-2/5 -rotate-[1.5deg] bg-[#F78E42] md:block"
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-end">
          <div className="space-y-8">
            <div className="max-w-4xl">
              <div className="mb-5 inline-flex rotate-[-1deg] items-center gap-2 rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.35)]">
                <Waves className="h-4 w-4" />
                Home-break finder
              </div>
              <h1 className="max-w-4xl font-heading text-5xl font-black leading-[0.92] tracking-normal text-[#11100D] sm:text-6xl md:text-7xl lg:text-8xl">
                Find your home break.
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-[#252D6B] md:text-2xl md:leading-9">
                Pick the spot you actually check, then save it. Quiver turns the
                forecast into a call for your level, updated every 3 hours.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
              <div className="relative overflow-hidden rounded-sm border-2 border-[#11100D] bg-[#F8EFD8] p-4 text-[#11100D] shadow-[7px_7px_0_rgba(17,16,13,0.32)] md:p-5">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(17,16,13,0.28) 1px, transparent 0)",
                    backgroundSize: "10px 10px",
                  }}
                />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9E5010]">
                    <Search className="h-4 w-4" />
                    Start here
                  </div>
                  <BeachSearchAutocomplete
                    source="features-home-break-search"
                    placeholder="Search Blacks, Pipeline, Ocean Beach..."
                    className="border-0 bg-transparent shadow-none [&_[cmdk-input-wrapper]]:border-b-0 [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input-wrapper]_svg]:text-[#9E5010] [&_[cmdk-input-wrapper]_svg]:opacity-100"
                    inputWrapperClassName="rounded-sm border-2 border-[#11100D] bg-[#FFF8E8] shadow-[3px_3px_0_rgba(17,16,13,0.22)]"
                    inputClassName="h-12 text-base font-semibold text-[#11100D] placeholder:text-[#11100D]/55"
                    maxResults={6}
                  />
                  <div className="mt-5 flex flex-wrap gap-2">
                    {QUICK_BREAKS.map((spot) => (
                      <Link
                        key={spot.href}
                        href={spot.href}
                        className="inline-flex items-center gap-1 rounded-full border border-[#11100D]/25 bg-[oklch(0.98_0.025_90)] px-3 py-1.5 text-sm font-bold text-[#11100D] transition-colors hover:bg-[#F78E42] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {spot.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <InlineSignupCta
                title="Save your home break."
                description="Turn that spot into your daily surf call."
                primaryButtonText="Save my home break"
                source="features-hero-save-home-break"
                ctaCopyVariant="features_home_break_v2"
                className="h-full"
                variant="zine"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {FIELD_NOTES.map((note, index) => (
                <div
                  key={note}
                  className="flex items-center gap-3 rounded-sm border-2 border-[#11100D] bg-[#F8EFD8] px-3 py-2 text-sm font-black text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.18)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F78E42] font-mono text-xs font-black text-[#11100D]">
                    {index + 1}
                  </span>
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[440px] lg:min-h-[600px]">
            <div className="relative ml-auto mt-8 max-w-[520px] rotate-[1.5deg] overflow-hidden rounded-sm border-2 border-[#11100D] bg-[#F4EBD8] p-3 shadow-[12px_14px_0_rgba(17,16,13,0.3)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm border-2 border-[#11100D]">
                <Image
                  src="/images/hero/hero-1-la-jolla.webp"
                  alt="A surfer walking past a Southern California lineup at golden hour."
                  fill
                  priority
                  sizes="(min-width: 1024px) 480px, 92vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(17,16,13,0.86),rgba(17,16,13,0))] p-5 pt-20 text-[#F4EBD8]">
                  <p className="font-handwritten text-3xl leading-none text-[#F78E42]">
                    home break
                  </p>
                  <p className="mt-2 max-w-xs text-sm font-semibold leading-6">
                    One spot, one saved call, fewer tabs open before dawn.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between px-1 pt-3 text-xs font-black uppercase tracking-[0.14em] text-[#11100D]/70">
                <span>Quiver field note</span>
                <span>279+ breaks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20">
        <div className="relative mx-auto max-w-7xl rotate-[-0.35deg] overflow-hidden rounded-sm border-2 border-[#11100D] bg-[#F8EFD8] p-5 shadow-[8px_8px_0_rgba(17,16,13,0.28)] md:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.17] mix-blend-multiply"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(17,16,13,0.32) 1px, transparent 0)",
              backgroundSize: "9px 9px",
            }}
          />
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="relative">
              <p className="inline-flex border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)]">
                Still exploring?
              </p>
              <h2 className="mt-3 font-heading text-4xl font-black leading-none text-[#11100D] md:text-5xl">
                Browse by state.
              </h2>
            </div>
            <p className="relative max-w-xl text-sm font-semibold leading-6 text-[#252D6B]">
              Search is the fastest path. State pages are here when you want to
              wander the coast.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {featured.map((state) => (
              <Link
                key={state.slug}
                href={`/beaches/usa/${state.slug}`}
                className="group relative flex items-center justify-between rounded-sm border-2 border-[#11100D] bg-[#FFF8E8] px-4 py-3 font-heading text-xl font-black text-[#11100D] shadow-[4px_4px_0_rgba(17,16,13,0.2)] transition-transform hover:-translate-y-0.5 hover:bg-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
                data-state-slug={state.slug}
              >
                {state.name}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {rest.map((state) => (
              <Link
                key={state.slug}
                href={`/beaches/usa/${state.slug}`}
                className="group relative inline-flex items-center gap-2 rounded-full border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-2 text-sm font-black text-[#11100D] transition-colors hover:bg-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D]"
                data-state-slug={state.slug}
              >
                {state.name}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <div className="pb-12" />
    </div>
  );
}
