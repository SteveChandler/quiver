/**
 * Home Page - SSR Landing with Auth-Aware Routing
 *
 * Architecture:
 * - SSR beach section is rendered in layout.tsx OUTSIDE the Providers client boundary
 * - This page renders the client-side auth-aware wrapper
 *
 * SEO: Beach links are server-rendered in layout.tsx via LandingPageSSRSection,
 * ensuring they appear in view-source for crawlers regardless of JS loading.
 *
 * Performance: ISR with 10-minute revalidation prevents full re-render on every request.
 * Featured beaches already have a 10-minute cache, so this aligns with that strategy.
 */

import type { Metadata } from "next";

// ISR: Revalidate every 10 minutes (aligns with featured beaches cache)
export const revalidate = 600;

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

import { AuthAwareLandingWrapper } from "@/components/landing-page/auth-aware-landing-wrapper";

export default function Home() {
  return <AuthAwareLandingWrapper />;
}
