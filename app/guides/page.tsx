/**
 * Surf Guides - Index Page
 *
 * Lists all regional surf guides with links to each.
 * URL: /guides
 */

import Link from "next/link";
import type { Metadata } from "next";

import { HUB_REGION_SLUGS, getHubRegion } from "@/lib/data/hub-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuiverSticker, ZineSurface } from "@/components/zine";

export const revalidate = 86400;

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Surf Guides | Quiver",
    description:
      "Regional surf guides for Southern California, Hawaii, Florida, the Outer Banks, and more: wave types, seasonal windows, water temps, and the best breaks.",
    path: "/guides",
    keywords: [
      "surf guides",
      "regional surf guide",
      "surf spots by region",
      "where to surf",
      "surf travel guide",
    ],
  });
}

export default function GuidesIndexPage() {
  const regions = HUB_REGION_SLUGS.map((slug) => getHubRegion(slug)).filter(
    (r) => r !== null
  );

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Surf Guides", url: `${SITE_ORIGIN}/guides` },
        ]}
      />

      <ZineSurface
        sectionLabel="Surf guides"
        editionLabel="Regional field notes"
        data-testid="guides-zine-surface"
      >
        <main>
          <ScrollReveal>
            <header className="relative">
              <QuiverSticker
                sticker="orangeMap"
                className="absolute -top-6 right-2 hidden w-20 rotate-6 opacity-90 sm:block"
              />
              <p className="label-black mb-5">Surf guides</p>
              <h1 className="zine-h1 font-heading font-black uppercase leading-[0.9] tracking-normal text-[#11100D]">
                Surf Guides
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
                Regional breakdowns covering wave types, seasonal windows, water
                temps, wetsuit needs, and the best breaks in each area.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
                <span>{regions.length} regions</span>
                <span aria-hidden>/</span>
                <span>wave types</span>
                <span aria-hidden>/</span>
                <span>seasonal windows</span>
              </div>
            </header>
          </ScrollReveal>

          <section className="mt-12" aria-labelledby="regions-heading">
            <ScrollReveal>
              <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
                <div>
                  <p className="typewriter mb-2">Pick a coast</p>
                  <h2
                    id="regions-heading"
                    className="font-heading text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
                  >
                    Regions covered
                  </h2>
                </div>
                <QuiverSticker
                  sticker="creamCoastMap"
                  className="hidden w-16 -rotate-3 drop-shadow-sm sm:block"
                />
              </div>
            </ScrollReveal>

            <div className="grid gap-5 sm:grid-cols-2">
              {regions.map((region, index) => (
                <ScrollReveal key={region.slug} delay={index * 50}>
                  <Link
                    href={`/guides/surfing-${region.slug}`}
                    className="group block min-h-28 border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[2px_3px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
                  >
                    <h2 className="font-heading text-xl font-black uppercase leading-tight text-[#11100D] transition-colors group-hover:text-[#B56A2B]">
                      {region.name}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#11100D]/70">
                      {region.description.split("\n")[0]}
                    </p>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
