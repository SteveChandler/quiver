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

export const revalidate = 86400;

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app"
).replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Surf Guides | Quiver",
    description:
      "Regional surf guides covering Southern California, Hawaii, Florida, the Outer Banks, and more. Wave types, seasonal windows, water temps, and the best breaks in each region.",
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
    <div className="min-h-screen bg-background">
      <BreadcrumbStructuredData
        items={[
          { name: "Quiver", url: `${SITE_ORIGIN}/` },
          { name: "Surf Guides", url: `${SITE_ORIGIN}/guides` },
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <header className="mb-10">
          <h1 className="font-heading text-3xl font-bold md:text-4xl">
            Surf Guides
          </h1>
          <p className="mt-3 text-muted-foreground">
            Regional breakdowns covering wave types, seasonal windows, water
            temps, wetsuit needs, and the best breaks in each area.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {regions.map((region) => (
            <Link
              key={region.slug}
              href={`/guides/surfing-${region.slug}`}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-card/80"
            >
              <h2 className="font-heading text-lg font-semibold text-foreground group-hover:text-primary">
                {region.name}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {region.description.split("\n")[0]}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
