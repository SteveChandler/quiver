import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeState,
  toDbState,
  RESERVED_ONE_SEGMENT_SLUGS,
  getDbStateCandidatesForStateSlug,
} from "@/lib/geo/state-routing";

export const revalidate = 60 * 60 * 24; // 24h (best-effort; may be treated as dynamic if cookies are read)

type StateRootPageProps = {
  params: { intent: string };
};

export async function generateMetadata({ params }: StateRootPageProps) {
  const stateSlug = normalizeState(params.intent);
  if (!/^[a-z]{2}$/.test(stateSlug)) {
    return buildPageMetadata({
      title: "Page Not Found | Quiver",
      description: "This page could not be found.",
      path: `/${stateSlug}`,
    });
  }

  const dbState = toDbState(stateSlug);
  return buildPageMetadata({
    title: `Best Surf Beaches in ${dbState} | Quiver`,
    description: `Explore top surf spots in ${dbState}. Find beaches, conditions, and the best times to surf with Quiver.`,
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

  // Only support two-letter state slugs at the root.
  if (!/^[a-z]{2}$/.test(normalized)) notFound();

  const supabase = createSupabaseServerClient();
  const dbState = toDbState(normalized);
  const candidates = getDbStateCandidatesForStateSlug(normalized);

  // DB-gated routing: only 200 if the state exists in `beaches.state`.
  const { data: exists, error: existsError } = await supabase
    .from("beaches")
    .select("id")
    .or(candidates.map((v) => `state.ilike.${v}`).join(","))
    .limit(1);

  if (existsError || !exists || exists.length === 0) {
    notFound();
  }

  const { data, error } = await supabase
    .from("beaches")
    .select(
      "id,name,slug,city,state,country,review_count,average_rating,is_private"
    )
    .or(candidates.map((v) => `state.ilike.${v}`).join(","))
    .eq("is_private", false)
    .order("review_count", { ascending: false })
    .limit(200);

  if (error || !data) {
    notFound();
  }

  const beaches = data.filter(
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-bold">Best Surf Beaches in {dbState}</h1>
      <p className="mt-2 text-slate-600">{dbState}, USA</p>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">Top beaches</h2>
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
                  {beach.city}, {dbState}
                  {rating ? ` · ${rating}★` : ""}
                  {reviews ? ` · ${reviews} reviews` : ""}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
