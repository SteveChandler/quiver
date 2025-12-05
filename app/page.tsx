/**
 * Home Page - SSR Landing with Auth-Aware Routing
 *
 * Architecture:
 * - SSR beach section is rendered in layout.tsx OUTSIDE the Providers client boundary
 * - This page renders the client-side auth-aware wrapper
 *
 * SEO: Beach links are server-rendered in layout.tsx via LandingPageSSRSection,
 * ensuring they appear in view-source for crawlers regardless of JS loading.
 */

import { AuthAwareLandingWrapper } from "@/components/landing-page/auth-aware-landing-wrapper";

export default function Home() {
  return <AuthAwareLandingWrapper />;
}
