// __tests__/helpers/outlook-swell.ts  (shared fixture; the helpers directory is not a Jest suite)
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";

export const OUTLOOK_HOME_BEACH_ID = "ffffffff-0000-4000-8000-000000000001";
const HOME = OUTLOOK_HOME_BEACH_ID;

export function outlookSwell(overrides: Partial<OutlookSwell> = {}): OutlookSwell {
  return {
    id: `${HOME}:NW:2026-09-21:p`, eventKey: `${HOME}:NW:2026-09-21:p`, tier: "likely", status: "forecast", change: "new",
    arrivalAt: "2026-09-21T07:00:00.000Z", peakAt: "2026-09-21T15:00:00.000Z", peakWindow: null, faceHeightFt: { min: 3.5, max: 4.5 },
    periodS: 14, directionDeg: 300, directionLabel: "WNW", beach: { id: HOME, name: "Blacks Beach" }, beachCount: 3, notable: false,
    fit: { status: "in_range", boards: [] }, source: "north_pacific", stormName: null,
    sizeByOrientation: { southFacing: null, westFacing: { min: 3.5, max: 4.5 } }, history: [],
    ...overrides,
  };
}
