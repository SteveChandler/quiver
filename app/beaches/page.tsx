import type { Metadata } from "next";
import Link from "next/link";

import { BeachIndexPhoto } from "@/app/beaches/_components/beach-index-photo";
import { getBajaFeaturedPhoto } from "@/app/beaches/_lib/get-baja-featured-photo";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { SITE_URL } from "@/lib/constants/seo";
import { buildPageMetadata } from "@/lib/seo/meta";

export const revalidate = 86400;

export const metadata: Metadata = buildPageMetadata({
  title: "Browse Surf Beaches by Region",
  description:
    "Explore surf beaches across the United States and Mexico. Find real-time conditions, calibrated forecasts, and community reviews for thousands of breaks.",
  path: "/beaches",
});

const USA_PHOTO = {
  src: "/images/seo-dioramas/beginner/socal/venice-beach-venice-ca-photo.webp",
  alt: "The shoreline and surf at Venice Beach, California",
  attributionHtml: "DXR / CC0 1.0",
};

export default async function BeachesIndexPage() {
  const mexicoPhoto = await getBajaFeaturedPhoto();

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Beaches", url: `${SITE_URL}/beaches` },
        ]}
      />
      <WebPageSchema
        name="Browse Surf Beaches by Region"
        url={`${SITE_URL}/beaches`}
        description="Explore surf beaches across the United States and Mexico with live conditions, calibrated forecasts, and community reviews."
      />

      <ZineSurface
        sectionLabel="Beaches"
        editionLabel="Coast directory"
        data-testid="beaches-zine-surface"
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
              className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/65"
            >
              <Link
                href="/"
                className="rounded-sm underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
              >
                Home
              </Link>
              <span aria-hidden>/</span>
              <span aria-current="page" className="font-bold text-[#11100D]">
                Beaches
              </span>
            </nav>
            <p className="label-black mb-5">Coast directory</p>
            <h1 className="zine-h1 zine-display max-w-4xl font-black uppercase leading-[0.88] text-[#11100D]">
              Browse surf beaches by region
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Pick a region to explore surf cities, beach conditions, and
              calibrated forecasts.
            </p>
          </header>

          <section
            aria-label="Regions"
            className="grid gap-8 lg:grid-cols-2 lg:items-stretch"
          >
            <Link
              href="/beaches/usa"
              className="group block h-full rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F4EBD8]"
            >
              <article className="torn torn-tb rot-1 flex h-full flex-col border-2 border-[#11100D] transition-transform group-hover:-translate-y-1">
                <BeachIndexPhoto
                  photo={USA_PHOTO}
                  fallbackLabel="United States coast"
                  priority
                  sizes="(min-width: 1024px) 620px, (min-width: 640px) 80vw, calc(100vw - 52px)"
                  imageClassName="transition-transform duration-500 group-hover:scale-105"
                />
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="typewriter mb-2">Atlantic / Pacific / Gulf</p>
                    <h2 className="zine-display text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
                      United States
                    </h2>
                  </div>
                  <div className="stamp-circle !h-24 !w-24 shrink-0 !text-xs">
                    <span>Coastal</span>
                    <span className="lg">16</span>
                    <span>States</span>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#11100D]/72">
                  Browse surf spots across 16 coastal states from California to
                  Maine. Over 5,000 beaches with live forecasts.
                </p>
                <span className="mt-auto inline-flex pt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#0B3A75] group-hover:underline">
                  Browse the states →
                </span>
              </article>
            </Link>

            <Link
              href="/beaches/mexico"
              className="group block h-full rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F4EBD8]"
            >
              <article className="polaroid rot-3 flex h-full flex-col transition-transform group-hover:-translate-y-1">
                <div className="tape tr" aria-hidden />
                <BeachIndexPhoto
                  photo={mexicoPhoto}
                  fallbackLabel="Baja California coast"
                  sizes="(min-width: 1024px) 440px, (min-width: 640px) 70vw, calc(100vw - 52px)"
                  imageClassName="transition-transform duration-500 group-hover:scale-105"
                />
                <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="typewriter mb-2">Southbound field notes</p>
                      <h2 className="zine-display text-3xl font-black uppercase leading-none text-[#11100D]">
                        Mexico
                      </h2>
                    </div>
                    <QuiverSticker
                      sticker="orangeMap"
                      className="-mt-7 w-16 rotate-6"
                      sizes="64px"
                    />
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-[#11100D]/72">
                    Explore surf breaks along Baja California and the Pacific
                    coast. World-class waves without the crowds.
                  </p>
                  <span className="mt-auto inline-flex pt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#0B3A75] group-hover:underline">
                    Head for Baja →
                  </span>
                </div>
              </article>
            </Link>
          </section>
        </main>
      </ZineSurface>
    </>
  );
}
