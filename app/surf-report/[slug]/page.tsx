import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLocationPage } from "@/components/seo/funnel/SeoLocationPage";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getSeoFunnelPageByTypeAndSlug } from "@/lib/seo/funnel-pages";

// Force static rendering. These routes read Supabase through the cookie-free
// public client, whose fetch is cache: "no-store"; without force-static that
// single uncached fetch opts the whole route into dynamic rendering, so Vercel
// served it with private/no-store on every request (measured 2026-09-01:
// x-vercel-cache MISS, TTFB 1.2-4.9s) instead of the hourly ISR page.
export const dynamic = "force-static";
export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const page = getSeoFunnelPageByTypeAndSlug("surf-report-today", slug);

  if (!page) {
    return {
      title: "Surf Report Not Found",
      robots: { index: false, follow: true },
    };
  }

  return buildPageMetadata({
    title: page.title,
    description: page.metaDescription,
    path: page.path,
    image: page.heroImage.src,
  });
}

export default async function TodaySurfReportPage(props: PageProps) {
  const { slug } = await props.params;
  const page = getSeoFunnelPageByTypeAndSlug("surf-report-today", slug);

  if (!page) notFound();

  return <SeoLocationPage page={page} />;
}
