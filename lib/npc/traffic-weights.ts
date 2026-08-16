import type { BeachTrafficWeight } from "./beach-selection";

export interface TrafficBeach {
  id: string;
  slug: string | null;
  city: string | null;
  state: string | null;
}

export interface TrafficEvent {
  eventType: string;
  beachId: string | null;
  metadata: unknown;
}

export type TrafficAllocationTier = "proven" | "adjacent" | "exploration";

export interface ComputedTrafficWeight extends BeachTrafficWeight {
  beachId: string;
  views30d: number;
  weight: number;
  computedAt: string;
  marketKey: string;
  allocationTier: TrafficAllocationTier;
}

const STATE_SLUGS = new Set([
  "ca",
  "me",
  "nj",
  "nc",
  "hi",
  "or",
  "wa",
  "ma",
  "ri",
  "ny",
  "sc",
  "ga",
  "fl",
  "tx",
  "pr",
]);

const CITY_INTENTS = new Set([
  "forecast",
  "water-temp",
  "dawn-patrol",
  "sunset",
  "beginner",
  "longboard",
  "tide",
  "surf-report",
  "best-time-to-surf",
]);

const MIN_TRAFFIC_WEIGHT = 1;

/**
 * Converts page and beach events into a beach demand signal. City/intent page
 * views are expanded to the matching city beaches because those pages do not
 * carry a beach_id; each matching beach receives one demand point.
 */
export function computeTrafficWeights(
  beaches: readonly TrafficBeach[],
  events: readonly TrafficEvent[],
  computedAt: string,
): ComputedTrafficWeight[] {
  const viewsByBeach = new Map<string, number>();
  const beachesById = new Map(beaches.map((beach) => [beach.id.toLowerCase(), beach]));

  for (const event of events) {
    if (event.eventType === "beach_view" && event.beachId) {
      increment(viewsByBeach, event.beachId);
      continue;
    }

    if (event.eventType !== "page_view") continue;
    if (event.beachId && beachesById.has(event.beachId.toLowerCase())) {
      increment(viewsByBeach, event.beachId);
      continue;
    }

    const pathname = readPathname(event.metadata);
    if (!pathname) continue;
    for (const beach of beachesForPath(pathname, beaches)) {
      increment(viewsByBeach, beach.id);
    }
  }

  const viewsByMarket = new Map<string, number>();
  for (const beach of beaches) {
    const marketKey = getMarketKey(beach);
    viewsByMarket.set(
      marketKey,
      (viewsByMarket.get(marketKey) ?? 0) + (viewsByBeach.get(beach.id.toLowerCase()) ?? 0),
    );
  }

  return beaches.map((beach) => {
    const views30d = viewsByBeach.get(beach.id.toLowerCase()) ?? 0;
    const marketKey = getMarketKey(beach);
    const allocationTier: TrafficAllocationTier =
      views30d > 0
        ? "proven"
        : (viewsByMarket.get(marketKey) ?? 0) > 0
          ? "adjacent"
          : "exploration";
    return {
      beachId: beach.id,
      views30d,
      // Square-root demand recognizes traffic without letting one market
      // absorb the feed. Tier quotas enforce the 70/20/10 split separately.
      weight: Math.max(MIN_TRAFFIC_WEIGHT, Math.sqrt(views30d)),
      computedAt,
      marketKey,
      allocationTier,
    };
  });
}

export function beachesForPath(
  pathname: string,
  beaches: readonly TrafficBeach[],
): TrafficBeach[] {
  const segments = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
    .map(normalizeSegment);
  if (segments.length < 2) return [];

  const first = segments[0];
  if (STATE_SLUGS.has(first)) {
    const stateBeaches = beaches.filter(
      (beach) => normalizeSegment(beach.state) === first,
    );
    if (segments.length >= 3) {
      const directMatches = stateBeaches.filter(
        (beach) => normalizeSegment(beach.slug) === segments[2],
      );
      if (directMatches.length > 0) return directMatches;
    }
    return stateBeaches.filter(
      (beach) => normalizeSegment(beach.city) === segments[1],
    );
  }

  if (!CITY_INTENTS.has(first)) return [];

  const requestedCity = segments[1];
  const cityMatches = beaches.filter(
    (beach) => normalizeSegment(beach.city) === requestedCity,
  );
  if (cityMatches.length > 0) return cityMatches;

  // `/forecast/hawaii` is a state-wide intent page, not a city page.
  if (requestedCity === "hawaii") {
    return beaches.filter((beach) => normalizeSegment(beach.state) === "hi");
  }

  return [];
}

/** Fetch a usable snapshot; null means old uniform-selection behavior. */
export async function fetchBeachTrafficWeights(
  supabase: unknown,
  beachIds: readonly string[],
): Promise<BeachTrafficWeight[] | null> {
  if (beachIds.length === 0) return null;

  try {
    const { data, error } = await (supabase as {
      from: (table: string) => {
        select: (columns: string) => {
          in: (
            column: string,
            values: readonly string[],
          ) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    })
      .from("beach_traffic_weights")
      .select("beach_id, views_30d, weight, computed_at")
      .in("beach_id", beachIds);

    if (error || !Array.isArray(data) || data.length === 0) {
      if (error) {
        console.warn("[npc-traffic] traffic weights unavailable; using uniform selection", error);
      }
      return null;
    }

    const validRows = data.flatMap((row): BeachTrafficWeight[] => {
      if (!isRecord(row) || typeof row.beach_id !== "string") return [];
      const views30d = toNonNegativeNumber(row.views_30d);
      const weight = toNonNegativeNumber(row.weight);
      if (views30d === null || weight === null) return [];
      return [{
        beachId: row.beach_id,
        views30d,
        weight,
        computedAt: typeof row.computed_at === "string" ? row.computed_at : null,
        marketKey: typeof row.market_key === "string" ? row.market_key : "",
        allocationTier: isTrafficAllocationTier(row.allocation_tier)
          ? row.allocation_tier
          : "proven",
      }];
    });

    return validRows.length > 0 ? validRows : null;
  } catch (error) {
    console.warn("[npc-traffic] traffic weights query failed; using uniform selection", error);
    return null;
  }
}

export async function refreshBeachTrafficWeights(
  supabase: unknown,
  asOf: Date = new Date(),
): Promise<ComputedTrafficWeight[]> {
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        not: (column: string, operator: string, value: null) => {
          limit: (count: number) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
  const beachesResult = await client
    .from("beaches")
    .select("id, slug, city, state")
    .not("id", "is", null)
    .limit(5000);
  if (beachesResult.error) {
    throw new Error(`Failed to load beaches for traffic weights: ${getErrorMessage(beachesResult.error)}`);
  }

  const beaches = (Array.isArray(beachesResult.data) ? beachesResult.data : []).flatMap(
    (row): TrafficBeach[] => {
      if (!isRecord(row) || typeof row.id !== "string") return [];
      return [{
        id: row.id,
        slug: typeof row.slug === "string" ? row.slug : null,
        city: typeof row.city === "string" ? row.city : null,
        state: typeof row.state === "string" ? row.state : null,
      }];
    },
  );
  if (beaches.length === 0) return [];

  const eventResult = await (supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        gte: (column: string, value: string) => {
          in: (column: string, values: readonly string[]) => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  })
    .from("user_events")
    .select("event_type, beach_id, metadata")
    .gte("created_at", new Date(asOf.getTime() - 30 * 86400000).toISOString())
    .in("event_type", ["beach_view", "page_view", "forecast_check"]);
  if (eventResult.error) {
    throw new Error(`Failed to load analytics events for traffic weights: ${getErrorMessage(eventResult.error)}`);
  }

  const events = (Array.isArray(eventResult.data) ? eventResult.data : []).flatMap(
    (row): TrafficEvent[] => {
      if (!isRecord(row) || typeof row.event_type !== "string") return [];
      return [{
        eventType: row.event_type,
        beachId: typeof row.beach_id === "string" ? row.beach_id : null,
        metadata: row.metadata,
      }];
    },
  );
  const weights = computeTrafficWeights(beaches, events, asOf.toISOString());

  const upsertResult = await (supabase as {
    from: (table: string) => {
      upsert: (rows: readonly Record<string, unknown>[], options: { onConflict: string }) =>
        Promise<{ error: unknown }>;
    };
  })
    .from("beach_traffic_weights")
    .upsert(
      weights.map((row) => ({
        beach_id: row.beachId,
        views_30d: row.views30d,
        weight: row.weight,
        market_key: row.marketKey,
        allocation_tier: row.allocationTier,
        computed_at: row.computedAt,
      })),
      { onConflict: "beach_id" },
    );
  if (upsertResult.error) {
    throw new Error(`Failed to materialize traffic weights: ${getErrorMessage(upsertResult.error)}`);
  }
  return weights;
}

function readPathname(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  const pathname = metadata.pathname;
  return typeof pathname === "string" ? pathname : null;
}

function increment(values: Map<string, number>, beachId: string): void {
  const normalizedId = beachId.toLowerCase();
  values.set(normalizedId, (values.get(normalizedId) ?? 0) + 1);
}

function normalizeSegment(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getMarketKey(beach: TrafficBeach): string {
  const state = normalizeSegment(beach.state);
  const city = normalizeSegment(beach.city);
  return `${state || "unknown"}:${city || "unknown"}`;
}

function isTrafficAllocationTier(value: unknown): value is TrafficAllocationTier {
  return value === "proven" || value === "adjacent" || value === "exploration";
}

function getErrorMessage(error: unknown): string {
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return String(error);
}
