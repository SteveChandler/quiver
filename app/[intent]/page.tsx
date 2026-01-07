import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { isValidStateSlug } from "@/lib/utils/beach-url-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeState,
  RESERVED_ONE_SEGMENT_SLUGS,
  getDbStateCandidatesForStateSlug,
  getStateDisplayNameFromSlug,
} from "@/lib/geo/state-routing";

export const revalidate = 60 * 60 * 24; // 24h (best-effort; may be treated as dynamic if cookies are read)

type StateRootPageProps = {
  params: { intent: string };
};

export async function generateMetadata({ params }: StateRootPageProps) {
  const stateSlug = normalizeState(params.intent);
  if (!isValidStateSlug(stateSlug)) {
    return buildPageMetadata({
      title: "Page Not Found",
      description: "This page could not be found.",
      path: `/${stateSlug}`,
    });
  }

  const stateName = getStateDisplayNameFromSlug(stateSlug);
  return buildPageMetadata({
    title: `Best Surf Beaches in ${stateName}`,
    description: `Explore top surf spots in ${stateName}. Find beaches, conditions, and the best times to surf with Quiver.`,
    path: `/${stateSlug}`,
  });
}

/**
 * State-root landing pages
 * - /ca
 * - /or
 *
 * Note: We implement this as `/[intent]` to avoid route collisions with the existing
 * `/[intent]/[city]` and `/[intent]/[city]/[beachSlug]` hierarchy.
 */
export default async function StateRootPage({ params }: StateRootPageProps) {
  const normalized = normalizeState(params.intent);

  // Prevent collisions with one-segment routes (even though static routes win).
  if (RESERVED_ONE_SEGMENT_SLUGS.has(normalized)) notFound();

  // Canonical lowercase URLs.
  if (params.intent !== normalized) permanentRedirect(`/${normalized}`);

  // Only support known 2-letter state slugs at the root.
  if (!isValidStateSlug(normalized)) notFound();

  const supabase = createSupabaseServerClient();
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
      .limit(200);

    beaches = (data || []).filter(
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
  } catch {
    beaches = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-bold">Best Surf Beaches in {stateName}</h1>
      <p className="mt-2 text-slate-600">{stateName}, USA</p>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">Top beaches</h2>
        {beaches.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700">
            <p className="font-medium">
              We’re expanding coverage in {stateName}.
            </p>
            <p className="mt-1 text-sm text-slate-600">
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
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <Link href={href} className="text-sky-700 hover:underline">
                    {beach.name}
                  </Link>
                  <div className="mt-1 text-sm text-slate-600">
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
  );
}











