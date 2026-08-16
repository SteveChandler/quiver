import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeStateSlug,
  RESERVED_ONE_SEGMENT_SLUGS,
  getDbStateCandidatesForStateSlug,
  getStateDisplayNameFromSlug,
} from "@/lib/geo/state-routing";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { rankBeaches } from "@/lib/recommendations/selection";
import { WATER_QUALITY_HOLD_PREFETCH_BUFFER } from "@/lib/recommendations/major-event-hold/water-quality";

export const revalidate = 86400; // 24h (best-effort; may be treated as dynamic if cookies are read)

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

type StateRootPageProps = {
  params: Promise<{ intent: string }>;
};

export async function generateMetadata(props: StateRootPageProps) {
  const params = await props.params;
  const stateSlug = normalizeStateSlug(params.intent);
  if (!isValidStateSlug(stateSlug)) {
    return buildPageMetadata({
      title: "Page Not Found",
      description: "This page could not be found.",
      path: `/${stateSlug}`,
    });
  }

  const stateName = getStateDisplayNameFromSlug(stateSlug);
  return buildPageMetadata({
    title: `Best Surf Spots in ${stateName} — Conditions & Forecasts`,
    description: `Explore top surf spots in ${stateName}. Find beaches, conditions, and the best times to surf with Quiver.`,
    path: `/${stateSlug}`,
  });
}

/**
 * State-root landing pages
 * - /ca
 * - /or
 *
 * Note: In production, `/ca` is 301-redirected to `/beaches/usa/ca` by the
 * SEO redirect handler (handleStateOnlyRedirect). This page is a fallback
 * for direct access or if the redirect is bypassed.
 *
 * We implement this as `/[intent]` to avoid route collisions with the existing
 * `/[intent]/[city]` and `/[intent]/[city]/[beachSlug]` hierarchy.
 */
export default async function StateRootPage(props: StateRootPageProps) {
  const params = await props.params;
  const normalized = normalizeStateSlug(params.intent);

  // Prevent collisions with one-segment routes (even though static routes win).
  if (RESERVED_ONE_SEGMENT_SLUGS.has(normalized)) notFound();

  // Canonical lowercase URLs.
  if (params.intent !== normalized) permanentRedirect(`/${normalized}`);

  // Only support known 2-letter state slugs at the root.
  if (!isValidStateSlug(normalized)) notFound();

  const supabase = await createSupabaseServerClient();
  const stateName = getStateDisplayNameFromSlug(normalized);
  const candidates = getDbStateCandidatesForStateSlug(normalized);

  // NOTE: Do NOT 404 if the DB query returns empty or errors.
  // Search engines will crawl `/[state]` directly; we want a stable 200 for valid states
  // even if RLS/service configuration changes temporarily.
  let beaches: Array<{
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
    country: string | null;
    review_count: number | null;
    average_rating: number | null;
    is_private: boolean;
  }> = [];

  try {
    const { data } = await supabase
      .from("beaches")
      .select(
        "id,name,slug,city,state,country,review_count,average_rating,is_private"
      )
      .or(candidates.map((v) => `state.ilike.${v}`).join(","))
      .eq("is_private", false)
      .order("review_count", { ascending: false })
      .limit(200 + WATER_QUALITY_HOLD_PREFETCH_BUFFER);

    const publicBeaches = (data || []).filter(
      (
        b
      ): b is {
        id: string;
        name: string;
        slug: string;
        city: string;
        state: string;
        country: string | null;
        review_count: number | null;
        average_rating: number | null;
        is_private: boolean;
      } => !!(b && b.slug && b.city && b.state && b.is_private === false)
    );
    beaches = await rankBeaches(publicBeaches, {
      compare: (a, b) => (b.review_count ?? 0) - (a.review_count ?? 0),
    });
  } catch {
    beaches = [];
  }

  return (
    <>
      {/* Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: baseUrl },
          { name: stateName, url: `${baseUrl}/${normalized}` },
        ]}
      />
      {beaches.length > 0 && (
        <ItemListSchema
          items={beaches.slice(0, 50).map((beach, index) => ({
            name: beach.name,
            url: `${baseUrl}${buildBeachUrl(beach)}`,
            position: index + 1,
          }))}
          name={`Surf Beaches in ${stateName}`}
        />
      )}
      <WebPageSchema
        name={`Best Surf Beaches in ${stateName}`}
        url={`${baseUrl}/${normalized}`}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-bold">Best Surf Beaches in {stateName}</h1>
      <p className="mt-2 text-gray-600">{stateName}, USA</p>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800">Top beaches</h2>
        {beaches.length === 0 ? (
          <div className="mt-4 rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 text-gray-700">
            <p className="font-medium">
              We&apos;re expanding coverage in {stateName}.
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Explore the surf map to find nearby spots and save favorites.
            </p>
            <div className="mt-3">
              <Link href="/map" className="text-sky-700 hover:underline">
                Open the surf map
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {beaches.map((beach) => {
              const href = buildBeachUrl(beach);
              const rating =
                beach.average_rating != null
                  ? beach.average_rating.toFixed(1)
                  : null;
              const reviews = beach.review_count ?? 0;

              return (
                <li
                  key={beach.id}
                  className="rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 shadow-sm"
                >
                  <Link href={href} className="text-sky-700 hover:underline">
                    {beach.name}
                  </Link>
                  <div className="mt-1 text-sm text-gray-600">
                    {beach.city}, {stateName}
                    {rating ? ` · ${rating}★` : ""}
                    {reviews ? ` · ${reviews} reviews` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
    </>
  );
}
