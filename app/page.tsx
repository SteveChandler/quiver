/**
 * Home Page - SSR Landing with Auth-Aware Routing
 *
 * Architecture:
 * - LandingPageSSRSection is rendered here (server component) for SEO crawlability.
 *   It fetches beach data server-side and renders links visible in view-source.
 * - AuthAwareLandingWrapper handles the client-side auth-aware hero/content.
 *
 * Performance: ISR with 10-minute revalidation prevents full re-render on every request.
 * Featured beaches already have a 10-minute cache, so this aligns with that strategy.
 */

import { Suspense, type ReactElement } from "react";
import type { Metadata } from "next";
import { AuthAwareLandingWrapper } from "@/components/landing-page/auth-aware-landing-wrapper";
import { LandingPageSSRSection } from "@/components/landing-page/landing-page-ssr-section";
import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";
import { isAppFirstLandingEnabled } from "@/lib/flags/app-first-landing";

// ISR: Revalidate every 10 minutes (aligns with featured beaches cache)
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Quiver for iPhone | Surf Forecast App",
  description:
    "Open Quiver's current iPhone App Store listing. Know where to paddle out with clean surf forecasts, beach context, and session tracking.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Quiver for iPhone",
    description:
      "Know where to paddle out. Quiver brings surf forecasts, beach context, and session tracking to iPhone.",
    url: "/",
    siteName: "Quiver",
    type: "website",
    images: [
      {
        url: "/images/hero/quiver-landing-hero-social.jpg",
        width: 1200,
        height: 630,
        alt: "Quiver iPhone surf forecast app launch preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quiver for iPhone",
    description:
      "Know where to paddle out. Surf forecasts, beach context, and session tracking for iPhone.",
    images: ["/images/hero/quiver-landing-hero-social.jpg"],
  },
  appLinks: {
    ios: {
      url: IOS_APP_STORE_URL,
      app_store_id: "6759300320",
      app_name: "Surf Forecast: Quiver",
    },
  },
};

export default function Home(): ReactElement {
  const appFirst = isAppFirstLandingEnabled();

  return (
    <>
      <Suspense>
        {/* Platform is detected client-side. Reading it from the request's
            user-agent here opted the whole route out of static generation, so
            the `revalidate` above never applied and every visit re-rendered
            the page — including the server-side beach fetch below. The value
            only decorates analytics query params on the download links, so
            resolving it after mount costs nothing visible. */}
        <AuthAwareLandingWrapper appFirst={appFirst} />
      </Suspense>
      <LandingPageSSRSection />
    </>
  );
}
