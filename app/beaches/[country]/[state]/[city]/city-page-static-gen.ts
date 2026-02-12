/**
 * Static params generation for the city/location listing page.
 *
 * Re-exported from page.tsx as a Next.js named export.
 */

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { generateLocationSlug } from "@/lib/utils/location-slug";

/**
 * Generate static params for all beach locations.
 * Enables Next.js to pre-generate all location pages at build time.
 *
 * Returns empty array on errors to allow build to continue.
 * Pages will be generated on-demand (ISR) instead.
 */
export async function generateStaticParams() {
  try {
    const response = await getAllBeachLocations();

    if (!response.success || !response.data || response.data.length === 0) {
      console.warn(
        "[generateStaticParams] No location data available, skipping static generation"
      );
      return [];
    }

    return response.data.map((loc) => ({
      country: generateLocationSlug(loc.country),
      state: generateLocationSlug(loc.state),
      city: generateLocationSlug(loc.city),
    }));
  } catch (error) {
    // Log error but don't fail build - pages will be generated on-demand via ISR
    console.error("[generateStaticParams] Error fetching locations:", error);
    console.warn(
      "[generateStaticParams] Skipping static generation, pages will use ISR"
    );
    return [];
  }
}
