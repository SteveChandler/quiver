import type { Beach } from "@/types/database";

/**
 * Fetches the current user's favorite beach IDs from the API.
 *
 * Pure async function — the caller is responsible for setting state
 * with the returned Set.
 *
 * @param userId - The authenticated user's ID, or undefined if not logged in.
 * @returns A Set of beach IDs that are favorites (empty Set when unauthenticated
 *          or on error, since favorites are non-critical for map functionality).
 */
export async function loadFavoriteBeaches(
  userId: string | undefined
): Promise<Set<string>> {
  if (!userId) {
    return new Set();
  }

  try {
    const res = await fetch("/api/beaches/favorites", {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return new Set();
    }

    const json = await res.json().catch(() => null);
    const beaches = (json?.data?.beaches ?? json?.beaches ?? []) as Beach[];
    return new Set(beaches.map((beach) => beach.id).filter(Boolean));
  } catch (e) {
    console.debug(
      "Error loading favorite beaches:",
      e instanceof Error ? e.message : String(e)
    );
    return new Set();
  }
}
