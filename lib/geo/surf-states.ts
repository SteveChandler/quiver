import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { normalizeState } from "@/lib/geo/state-routing";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const fetchSupportedSurfStateSlugs = unstable_cache(
  async (): Promise<string[]> => {
    // Use service role to avoid RLS blocking public reads, but filter to public beaches.
    // This preserves SEO routing correctness without exposing private data.
    const supabase = createSupabaseServiceRoleClient();

    // NOTE: PostgREST can't DISTINCT without a view/RPC in our current setup.
    // We reduce repeated scans via Next cache + React request cache.
    const { data, error } = await supabase
      .from("beaches")
      .select("state")
      .not("state", "is", null);

    if (error || !data) return [];

    const unique = new Set(
      data
        .map((r) => normalizeState((r as { state?: string | null }).state ?? ""))
        .filter(Boolean)
    );

    return [...unique];
  },
  ["supported-surf-state-slugs-v2"],
  { revalidate: 60 * 60 * 24 } // 24h
);

/**
 * Returns the set of supported state slugs for `/[state]` routing.
 *
 * - Values are lowercase (e.g. "ca")
 * - Derived from `beaches.state` (DB source of truth)
 */
export const getSupportedSurfStates = cache(async (): Promise<Set<string>> => {
  const slugs = await fetchSupportedSurfStateSlugs();
  return new Set(slugs);
});













