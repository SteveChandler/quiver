/**
 * Which tide source a beach may draw on, decided by country before any
 * station lookup runs.
 *
 * NOAA CO-OPS only serves US waters. Every nearest-station and name-match
 * fallback in this repo assumes a US beach: without this gate a Canadian
 * beach resolves to the closest NOAA gauge across the border (Long Beach,
 * Pacific Rim sits about 110 km from Neah Bay, inside the refresh cron's
 * 120 km radius) and Admiralty Inlet heights get labelled with an open-coast
 * station's datum. Issue #717 (Vancouver Island coverage) requires an explicit
 * Canadian station binding before any NOAA fallback. That binding and the CHS
 * adapter do not exist yet, so Canada resolves to `unavailable`: the beach
 * row can exist, but no tide series is written or fetched for it.
 *
 * Mexico keeps its existing behaviour on purpose: Baja Norte beaches read the
 * San Diego gauge by design and Baja Sur beaches carry FES2022 constituents
 * (`model-tides.ts`), so they stay on the NOAA-then-model path.
 */

import { normalizeBeachCountry } from "@/lib/utils/beach-url-utils";

type TideProvider = "noaa_coops" | "unavailable";

// Beach rows store the full country name ("USA", "Mexico", "Canada"); a bare
// "CA" is never Canada here because #717 reserves it for the California
// routing collision.
const COUNTRIES_WITHOUT_TIDE_PROVIDER = new Set(["canada"]);

export function getTideProviderForCountry(
  country: string | null | undefined,
): TideProvider {
  const normalized = normalizeBeachCountry(country)?.toLowerCase();
  if (!normalized) return "noaa_coops";
  return COUNTRIES_WITHOUT_TIDE_PROVIDER.has(normalized) ? "unavailable" : "noaa_coops";
}

/** True when NOAA CO-OPS station resolution may run for this beach. */
export function hasNoaaTideCoverage(beach: {
  country?: string | null;
}): boolean {
  return getTideProviderForCountry(beach.country) === "noaa_coops";
}
