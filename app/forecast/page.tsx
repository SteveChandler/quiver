import { Metadata } from "next";
import Link from "next/link";

import {
  FORECAST_REGIONS,
  getGuideSlugForRegion,
  getForecastRegionForCity,
  hasHubGuide,
} from "@/lib/data/forecast-regions";
import {
  createEmptyRegionalSummary,
  getRegionalSummary,
} from "@/lib/utils/forecast-hub-utils";
import { resolveActiveRegion } from "@/lib/utils/resolve-active-region";
import { getCurrentUser } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { BestRightNow } from "@/components/forecast";
import { RegionalCallHero } from "@/components/forecast/regional-call-hero";
import { RegionalBestSurfWindows } from "@/components/forecast/regional-best-surf-windows";
import { SevenDayOutlook } from "@/components/forecast/seven-day-outlook";
import { OtherRegionsStrip } from "@/components/forecast/other-regions-strip";
import { RegionalGuidesStrip } from "@/components/forecast/regional-guides-strip";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { WebPageSchema } from "@/components/seo/web-page-schema";

// Reading cookies via `resolveActiveRegion` opts this route out of static ISR.
// The heavy data work (`getRegionalSummaries`) is identical across every
// region variant and gets memoized by the request-time fetch cache, so
// per-region rendering stays cheap.
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Surf Forecast - 7 Day Regional Surf Conditions",
  description:
    "Get the surf forecast for California, Hawaii, Puerto Rico and more. 7-day outlooks with best days, swell analysis, and beach-by-beach conditions.",
  path: "/forecast",
  keywords: [
    "surf forecast",
    "surf conditions",
    "7 day surf forecast",
    "regional surf forecast",
    "California surf forecast",
    "Hawaii surf forecast",
    "Puerto Rico surf forecast",
    "Florida surf forecast",
    "Oregon surf forecast",
    "New Jersey surf forecast",
    "Outer Banks surf forecast",
    "surf report",
  ],
});

/**
 * Look up the authed user's home-beach region slug by joining
 * `profiles.home_beach_id → beaches.(city,state)`. Tries city-based mapping
 * first (granular sub-regions like `san-diego`), falls back to a state-based
 * match (`region.states.includes(state)`) so authed users whose home city
 * isn't explicitly listed don't silently lose to the IP cookie path.
 * Returns null on any failure — never throws the page.
 */
async function getAuthedUserHomeRegionSlug(
  userId: string,
): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("home_beach:beaches!profiles_home_beach_id_fkey(city, state)")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const homeBeach = (
      data as {
        home_beach: { city?: string | null; state?: string | null } | null;
      }
    ).home_beach;
    if (!homeBeach) return null;

    // 1. Prefer an exact city match — surfaces the most specific sub-region
    //    (e.g. `san-diego` over the broader `southern-california`).
    if (homeBeach.city) {
      const bySlug = getForecastRegionForCity(homeBeach.city);
      if (bySlug) return bySlug;
    }

    // 2. Fall back to a state match. Prefer sub-regions (regions that declare
    //    `cities`) when multiple regions share the same state, so a California
    //    beach with an unlisted city doesn't always collapse to the SoCal
    //    parent. Tie-break by sub-region ordering in FORECAST_REGIONS.
    if (homeBeach.state) {
      const state = homeBeach.state.toLowerCase();
      const matches = Object.values(FORECAST_REGIONS).filter((r) =>
        r.states.some((s) => s.toLowerCase() === state),
      );
      if (matches.length > 0) {
        const subRegion = matches.find((r) => r.cities && r.cities.length > 0);
        return (subRegion ?? matches[0]).slug;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Forecast Hub — Anonymous Regional Oracle
 *
 * Narrows the page to ONE region (the visitor's) instead of listing all 17.
 * Region resolution: `?region=` override → authed home beach → IP cookie →
 * default `southern-california`. Below the single-region call, a compact
 * "Going elsewhere?" strip preserves browse intent and SEO mass.
 */
export default async function ForecastHubPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;

  const user = await getCurrentUser();
  const isAuthed = user !== null;
  const authedUserHomeRegionSlug = user
    ? await getAuthedUserHomeRegionSlug(user.id)
    : null;

  const region = await resolveActiveRegion({
    searchParams: resolvedSearchParams,
    authedUserHomeRegionSlug,
  });

  const allRegions = Object.values(FORECAST_REGIONS);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  const activeSummary = await getRegionalSummary(region, undefined, {
    baseUrl,
  });
  const summaries = Object.fromEntries(
    allRegions.map((forecastRegion) => [
      forecastRegion.slug,
      forecastRegion.slug === region.slug
        ? activeSummary
        : createEmptyRegionalSummary(forecastRegion),
    ]),
  );

  // Deduplicated guide cross-links (multiple regions can share a guide).
  // Prefer the active region as the mapped source for its guide slug (so the
  // featured card surfaces the visitor's region when possible and the photo
  // lookup uses the active region's summary).
  const guideLinks = (() => {
    const seen = new Set<string>();
    const ordered = [
      ...allRegions.filter((r) => r.slug === region.slug),
      ...allRegions.filter((r) => r.slug !== region.slug),
    ];
    return ordered
      .filter((r) => {
        if (!hasHubGuide(r.slug)) return false;
        const guideSlug = getGuideSlugForRegion(r.slug);
        if (seen.has(guideSlug)) return false;
        seen.add(guideSlug);
        return true;
      })
      .map((r) => ({
        region: r,
        guideSlug: getGuideSlugForRegion(r.slug),
      }));
  })();

  const browseCards = [
    {
      href: "/beaches/usa",
      title: "United States",
      desc: "All U.S. surf beaches by state",
      sticker: "creamCoastMap",
      stickerClassName: "-right-5 -top-8 w-24 -rotate-6",
    },
    {
      href: "/beaches/mexico",
      title: "Mexico",
      desc: "Baja, mainland, and island spots",
      sticker: "orangeMap",
      stickerClassName: "-right-3 -top-7 w-20 rotate-6",
    },
    {
      href: "/beginner/ca",
      title: "Beginner Spots",
      desc: "Gentle waves for learning",
      sticker: "singleFin",
      stickerClassName: "-right-5 -top-8 w-20 rotate-12",
    },
    {
      href: "/tide/san-diego",
      title: "Tide Charts",
      desc: "Tidal conditions and timing",
      sticker: "spotTideWindow",
      stickerClassName: "-right-4 -top-7 w-20 -rotate-6",
    },
  ] as const;

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Surf Forecast", url: `${baseUrl}/forecast` },
        ]}
      />

      <WebPageSchema
        name="Surf Forecast - 7 Day Regional Surf Conditions"
        url={`${baseUrl}/forecast`}
        description="Get the surf forecast for California, Hawaii, Puerto Rico and more. 7-day outlooks with best days, swell analysis, and beach-by-beach conditions."
        additionalData={{
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Quiver",
                item: baseUrl,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Surf Forecast",
                item: `${baseUrl}/forecast`,
              },
            ],
          },
          publisher: {
            "@type": "Organization",
            name: "Quiver Surf",
            url: baseUrl,
          },
        }}
      />

      <ZineSurface
        sectionLabel="Surf forecast"
        editionLabel="Updated hourly"
        data-testid="forecast-hub-zine-surface"
        paperClassName="overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        <main>
          <RegionalCallHero
            region={region}
            summary={activeSummary}
            isAuthed={isAuthed}
          />

          <RegionalBestSurfWindows
            regionName={region.name}
            recommendations={activeSummary?.bestSurfWindows}
            variant="zine"
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:items-start">
            <SevenDayOutlook
              summary={activeSummary}
              regionName={region.name}
              variant="zine"
            />

            {/* Top spots scoped to the active region via explicit coords override */}
            <section
              className="mb-10 min-w-0"
              aria-labelledby="top-spots-heading"
              data-testid="forecast-top-spots-panel"
            >
              <h2
                id="top-spots-heading"
                className="mb-4 font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
              >
                Top spots now
              </h2>
              <BestRightNow
                userCoordsOverride={{
                  lat: region.centerLat,
                  lon: region.centerLon,
                }}
                headingOverride="Top spots now"
              />
            </section>
          </div>

          <OtherRegionsStrip
            summaries={summaries}
            excludeSlug={region.slug}
            variant="zine"
          />

          {/* Regional Surf Guides — asymmetric, photo-backed, sticker rotations */}
          <RegionalGuidesStrip
            summaries={summaries}
            activeRegionSlug={region.slug}
            guideLinks={guideLinks}
            variant="zine"
          />

          {/* Browse Beaches */}
          <section className="mb-10" data-testid="forecast-browse-cards">
            <h2 className="label-black mb-5">Browse Beaches</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {browseCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group relative block min-h-36 overflow-hidden rounded-[24px_10px_28px_12px] border-2 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[3px_4px_0_rgba(17,16,13,0.2)] transition-transform hover:-translate-y-1"
                >
                  <QuiverSticker
                    sticker={card.sticker}
                    className={`pointer-events-none absolute opacity-75 drop-shadow-sm transition-transform group-hover:rotate-2 group-hover:scale-105 ${card.stickerClassName}`}
                    priority
                    sizes="96px"
                  />
                  <div className="relative z-10 pr-10">
                    <h3 className="mb-1 font-display text-lg font-black uppercase leading-tight text-[#11100D] group-hover:text-[#B56A2B]">
                      {card.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[#11100D]/68">
                      {card.desc}
                    </p>
                    <span className="mt-4 inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#B56A2B] group-hover:underline">
                      Explore →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Bottom CTA — sign-in-aware, sticker-styled, no glassmorphism */}
          <section
            className="relative mb-4 overflow-hidden rounded-2xl bg-[#1b2255] px-6 py-8 sm:px-8"
            data-testid="forecast-bottom-cta"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 4px)",
              }}
            />
            <div className="relative max-w-2xl">
              {isAuthed ? (
                <>
                  <h2 className="mb-2 font-[var(--font-heading)] text-2xl font-bold text-white sm:text-3xl">
                    Open the Oracle for your home beach
                  </h2>
                  <p className="mb-5 text-sm text-white/75 sm:text-base">
                    This is the regional call. The Oracle gives you hour-by-hour
                    windows for your spot.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-[14px_6px_16px_4px] bg-[#F78E42] px-5 py-3 font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-[#252D6B] shadow-[0_2px_0_rgba(0,0,0,0.25)] transition hover:bg-[#ffa760]"
                  >
                    Open Oracle →
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mb-2 font-[var(--font-heading)] text-2xl font-bold text-white sm:text-3xl">
                    Sign up for your local beach
                  </h2>
                  <p className="mb-5 text-sm text-white/75 sm:text-base">
                    Sign up to get this call dialed in for YOUR home beach —
                    hour by hour, with alerts when it lights up.
                  </p>
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center gap-2 rounded-[14px_6px_16px_4px] bg-[#F78E42] px-5 py-3 font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-[#252D6B] shadow-[0_2px_0_rgba(0,0,0,0.25)] transition hover:bg-[#ffa760]"
                  >
                    Sign up for YOUR home beach →
                  </Link>
                </>
              )}
            </div>
          </section>
        </main>
      </ZineSurface>

      {/* Mobile Sticky Signup Bar (self-guards for authed users) */}
      <StickySignupBar source="forecast-hub" />
    </>
  );
}
