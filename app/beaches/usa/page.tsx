import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import {
  BeachIndexPhoto,
  type BeachIndexPhotoData,
} from "@/app/beaches/_components/beach-index-photo";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  getUsStateDisplayNameFromSlug,
  isValidStateSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { normalizeCountry } from "@/lib/utils/location-slug";

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

const STATE_PHOTO_ANCHORS: Partial<Record<string, BeachIndexPhotoData>> = {
  ca: {
    src: "/images/seo-dioramas/beginner/socal/venice-beach-venice-ca-photo.webp",
    alt: "Venice Beach and the Southern California coastline",
    attributionHtml: "DXR / CC0 1.0",
  },
  fl: {
    src: "/images/seo-scenes/cocoa-beach-pier.webp",
    alt: "Surf beside Cocoa Beach Pier in Florida",
  },
  nc: {
    src: "/images/seo-scenes/north-carolina-carolina-beach.jpg",
    alt: "Carolina Beach on the North Carolina coast",
  },
  ny: {
    src: "/images/seo-dioramas/beginner/long-island/ditch-plains-montauk-ny-photo.webp",
    alt: "A surfer at Ditch Plains in Montauk, New York",
    attributionHtml: "dpstyles™ / CC BY 2.0",
  },
  or: {
    src: "/images/On_the_Beach_at_Bandon.webp",
    alt: "The beach and sea stacks at Bandon, Oregon",
  },
  pr: {
    src: "/images/seo-scenes/rincon-domes.webp",
    alt: "The surf coastline near Domes in Rincón, Puerto Rico",
  },
  wa: {
    src: "/images/seo-scenes/westport-jetty.webp",
    alt: "The jetty and surf at Westport, Washington",
  },
};

const STATE_BADGES: Partial<Record<string, { src: string; alt: string }>> = {
  ca: {
    src: "/images/beach-badges/huntington-beach.png",
    alt: "Huntington Beach crest",
  },
  fl: {
    src: "/images/beach-badges/ponce-inlet.png",
    alt: "Ponce Inlet crest",
  },
};

const CARD_ROTATIONS = ["rot-1", "rot-2", "rot-3", "rot-4"] as const;

function DirectoryStructuredData({ states }: { states: StateIndexEntry[] }) {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Beaches", url: `${SITE_URL}/beaches` },
          { name: "USA", url: `${SITE_URL}/beaches/usa` },
        ]}
      />
      <WebPageSchema
        name="Best Surf Beaches by State"
        url={`${SITE_URL}/beaches/usa`}
        description="Browse surf beaches by U.S. state with live conditions, calibrated forecasts, and community reviews."
      />
      <ItemListSchema
        name="U.S. Surf States"
        items={states.map((state, index) => {
          const imageSrc = STATE_PHOTO_ANCHORS[state.stateSlug]?.src;

          return {
            name: state.stateName,
            url: `${SITE_URL}/beaches/usa/${state.stateSlug}`,
            position: index + 1,
            image: imageSrc ? `${SITE_URL}${imageSrc}` : undefined,
          };
        })}
      />
    </>
  );
}

export default async function UsaStatesIndexPage() {
  const response = await getAllBeachLocations();

  if (!response.success || !response.data) {
    return (
      <>
        <DirectoryStructuredData states={[]} />
        <ZineSurface sectionLabel="Beaches" editionLabel="U.S. coast directory">
          <main className="py-10 text-center">
            <p className="label-black mb-5">Directory unavailable</p>
            <h1 className="zine-display text-4xl font-black uppercase text-[#11100D]">
              Browse by state
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[#11100D]/72">
              We couldn&apos;t load the state directory right now. Try again soon.
            </p>
          </main>
        </ZineSurface>
      </>
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

  const totalCities = states.reduce((sum, state) => sum + state.cityCount, 0);

  return (
    <>
      <DirectoryStructuredData states={states} />
      <ZineSurface
        sectionLabel="Beaches"
        editionLabel="U.S. coast directory"
        data-testid="usa-beaches-zine-surface"
      >
        <main>
          <header className="relative mb-10 border-b-2 border-dashed border-[#11100D]/35 pb-8">
            <QuiverSticker
              sticker="creamCoastMap"
              className="absolute -right-4 -top-7 hidden w-36 rotate-6 opacity-70 md:block"
              sizes="144px"
              priority
            />
            <nav
              aria-label="breadcrumb"
              className="mb-5 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/65"
            >
              <Link
                href="/"
                className="rounded-sm underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
              >
                Home
              </Link>
              <span aria-hidden>/</span>
              <Link
                href="/beaches"
                className="rounded-sm underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
              >
                Beaches
              </Link>
              <span aria-hidden>/</span>
              <span aria-current="page" className="font-bold text-[#11100D]">
                United States
              </span>
            </nav>
            <p className="label-black mb-5">Atlantic / Pacific / Gulf</p>
            <h1 className="zine-h1 zine-display max-w-4xl font-black uppercase leading-[0.88] text-[#11100D]">
              Best surf beaches by state
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Pick a state to explore top surf cities and their best beaches —
              real-time conditions, calibrated forecasts, and community reviews.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>{states.length} states</span>
              <span aria-hidden>/</span>
              <span>{totalCities}+ cities</span>
            </div>
          </header>

          <section aria-label="US states">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {states.map((state, index) => {
                const photo = STATE_PHOTO_ANCHORS[state.stateSlug] ?? null;
                const badge = STATE_BADGES[state.stateSlug];

                return (
                  <Link
                    key={state.stateSlug}
                    href={`/beaches/usa/${state.stateSlug}`}
                    className={`group block rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F4EBD8] ${CARD_ROTATIONS[index % CARD_ROTATIONS.length]}`}
                  >
                    <article className="torn h-full border-2 border-[#11100D] transition-transform group-hover:-translate-y-1">
                      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
                        <div className="relative self-start">
                          {photo ? (
                            <BeachIndexPhoto
                              photo={photo}
                              fallbackLabel={`${state.stateName} coast`}
                              sizes="96px"
                              showAttribution={Boolean(photo.attributionHtml)}
                            />
                          ) : (
                            <div
                              role="img"
                              aria-label={`${state.stateName} state stamp`}
                              className="stamp-circle !h-20 !w-20 !text-[10px] sm:!h-24 sm:!w-24"
                            >
                              <span>Surf</span>
                              <span className="lg">
                                {state.stateSlug.toUpperCase()}
                              </span>
                              <span>Guide</span>
                            </div>
                          )}
                          {badge ? (
                            <Image
                              src={badge.src}
                              alt={badge.alt}
                              width={48}
                              height={48}
                              sizes="48px"
                              className="absolute -bottom-3 -right-2 h-12 w-12 rotate-6 drop-shadow-md"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 py-1">
                          <div className="flex items-start justify-between gap-3">
                            <h2 className="zine-display text-xl font-black uppercase leading-none text-[#11100D] sm:text-2xl">
                              {state.stateName}
                            </h2>
                            <span className="shrink-0 bg-[#11100D] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#F4EBD8]">
                              {state.cityCount} {state.cityCount === 1 ? "city" : "cities"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-[#11100D]/70">
                            Explore surf spots and ranked beaches across {state.stateName}.
                          </p>
                          <span className="mt-4 inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B3A75] group-hover:underline">
                            Open field guide →
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
