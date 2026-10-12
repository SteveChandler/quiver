import { z } from "zod";
import { COUNTY_FEED_COVERAGE_BOUNDS } from "@/lib/services/county-beach-advisories/types";
import { memoizedWaterQualityRead } from "@/lib/recommendations/major-event-hold/read-scope";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";

export interface BeachPoint {
  lat: number | null;
  lon: number | null;
}

const beachPointSchema = z.object({
  id: z.string().transform((value) => value.toLowerCase()),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

/** Coordinates for the requested beaches, keyed by lowercase id. Null when the read fails. */
export async function readBeachPoints(
  client: WaterQualityHoldClient,
  beachIds: readonly string[],
  logTag: string,
): Promise<Map<string, BeachPoint> | null> {
  const located = new Map<string, BeachPoint>();
  for (let offset = 0; offset < beachIds.length; offset += 100) {
    const chunk = beachIds.slice(offset, offset + 100);
    const result = await memoizedWaterQualityRead(
      client,
      `beaches|id, lat, lon|${chunk.join(",")}`,
      () => client.from("beaches").select("id, lat, lon").in("id", chunk),
    );
    if ((result.error !== null && result.error !== undefined) || !Array.isArray(result.data)) {
      console.error(logTag, {
        beachCount: beachIds.length,
        error:
          typeof result.error === "object" &&
          result.error !== null &&
          "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : String(result.error ?? "invalid response shape"),
      });
      return null;
    }
    for (const row of result.data) {
      const parsed = beachPointSchema.safeParse(row);
      if (parsed.success) located.set(parsed.data.id, { lat: parsed.data.lat, lon: parsed.data.lon });
    }
  }
  return located;
}

/** A beach without coordinates counts as covered so it fails closed. */
export function insideCountyFeed(point: BeachPoint | undefined): boolean {
  if (!point || point.lat === null || point.lon === null) return true;
  const bounds = COUNTY_FEED_COVERAGE_BOUNDS;
  return point.lat >= bounds.minLat && point.lat <= bounds.maxLat &&
    point.lon >= bounds.minLon && point.lon <= bounds.maxLon;
}
