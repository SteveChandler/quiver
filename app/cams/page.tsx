import { Metadata } from "next";
import Link from "next/link";
import { Video } from "lucide-react";

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { CAM_REGIONS } from "@/lib/data/cam-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { CamSchema } from "@/components/seo/cam-schema";
import { CamGrid } from "@/components/cams/cam-grid";
import { CamsShareButton } from "@/components/cams/cams-share-button";
import { OceanBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

export const dynamic = "force-dynamic";

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

  // Count cameras per region for the quick-nav
  const regionCounts = new Map<string, number>();
  for (const beach of beaches) {
    regionCounts.set(
      beach.regionSlug,
      (regionCounts.get(beach.regionSlug) ?? 0) + 1
    );
  }

  return (
    <OceanBackground variant="ocean" showWaves>
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: baseUrl },
          { name: "Live Surf Cams", url: `${baseUrl}/cams` },
        ]}
      />
      <CamSchema beaches={beaches} />

      {/* Visible breadcrumbs */}
      <div className="px-4 pt-6 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <Breadcrumb>
            <BreadcrumbList className="text-sm">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="text-gray-500 hover:text-gray-700">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-400" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-gray-700">
                  Live Surf Cams
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 pb-8 pt-8 md:pt-16">
        <ScrollReveal variant="fadeUp">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-ocean-blue/10 px-4 py-1.5 text-sm font-medium text-ocean-blue">
              <Video className="h-4 w-4" />
              <span>{camCount} Live Cameras</span>
            </div>
            <h1 className="font-roboto text-4xl font-bold text-gray-900 md:text-5xl lg:text-6xl">
              Live Surf Cams
            </h1>
            <p className="mt-4 font-open-sans text-lg text-gray-600 md:text-xl">
              Watch {camCount} live surf cams across {stateCount} states.
              {" "}Updated 24/7.
            </p>
            <div className="mt-6 flex justify-center">
              <CamsShareButton />
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Quick region navigation */}
      <div className="px-4 pb-8">
        <div className="mx-auto max-w-6xl">
          <nav
            aria-label="Cam regions"
            className="flex flex-wrap justify-center gap-2"
          >
            {CAM_REGIONS.map((region) => {
              const count = regionCounts.get(region.slug) ?? 0;
              if (count === 0) return null;
              return (
                <Link
                  key={region.slug}
                  href={`#${region.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-ocean-blue hover:text-white"
                >
                  {region.name}
                  <span className="text-xs text-gray-400 group-hover:text-white/70">
                    ({count})
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Camera grid grouped by region */}
      <div className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <CamGrid beaches={beaches} groupByRegion />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-blue-200/50 bg-white/80 p-8 shadow-lg backdrop-blur-sm">
            <h2 className="font-roboto text-2xl font-bold text-gray-900">
              Know a cam we&apos;re missing?
            </h2>
            <p className="mt-2 font-open-sans text-gray-600">
              Help us grow the largest surf cam directory.
            </p>
            <a
              href="mailto:support@quiversurf.app?subject=Surf%20cam%20suggestion"
              className="mt-4 inline-block rounded-full bg-ocean-blue px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-ocean-blue/90"
            >
              Suggest a cam
            </a>
          </div>
        </div>
      </div>
    </OceanBackground>
  );
}
