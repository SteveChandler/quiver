import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Video } from "lucide-react";

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import {
  CAM_REGIONS,
  getCamRegionBySlug,
} from "@/lib/data/cam-regions";
import { buildPageMetadata } from "@/lib/seo/meta";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { CamGrid } from "@/components/cams/cam-grid";
import { OceanBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
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

  // Nearby regions for cross-linking (exclude current)
  const nearbyRegions = CAM_REGIONS.filter((r) => {
    if (r.slug === regionSlug) return false;
    const count = allBeaches.filter((b) => b.regionSlug === r.slug).length;
    return count > 0;
  });

  return (
    <OceanBackground variant="ocean" showWaves>
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
                <BreadcrumbLink asChild className="text-gray-500 hover:text-gray-700">
                  <Link href="/cams">Live Surf Cams</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-400" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-gray-700">
                  {region.name}
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
              <span>{regionBeaches.length} Live Cameras</span>
            </div>
            <h1 className="font-heading text-4xl font-bold text-gray-900 md:text-5xl">
              {region.name} Surf Cams
            </h1>
            <p className="mt-4 font-sans text-lg text-gray-600">
              {region.description}
            </p>
          </div>
        </ScrollReveal>
      </div>

      {/* Camera grid */}
      <div className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <CamGrid beaches={regionBeaches} />
        </div>
      </div>

      {/* Inline Signup CTA */}
      <div className="px-4 pb-12">
        <div className="mx-auto max-w-3xl">
          <InlineSignupCta
            title="Never Miss a Session"
            description="Get alerts when conditions line up at your favorite breaks. Free condition reports, 12-day outlooks, and your surf call."
            primaryButtonText="Get Alerts — Free"
            source={`cams-${region.slug}-inline`}
          />
        </div>
      </div>

      {/* Nearby regions */}
      {nearbyRegions.length > 0 && (
        <div className="px-4 pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 font-heading text-2xl font-bold text-gray-900">
              More Surf Cam Regions
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {nearbyRegions.map((r) => {
                const count = allBeaches.filter(
                  (b) => b.regionSlug === r.slug
                ).length;
                return (
                  <Link
                    key={r.slug}
                    href={`/cams/${r.slug}`}
                    className="group rounded-xl border border-blue-100/60 bg-white/80 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <h3 className="font-heading text-lg font-bold text-gray-900 group-hover:text-ocean-blue">
                      {r.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {count} live {count === 1 ? "camera" : "cameras"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <StickySignupBar
        source={`cams-${region.slug}`}
        ctaText="Get Cam Alerts"
        supportingText="Get notified when conditions are firing"
      />
    </OceanBackground>
  );
}
