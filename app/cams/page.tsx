import { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { CAM_REGIONS } from "@/lib/data/cam-regions";
import { getIndexableSurfCamPages } from "@/lib/seo/funnel-pages";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { LiveCamSchema } from "@/components/seo/live-cam-schema";
import { CamGrid } from "@/components/cams/cam-grid";
import { CamsHeroContactSheet } from "@/components/cams/cams-hero-contact-sheet";
import { CamsLandingNav } from "@/components/cams/cams-landing-nav";
import { CamsShareButton } from "@/components/cams/cams-share-button";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { Button } from "@/components/ui/button";
import { ZineSurface } from "@/components/zine";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { WebPageSchema } from "@/components/seo/web-page-schema";

export const revalidate = 86400;

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export async function generateMetadata(): Promise<Metadata> {
  const beaches = await getBeachesWithCameras();
  const camCount = beaches.length;
  const stateCount = new Set(beaches.map((b) => b.state)).size;

  return buildPageMetadata({
    title: `Live Surf Cams — ${camCount}+ Cameras Across ${stateCount} States`,
    description: `Watch ${camCount}+ live surf cams across ${stateCount} states. California, Hawaii, Florida, Oregon, and more. Updated 24/7 with live conditions.`,
    path: "/cams",
    image: "/api/og/cams",
    keywords: [
      "live surf cam",
      "surf cam live",
      "surf webcam",
      "beach cam",
      "live beach camera",
      "California surf cam",
      "Hawaii surf cam",
      "Oregon surf cam",
      "Florida surf cam",
    ],
  });
}

export default async function CamsHubPage() {
  const beaches = await getBeachesWithCameras();
  const camCount = beaches.length;
  const stateCount = new Set(beaches.map((b) => b.state)).size;
  // Curated /surf-cams pages own the regional cam queries, so the hub must
  // link every one of them or they are orphaned from the cams family.
  const camGuidePages = getIndexableSurfCamPages();

  // Count cameras per region for the quick-nav
  const regionCounts = new Map<string, number>();
  for (const beach of beaches) {
    regionCounts.set(
      beach.regionSlug,
      (regionCounts.get(beach.regionSlug) ?? 0) + 1,
    );
  }

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Live Surf Cams", url: `${baseUrl}/cams` },
        ]}
      />
      {/* WebPage JSON-LD with dateModified signals content freshness to Google */}
      <WebPageSchema
        name={`Live Surf Cams — ${camCount}+ Cameras Across ${stateCount} States`}
        url={`${baseUrl}/cams`}
      />
      {/* VideoObject schema for a representative sample of cams (capped at 20) */}
      {beaches.slice(0, 20).map((beach) => (
        <LiveCamSchema
          key={beach.slug}
          beachName={beach.name}
          cameraUrl={beach.camera_url}
          pageUrl={buildBeachUrl({
            slug: beach.slug,
            city: beach.city,
            state: beach.state,
          })}
        />
      ))}

      <CamsLandingNav />
      <ZineSurface
        sectionLabel="Live cams"
        editionLabel={`${camCount} cams · ${stateCount} states`}
        showMasthead={false}
        data-testid="cams-zine-surface"
      >
        <main>
          {/* Visible breadcrumbs */}
          <Breadcrumb className="mb-8">
            <BreadcrumbList className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/55">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="hover:text-[#0B3A75]">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-[#11100D]/35" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[#11100D]">
                  Live Surf Cams
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Hero */}
          <header className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.8fr)] lg:items-start">
            <div>
              <p className="typewriter mb-4">
                {camCount} live cameras · {stateCount} states
              </p>
              <h1 className="zine-h1 max-w-4xl font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                Live Surf Cams
              </h1>
              <p className="mt-5 max-w-2xl font-sans text-lg leading-8 text-[#11100D]/75 sm:text-xl">
                Watch real surf cams by region, then open the beach forecast
                when you need the full call.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <CamsShareButton />
                <Link
                  href="mailto:support@quiversurf.app?subject=Surf%20cam%20suggestion"
                  className="inline-flex min-h-10 items-center justify-center rounded-[12px_5px_14px_5px] border-2 border-[#11100D] bg-[#F4EBD8] px-4 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.16)] transition-transform hover:-translate-y-0.5"
                >
                  Suggest a cam
                </Link>
              </div>
            </div>
            <CamsHeroContactSheet
              beaches={beaches}
              label="Featured live cam previews"
            />
          </header>

          {/* Quick region navigation */}
          <div className="my-10 border-y-2 border-[#11100D] py-4">
            <nav
              aria-label="Cam regions"
              className="flex flex-wrap justify-start gap-2"
            >
              {CAM_REGIONS.map((region) => {
                const count = regionCounts.get(region.slug) ?? 0;
                if (count === 0) return null;
                return (
                  <Link
                    key={region.slug}
                    href={`#${region.slug}`}
                    className="group inline-flex items-center gap-1.5 rounded-[10px_4px_12px_5px] border-2 border-[#11100D] bg-[#FBF6E8] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.14)] transition-transform hover:-translate-y-0.5 hover:bg-[#F0E5CC]"
                  >
                    {region.name}
                    <span className="text-[#0B3A75]/70 group-hover:text-[#0B3A75]">
                      ({count})
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Camera grid grouped by region */}
          <section className="pb-16">
            <CamGrid beaches={beaches} groupByRegion />
          </section>

          {/* Curated cam guides by area */}
          {camGuidePages.length > 0 ? (
            <section className="pb-16" aria-labelledby="cam-guides-heading">
              <h2 id="cam-guides-heading" className="label-black mb-5 w-fit">
                Surf Cam Guides by Area
              </h2>
              <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                data-testid="cam-guide-links"
              >
                {camGuidePages.map((page) => (
                  <Link
                    key={page.path}
                    href={page.path}
                    className="torn torn-tb group block min-h-40 border-2 border-[#11100D] bg-[#FBF6E8] p-5 text-[#11100D] transition-transform hover:-translate-y-1"
                  >
                    <h3 className="mb-2 font-[var(--font-zine-display)] text-2xl uppercase leading-none tracking-normal text-[#11100D] transition-colors group-hover:text-[#0B3A75]">
                      {page.locationName} surf cams
                    </h3>
                    <p className="font-sans text-sm leading-6 text-[#11100D]/70">
                      {page.metaDescription}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Inline Signup CTA */}
          <section className="mx-auto max-w-3xl pb-12">
            <InlineSignupCta
              title="Watch a cam? Track the break."
              description="The cam tells you what's happening now. We tell you when to paddle out tomorrow — free."
              primaryButtonText="Pick your home beach"
              source="cams-hub-inline"
              ctaCopyVariant="cams_hub_v1"
              variant="zine"
            />
          </section>

          {/* More Surf Tools */}
          <section className="pb-12">
            <h2 className="label-black mb-5 w-fit">More Surf Tools</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  href: "/forecast",
                  title: "7-Day Forecast",
                  desc: "Regional surf forecasts with swell and wind analysis",
                },
                {
                  href: "/beaches/usa",
                  title: "Browse All Beaches",
                  desc: "Find surf spots by state and city",
                },
                {
                  href: "/best-time-to-surf",
                  title: "Best Time to Surf",
                  desc: "Month-by-month surf season guides",
                },
              ].map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="torn torn-tb group block min-h-40 border-2 border-[#11100D] bg-[#F0E5CC] p-5 text-[#11100D] transition-transform hover:-translate-y-1"
                >
                  <h3 className="mb-2 font-[var(--font-zine-display)] text-2xl uppercase leading-none tracking-normal text-[#11100D] transition-colors group-hover:text-[#0B3A75]">
                    {card.title}
                  </h3>
                  <p className="font-sans text-sm leading-6 text-[#11100D]/70">
                    {card.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="pb-4">
            <div className="mx-auto max-w-3xl border-2 border-[#11100D] bg-[#252D6B] p-8 text-center text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.28)]">
              <h2 className="font-[var(--font-zine-display)] text-4xl uppercase leading-none tracking-normal">
                Know a cam we&apos;re missing?
              </h2>
              <p className="mt-3 font-sans text-[#F4EBD8]/75">
                Help us grow the largest surf cam directory.
              </p>
              <Button
                asChild
                className="mt-5 rounded-[14px_6px_16px_6px] bg-[#F78E42] font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.35)] hover:bg-[#FDB84B] hover:text-[#11100D]"
              >
                <a href="mailto:support@quiversurf.app?subject=Surf%20cam%20suggestion">
                  Suggest a cam
                  <Mail className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            </div>
          </section>
        </main>
      </ZineSurface>
      <StickySignupBar
        source="cams-hub"
        ctaText="Get Cam Alerts"
        supportingText="Get notified when conditions are firing"
      />
    </>
  );
}
