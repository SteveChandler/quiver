import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { CAM_REGIONS, getCamRegionBySlug } from "@/lib/data/cam-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
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

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ region: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { region: regionSlug } = await params;
  const region = getCamRegionBySlug(regionSlug);
  if (!region) return {};

  const beaches = await getBeachesWithCameras();
  const regionBeaches = beaches.filter((b) => b.regionSlug === regionSlug);
  const camCount = regionBeaches.length;

  return buildPageMetadata({
    title: `Live Surf Cams in ${region.name} — ${camCount} Cameras`,
    description: `Watch ${camCount} live surf cams in ${region.name}. ${region.description}`,
    path: `/cams/${regionSlug}`,
    image: `/api/og/cams?region=${encodeURIComponent(regionSlug)}&name=${encodeURIComponent(region.name)}`,
    keywords: [
      `${region.name} surf cam`,
      `${region.name} beach cam`,
      `live surf cam ${region.name}`,
      "surf cam live",
      "surf webcam",
      "beach camera",
    ],
  });
}

export default async function CamsRegionPage({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const region = getCamRegionBySlug(regionSlug);
  if (!region) notFound();

  const allBeaches = await getBeachesWithCameras();
  const regionBeaches = allBeaches.filter((b) => b.regionSlug === regionSlug);

  if (regionBeaches.length === 0) notFound();

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  const regionCounts = new Map<string, number>();
  for (const beach of allBeaches) {
    regionCounts.set(
      beach.regionSlug,
      (regionCounts.get(beach.regionSlug) ?? 0) + 1,
    );
  }

  // Nearby regions for cross-linking (exclude current)
  const nearbyRegions = CAM_REGIONS.filter((r) => {
    if (r.slug === regionSlug) return false;
    return (regionCounts.get(r.slug) ?? 0) > 0;
  });

  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Live Surf Cams", url: `${baseUrl}/cams` },
          {
            name: region.name,
            url: `${baseUrl}/cams/${regionSlug}`,
          },
        ]}
      />

      <CamsLandingNav />
      <ZineSurface
        sectionLabel={`${region.name} cams`}
        editionLabel={`${regionBeaches.length} live ${
          regionBeaches.length === 1 ? "cam" : "cams"
        }`}
        showMasthead={false}
        data-testid="cams-region-zine-surface"
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
                <BreadcrumbLink asChild className="hover:text-[#0B3A75]">
                  <Link href="/cams">Live Surf Cams</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-[#11100D]/35" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[#11100D]">
                  {region.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Hero */}
          <header className="grid gap-10 pb-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.8fr)] lg:items-start">
            <div>
              <p className="typewriter mb-4">
                {regionBeaches.length} live{" "}
                {regionBeaches.length === 1 ? "camera" : "cameras"}
              </p>
              <h1 className="zine-h1 max-w-4xl font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
                {region.name} Surf Cams
              </h1>
              <p className="mt-5 max-w-2xl font-sans text-lg leading-8 text-[#11100D]/75 sm:text-xl">
                {region.description}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <CamsShareButton />
                <Link
                  href="/cams"
                  className="inline-flex min-h-10 items-center justify-center rounded-[12px_5px_14px_5px] border-2 border-[#11100D] bg-[#F4EBD8] px-4 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.16)] transition-transform hover:-translate-y-0.5"
                >
                  All regions
                </Link>
              </div>
            </div>
            <CamsHeroContactSheet
              beaches={regionBeaches}
              label={`${region.name} live cam previews`}
            />
          </header>

          {/* Camera grid */}
          <section className="pb-16">
            <CamGrid beaches={regionBeaches} />
          </section>

          {/* Inline Signup CTA */}
          <section className="mx-auto max-w-3xl pb-12">
            <InlineSignupCta
              title={`Watching ${region.name}? Track the break.`}
              description={`The cam shows what's happening now. We score every hour at ${region.name} breaks so you know when to paddle out — free.`}
              primaryButtonText={`Track ${region.name}`}
              source={`cams-${region.slug}-inline`}
              ctaCopyVariant="region_specific_v1"
              variant="zine"
            />
          </section>

          {/* Nearby regions */}
          {nearbyRegions.length > 0 ? (
            <section className="pb-12">
              <h2 className="label-black mb-5 w-fit">More Surf Cam Regions</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nearbyRegions.map((r) => {
                  const count = regionCounts.get(r.slug) ?? 0;
                  return (
                    <Link
                      key={r.slug}
                      href={`/cams/${r.slug}`}
                      className="torn torn-tb group block border-2 border-[#11100D] bg-[#F0E5CC] p-5 text-[#11100D] shadow-[4px_5px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-1"
                    >
                      <h3 className="mb-2 font-[var(--font-zine-display)] text-2xl uppercase leading-none tracking-normal text-[#11100D] transition-colors group-hover:text-[#0B3A75]">
                        {r.name}
                      </h3>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D]/65">
                        {count} live {count === 1 ? "camera" : "cameras"}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="pb-4">
            <div className="mx-auto max-w-3xl border-2 border-[#11100D] bg-[#252D6B] p-8 text-center text-[#F4EBD8] shadow-[8px_8px_0_rgba(17,16,13,0.28)]">
              <h2 className="font-[var(--font-zine-display)] text-4xl uppercase leading-none tracking-normal">
                Know a {region.name}{" "}
                cam we&apos;re missing?
              </h2>
              <p className="mt-3 font-sans text-[#F4EBD8]/75">
                Send it over and we&apos;ll review it for the directory.
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
        source={`cams-${region.slug}`}
        ctaText="Get Cam Alerts"
        supportingText="Get notified when conditions are firing"
      />
    </>
  );
}
