import { CamGrid } from "@/components/cams/cam-grid";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";
import {
  getSeoFunnelInternalLinks,
  type SeoPageConfig,
} from "@/lib/seo/funnel-pages";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { BoardRecommendationCard } from "./BoardRecommendationCard";
import { InternalLinkCluster } from "./InternalLinkCluster";
import { JsonLd } from "./JsonLd";
import { NearbySpots } from "./NearbySpots";
import { QuiverSeoCta } from "./QuiverSeoCta";
import { SeoFaq } from "./SeoFaq";
import { SeoHero } from "./SeoHero";
import { SurfDecisionCard } from "./SurfDecisionCard";

interface SeoLocationPageProps {
  page: SeoPageConfig;
  cameras?: CamBeachWithRegion[];
}

const CAM_PREVIEW_LIMIT = 6;

const FEATURED_CAMERA_TERMS_BY_SLUG: Record<string, string[]> = {
  "san-diego": [
    "ocean beach",
    "tourmaline",
    "pacific beach",
    "crystal pier",
    "blacks",
    "scripps",
  ],
  "orange-county": [
    "doheny",
    "san onofre",
    "san clemente",
    "salt creek",
    "huntington",
    "newport",
  ],
  hawaii: [
    "waikiki",
    "honolulu",
    "pipeline",
    "waimea",
    "north shore",
    "hanalei",
  ],
  florida: ["cocoa", "new smyrna", "ponce", "satellite", "jacksonville"],
};

function getCameraPriority(
  page: SeoPageConfig,
  camera: CamBeachWithRegion,
): number {
  const terms = FEATURED_CAMERA_TERMS_BY_SLUG[page.slug] ?? [];
  const haystack = `${camera.name} ${camera.city}`.toLowerCase();
  const matchIndex = terms.findIndex((term) => haystack.includes(term));

  return matchIndex === -1 ? Number.MAX_SAFE_INTEGER : matchIndex;
}

function getFeaturedCameras(
  page: SeoPageConfig,
  cameras: CamBeachWithRegion[],
): CamBeachWithRegion[] {
  return cameras
    .map((camera, index) => ({ camera, index }))
    .sort((a, b) => {
      const priorityDelta =
        getCameraPriority(page, a.camera) - getCameraPriority(page, b.camera);
      return priorityDelta === 0 ? a.index - b.index : priorityDelta;
    })
    .slice(0, CAM_PREVIEW_LIMIT)
    .map(({ camera }) => camera);
}

export function SeoLocationPage({ page, cameras = [] }: SeoLocationPageProps) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
  ).replace(/\/$/, "");
  const pageUrl = `${baseUrl}${page.path}`;
  const featuredCameras =
    page.type === "surf-cams" ? getFeaturedCameras(page, cameras) : cameras;
  const hiddenCameraCount = Math.max(
    cameras.length - featuredCameras.length,
    0,
  );
  const internalLinks = getSeoFunnelInternalLinks(page);

  return (
    <div className="seo-paper-page">
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: `${baseUrl}/` },
          { name: page.locationName, url: pageUrl },
        ]}
      />
      <WebPageSchema
        name={page.title}
        url={pageUrl}
        description={page.metaDescription}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${page.locationName} Quiver planning links`,
          itemListElement: internalLinks.map((link, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: link.label,
            url: `${baseUrl}${link.href}`,
          })),
        }}
      />

      <main className="container mx-auto max-w-7xl px-4 pb-8">
        <SeoHero
          eyebrow={page.eyebrow}
          title={page.h1}
          description={page.intro}
          primaryCta={page.primaryCta}
          secondaryCta={page.secondaryCta}
          image={page.heroImage}
        />

        {page.decision ? <SurfDecisionCard decision={page.decision} /> : null}

        {page.type === "surf-cams" ? (
          <section aria-labelledby="cam-grid-heading" className="py-5">
            <div className="mb-5">
              <h2
                id="cam-grid-heading"
                className="font-heading text-2xl font-bold text-gray-900"
              >
                Live cameras in {page.locationName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Start with the highest-signal checks, then use the forecast
                context before changing spots.
              </p>
            </div>
            {featuredCameras.length > 0 ? (
              <>
                <CamGrid beaches={featuredCameras} />
                {hiddenCameraCount > 0 ? (
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {hiddenCameraCount} more regional cameras stay available in
                    Quiver and on the map once you know which zone is worth a
                    closer look.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                Live camera coverage is temporarily unavailable for this region.
                Check Quiver for the freshest forecast read.
              </div>
            )}
          </section>
        ) : null}

        <div className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <section className="space-y-5">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-heading text-xl font-bold text-gray-900">
                  {section.heading}
                </h2>
                <p className="mt-2 text-base leading-7 text-gray-700">
                  {section.body}
                </p>
              </section>
            ))}
          </section>

          {page.type === "beginner" || page.type === "longboard" ? (
            <BoardRecommendationCard
              type={page.type}
              locationName={page.locationName}
              body={page.sections[2]?.body ?? page.intro}
            />
          ) : (
            <aside className="self-start rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-heading text-lg font-bold text-gray-900">
                Check again before you drive
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                Surf windows move. Use this page as the planning layer, then
                open Quiver for the latest read before you load boards.
              </p>
            </aside>
          )}
        </div>

        <NearbySpots spots={page.nearbySpots} />
        <InternalLinkCluster title="Keep planning" links={internalLinks} />
        <div className="py-6">
          <SeoFaq items={page.faqs} locationName={page.locationName} />
        </div>
        <div className="py-8">
          <QuiverSeoCta
            title="Make the call with Quiver"
            description="Use the page context for planning, then open Quiver for live surf conditions, best windows, tide risk, and session logging."
            primaryCta={page.primaryCta}
            secondaryCta={page.secondaryCta}
          />
        </div>
      </main>
      <StickySignupBar
        ctaText="Get the live surf call"
        supportingText="Best window, tide, wind, and board notes in Quiver."
        source={`seo-funnel-${page.type}-${page.slug}`}
      />
    </div>
  );
}
