import type { Metadata } from "next";
import Link from "next/link";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { BeachIndexPhoto } from "@/app/beaches/_components/beach-index-photo";
import { getBajaFeaturedPhoto } from "@/app/beaches/_lib/get-baja-featured-photo";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  generateLocationSlug,
  normalizeCountry,
} from "@/lib/utils/location-slug";

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

function DirectoryStructuredData({ states }: { states: StateIndexEntry[] }) {
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Beaches", url: `${SITE_URL}/beaches` },
          { name: "Mexico", url: `${SITE_URL}/beaches/mexico` },
        ]}
      />
      <WebPageSchema
        name="Best Surf Beaches in Mexico"
        url={`${SITE_URL}/beaches/mexico`}
        description="Explore surf regions, cities, and beach breaks across Mexico."
      />
      <ItemListSchema
        name="Mexico Surf Regions"
        items={states.map((state, index) => ({
          name: state.stateName,
          url: `${SITE_URL}/beaches/mexico/${state.stateSlug}`,
          position: index + 1,
        }))}
      />
    </>
  );
}

export default async function MexicoStatesIndexPage() {
  const [response, bajaPhoto] = await Promise.all([
    getAllBeachLocations(),
    getBajaFeaturedPhoto(),
  ]);

  if (!response.success || !response.data) {
    return (
      <>
        <DirectoryStructuredData states={[]} />
        <ZineSurface sectionLabel="Beaches" editionLabel="Mexico coast directory">
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

  const citiesByState = new Map<
    string,
    { slug: string; name: string; cities: Set<string> }
  >();

  for (const loc of response.data as BeachLocationRow[]) {
    if (normalizeCountry(loc.country) !== "Mexico") continue;

    const stateName = String(loc.state || "").trim();
    const cityName = String(loc.city || "").trim();
    if (!stateName || !cityName) continue;

    const stateSlug = generateLocationSlug(stateName);
    if (!stateSlug) continue;

    if (!citiesByState.has(stateSlug)) {
      citiesByState.set(stateSlug, {
        slug: stateSlug,
        name: stateName,
        cities: new Set(),
      });
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

  const totalCities = states.reduce((sum, state) => sum + state.cityCount, 0);

  return (
    <>
      <DirectoryStructuredData states={states} />
      <ZineSurface
        sectionLabel="Beaches"
        editionLabel="Mexico coast directory"
        data-testid="mexico-beaches-zine-surface"
      >
        <main>
          <header className="relative mb-10 border-b-2 border-dashed border-[#11100D]/35 pb-8">
            <QuiverSticker
              sticker="orangeMap"
              className="absolute -right-1 -top-7 hidden w-24 rotate-6 opacity-80 sm:block"
              sizes="96px"
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
                Mexico
              </span>
            </nav>
            <p className="label-black mb-5">Pacific field directory</p>
            <h1 className="zine-h1 zine-display max-w-4xl font-black uppercase leading-[0.88] text-[#11100D]">
              Best surf beaches in Mexico
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Pick a state to explore top surf cities and their best beaches
              across Mexico.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>
                {states.length} {states.length === 1 ? "state" : "states"}
              </span>
              <span aria-hidden>/</span>
              <span>
                {totalCities} {totalCities === 1 ? "city" : "cities"}
              </span>
            </div>
          </header>

          <section aria-label="States" className="space-y-10">
            {states.map((state, index) => {
              const isBaja = state.stateSlug.startsWith("baja-california");

              return (
                <Link
                  key={state.stateSlug}
                  href={`/beaches/mexico/${state.stateSlug}`}
                  className={`group block rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F4EBD8] ${index % 2 === 0 ? "rot-1" : "rot-2"}`}
                >
                  <article className="torn torn-tb grid gap-6 border-2 border-[#11100D] transition-transform group-hover:-translate-y-1 md:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)] md:items-center md:gap-8">
                    <div className="relative">
                      <div className="tape tl" aria-hidden />
                      <BeachIndexPhoto
                        photo={isBaja ? bajaPhoto : null}
                        fallbackLabel={`${state.stateName} coast`}
                        priority={index === 0}
                        sizes="(min-width: 1024px) 650px, (min-width: 768px) 58vw, calc(100vw - 72px)"
                        imageClassName="transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="typewriter mb-3">State field guide</p>
                      <h2 className="zine-display text-4xl font-black uppercase leading-[0.92] text-[#11100D] sm:text-5xl">
                        {state.stateName}
                      </h2>
                      <div className="mt-5 inline-flex bg-[#11100D] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#F4EBD8]">
                        {state.cityCount} {state.cityCount === 1 ? "city" : "cities"}
                      </div>
                      <p className="mt-5 text-base leading-relaxed text-[#11100D]/72">
                        Explore surf spots and ranked beaches across {state.stateName}.
                      </p>
                      <span className="mt-6 inline-flex font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#0B3A75] group-hover:underline">
                        Explore the coastline →
                      </span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </section>

          <aside className="notebook mt-12 border-l-4 border-[#0B3A75] py-4 pl-6 pr-4">
            <p className="font-handwritten text-2xl leading-tight text-[#11100D]">
              The directory grows coast by coast. Each new state will slot into
              the same photo-led field-guide format.
            </p>
          </aside>
        </main>
      </ZineSurface>
    </>
  );
}
