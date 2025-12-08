/**
 * Landing Page SSR Section
 *
 * This server component is rendered OUTSIDE the Providers (client boundary)
 * in the root layout, ensuring beach links are always present in the initial HTML
 * for SEO crawlability.
 *
 * Architecture:
 * - Rendered as a sibling to Providers in layout.tsx (not a child)
 * - Fetches beach data server-side
 * - Renders static beach links that appear in view-source
 * - Positioned at bottom of page using CSS to avoid disrupting the layout
 *
 * @module components/landing-page/landing-page-ssr-section
 */

import { getFeaturedBeaches } from "@/lib/data/server/featured-beaches";
import { PopularBeachesSection } from "./popular-beaches-section";
import { QuiverFAQSchema } from "@/components/seo/faq-schema";

/**
 * Server-rendered landing page section for SEO
 *
 * This component is conditionally rendered in the root layout for the landing page.
 * Because it's outside the Providers client boundary, it renders fully on the server.
 */
export async function LandingPageSSRSection() {
  // Fetch beaches server-side - this happens on every request
  const beaches = await getFeaturedBeaches();

  return (
    <>
      {/* SEO structured data - rendered server-side */}
      <QuiverFAQSchema />

      {/*
        Hidden container for SSR beach links
        This ensures beach links are in the HTML for crawlers.
        The visible beach cards are rendered by SurfHighlightsSection (client).
        This hidden section provides the SEO fallback.
      */}
      <div
        id="ssr-beach-links"
        className="sr-only"
        aria-hidden="true"
        data-ssr="true"
      >
        {/* Screen-reader only links for SEO crawlers */}
        <h2>Popular Surf Spots</h2>
        <nav aria-label="Featured beaches">
          <ul>
            {beaches.slice(0, 8).map((beach) => {
              const beachUrl = getBeachUrl(beach);
              return (
                <li key={beach.id}>
                  <a href={beachUrl}>{beach.name}</a>
                  {beach.city && beach.state && (
                    <span>
                      {" "}
                      - {beach.city}, {beach.state}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/*
        Visible SSR Beach Section
        Positioned to appear after the main content via CSS order.
        This renders the full visual beach cards server-side.
      */}
      <div
        id="ssr-beach-section"
        className="ssr-beach-section"
        style={{ order: 100 }}
      >
        <PopularBeachesSection beaches={beaches} />
      </div>
    </>
  );
}

/**
 * Generate beach URL following hierarchical pattern
 * Matches the logic in getBeachUrlSafe
 */
function getBeachUrl(beach: {
  id: string;
  slug: string | null;
  city: string | null;
  state: string | null;
}): string {
  // State to URL slug mapping
  const stateSlugMap: Record<string, string> = {
    CA: "ca",
    California: "ca",
    FL: "fl",
    Florida: "fl",
    HI: "hi",
    Hawaii: "hi",
    OR: "or",
    Oregon: "or",
    WA: "wa",
    Washington: "wa",
    NC: "nc",
    "North Carolina": "nc",
    SC: "sc",
    "South Carolina": "sc",
    TX: "tx",
    Texas: "tx",
    NJ: "nj",
    "New Jersey": "nj",
    NY: "ny",
    "New York": "ny",
  };

  if (beach.slug && beach.city && beach.state) {
    const stateSlug =
      stateSlugMap[beach.state] || beach.state.toLowerCase().replace(/\s+/g, "-");
    const citySlug = beach.city.toLowerCase().replace(/\s+/g, "-");
    return `/${stateSlug}/${citySlug}/${beach.slug}`;
  }

  if (beach.slug) {
    return `/beach/${beach.slug}`;
  }

  return `/beach/${beach.id}`;
}
