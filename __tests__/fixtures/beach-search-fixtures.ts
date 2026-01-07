/**
 * Beach Search Test Fixtures
 *
 * Small, deterministic Beach fixtures for testing search + matching logic.
 * Prefer these over large fixtures so ordering/scoring assertions stay clear.
 */

import type { Beach } from "@/types/database";
import { createMockBeach } from "../setup/typed-mocks";

export function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return createMockBeach({
    // Stable defaults (avoid Date.now() noise in snapshots/debugging)
    id: "beach-test",
    name: "Test Beach",
    slug: "test-beach",
    city: "San Diego",
    state: "CA",
    ...overrides,
  });
}

export const beachBlacksPunctuated = makeBeach({
  id: "beach-blacks-punctuated",
  name: "Black's Beach",
  slug: "blacks-beach",
  city: "San Diego",
  state: "CA",
});

export const beachBlacksPlain = makeBeach({
  id: "beach-blacks-plain",
  name: "Blacks Beach",
  slug: "blacks-beach-plain",
  city: "San Diego",
  state: "CA",
});

export const beachPacificBeach = makeBeach({
  id: "beach-pacific-beach",
  name: "Pacific Beach",
  slug: "pacific-beach",
  city: "San Diego",
  state: "CA",
});

export const beachPacificBeachPier = makeBeach({
  id: "beach-pb-pier",
  name: "Pacific Beach Pier",
  slug: "pacific-beach-pier",
  city: "San Diego",
  state: "CA",
});

export const beachOceanBeach = makeBeach({
  id: "beach-ocean-beach",
  name: "Ocean Beach",
  slug: "ocean-beach",
  city: "San Diego",
  state: "CA",
});

export const beachLaJollaShores = makeBeach({
  id: "beach-la-jolla-shores",
  name: "La Jolla Shores",
  slug: "la-jolla-shores",
  city: "La Jolla",
  state: "CA",
});

export const beachScrippsPier = makeBeach({
  id: "beach-scripps-pier",
  name: "Scripps Pier",
  slug: "scripps-pier",
  city: "La Jolla",
  state: "CA",
});

export const beachHuntington = makeBeach({
  id: "beach-huntington",
  name: "Huntington Beach",
  slug: "huntington-beach",
  city: "Huntington Beach",
  state: "CA",
});

export const beachesSearchFixture: Beach[] = [
  beachBlacksPunctuated,
  beachBlacksPlain,
  beachPacificBeach,
  beachPacificBeachPier,
  beachOceanBeach,
  beachLaJollaShores,
  beachScrippsPier,
  beachHuntington,
];





