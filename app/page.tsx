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

import type { Metadata } from "next";
import { AuthAwareLandingWrapper } from "@/components/landing-page/auth-aware-landing-wrapper";
import { LandingPageSSRSection } from "@/components/landing-page/landing-page-ssr-section";

// ISR: Revalidate every 10 minutes (aligns with featured beaches cache)
export const revalidate = 600;

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/images/hero/hero-golden-hour-poster.webp"
        type="image/webp"
      />
      <AuthAwareLandingWrapper />
      <LandingPageSSRSection />
    </>
  );
}
