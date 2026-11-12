import Link from "next/link";

import { stationPath } from "@/lib/buoy-pages/geo-names";
import { isMissingCatalogueError } from "@/lib/buoy-pages/source";
import { withinNearbyRadius } from "@/lib/buoy-pages/station-page-data";
import { getNearbyStations, type NearbyWaveStation } from "@/lib/services/wave-stations";

interface NearbyBuoysSlotProps {
  lat: number;
  lon: number;
}

const FETCH_LIMIT = 8;
const SHOW_LIMIT = 4;

/** Nearest wave buoys by the buoy pages' own 300/600 km rule; empty on any read failure. */
async function loadNearbyBuoys(lat: number, lon: number): Promise<NearbyWaveStation[]> {
  try {
    const nearby = await getNearbyStations(lat, lon, FETCH_LIMIT);
    return withinNearbyRadius([...nearby].sort((a, b) => a.distance_km - b.distance_km)).slice(0, SHOW_LIMIT);
  } catch (error) {
    // A side block never fails the tide page; only a missing catalogue stays quiet.
    if (!isMissingCatalogueError(error)) {
      console.warn("Nearby buoys for tide station failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return [];
  }
}

/**
 * Name, distance and link only. Tide pages revalidate every 12 h, so a live
 * wave reading baked in here would read as current when it is not.
 */
export async function NearbyBuoysSlot({ lat, lon }: NearbyBuoysSlotProps) {
  const buoys = await loadNearbyBuoys(lat, lon);
  if (!buoys.length) return null;
  return (
    <section aria-labelledby="buoys-heading" className="mt-10" data-testid="tide-nearby-buoys">
      <h2 id="buoys-heading" className="font-heading text-xl font-bold">Nearby wave buoys</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {buoys.map((buoy) => (
          <li key={buoy.id}>
            <Link
              href={stationPath(buoy.slug)}
              className="flex justify-between gap-3 border-b border-dashed border-[#11100D]/30 py-2 hover:text-[#AA4918]"
            >
              <span className="font-semibold">{buoy.name}</span>
              <span className="font-mono text-xs text-[#11100D]/60">{Math.round(buoy.distance_km)} km</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
