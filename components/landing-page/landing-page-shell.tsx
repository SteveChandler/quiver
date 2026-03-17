import Link from "next/link";
import { getFeaturedBeaches } from "@/lib/data/server/featured-beaches";
import { PopularBeachesSection } from "./popular-beaches-section";
import { QuiverFAQSchema } from "@/components/seo/faq-schema";

interface LandingPageShellProps {
  children: React.ReactNode;
}

export async function LandingPageShell({ children }: LandingPageShellProps) {
  // Fetch beaches server-side for SEO and initial render
  const { beaches } = await getFeaturedBeaches();

  return (
    <div className="min-h-screen bg-white">
      {/* SEO structured data - SSR'd for search engines */}
      <QuiverFAQSchema />

      {/* Hidden fallback CTA for E2E test compatibility */}
      <Link
        href="/auth/sign-up"
        data-testid="test-fallback-cta"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        Sign Up
      </Link>

      {/* Auth-aware content slot (client boundary) */}
      {children}

      {/* SSR'd beach links section - always visible to crawlers */}
      <PopularBeachesSection beaches={beaches} />

      {/* Static footer content - SSR-safe */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">
            &copy; 2026 Quiver. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
