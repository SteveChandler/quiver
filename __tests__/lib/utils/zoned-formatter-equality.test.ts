/**
 * Equality proof for the shared zoned formatter cache (ponytail 2026-11-23).
 * GOLDEN_SHA256 is the hash of what each caller returned on origin/main f09d54000
 * (5 zones x 276 instants x 10 callers), before the per-file caches moved onto
 * lib/utils/zoned-formatter.ts.
 */
import { createHash } from "node:crypto";
import { formatTideWhen } from "@/lib/domains/scoring/tide-swing";
import { localDateTimeToUTC } from "@/lib/utils/forecast-time-resolver";
import { getLocalDateString } from "@/lib/utils/timezone-utils";
import { formatClock12, formatWindowLabel } from "@/lib/notifications/copy/daily-call-copy";
import { whenPhrase } from "@/lib/services/discovery/swell-tracking";
import {
  getLocalDateFormatter,
  getLocalHourFormatter,
  getLocalTimeLabelFormatter,
} from "@/lib/services/discovery/window-selector/time-slot-utils";
import { formatTimelineBubble } from "@/components/map/hourly-swell-timeline";

const GOLDEN_SHA256 = "87b24645d846d4ec2374e36664cbc15bf4f6a3f7068e4890ead789bf6906ef34";

// Beach zones Quiver serves, plus a zone that throws in Intl.
const ZONES = ["America/Los_Angeles", "Pacific/Honolulu", "America/New_York", "America/Puerto_Rico"];
const BAD_ZONE = "Not/AZone";

// Every 47 minutes across both 2026 DST changes and one plain winter day.
function instants(): Date[] {
  const out: Date[] = [];
  for (const startIso of ["2026-03-07T00:00:00Z", "2026-10-31T00:00:00Z", "2026-12-20T00:00:00Z"]) {
    const start = Date.parse(startIso);
    for (let ms = start; ms < start + 3 * 86_400_000; ms += 47 * 60_000) out.push(new Date(ms));
  }
  return out;
}

function attempt<T>(run: () => T): T | string {
  try {
    return run();
  } catch (error) {
    return `throws ${(error as Error).name}`;
  }
}

function outputs(): Record<string, unknown[]> {
  const at = instants();
  const now = new Date("2026-11-01T15:00:00Z");
  const result: Record<string, unknown[]> = {};
  for (const zone of [...ZONES, BAD_ZONE]) {
    result[zone] = at.map((date, index) => {
      const iso = date.toISOString();
      const end = new Date(date.getTime() + ((index % 5) + 1) * 3_600_000).toISOString();
      return {
        tideWhen: attempt(() => formatTideWhen(date, (index % 7) * 0.75, zone)),
        localDateString: attempt(() => getLocalDateString(date, zone)),
        clock12: attempt(() => formatClock12(iso, zone)),
        windowLabel: attempt(() => formatWindowLabel(iso, end, zone, { forBody: index % 2 === 0 })),
        whenPhrase: attempt(() => whenPhrase(iso, zone, now)),
        slotDate: attempt(() => getLocalDateFormatter(zone).format(date)),
        slotHour: attempt(() => getLocalHourFormatter(zone).format(date)),
        slotTimeLabel: attempt(() => getLocalTimeLabelFormatter(zone).format(date)),
        timelineBubble: attempt(() => formatTimelineBubble(iso, zone)),
        wallToUtc: attempt(() => localDateTimeToUTC(iso.slice(0, 10), iso.slice(11, 19), zone).toISOString()),
      };
    });
  }
  return result;
}

describe("shared zoned formatter cache", () => {
  it("returns exactly what the per-file caches returned on origin/main", () => {
    const hash = createHash("sha256").update(JSON.stringify(outputs())).digest("hex");
    expect(hash).toBe(GOLDEN_SHA256);
  });

  it("returns the same output on a second, cached call", () => {
    expect(JSON.stringify(outputs())).toBe(JSON.stringify(outputs()));
  });
});
