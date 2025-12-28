import { getBeachById } from "@/actions/beach/beach-query-actions";
import { notFound, permanentRedirect } from "next/navigation";
import { buildBeachUrlWithTab } from "@/lib/utils/beach-url-utils";

/**
 * DEPRECATED: Standalone forecast page
 *
 * This route is deprecated in favor of the canonical beach detail page
 * with the Forecast tab. All requests are permanently redirected (308).
 *
 * Old: /forecast/{beachId}
 * New: /{state}/{city}/{beachSlug}?tab=forecast
 */
export default async function ForecastPage({
  params,
}: {
  params: { beachId: string };
}) {
  // Fetch beach data first (may throw on error)
  const result = await getBeachById(params.beachId);

  if (!result.success || !result.data) {
    notFound();
  }

  const beach = result.data;
  const canonicalUrl = buildBeachUrlWithTab(beach, "forecast");

  // Redirect to canonical beach page with Forecast tab
  // Note: permanentRedirect() throws internally, so it must not be wrapped in try-catch
  permanentRedirect(canonicalUrl);
}
