import { describe, expect, it } from "@jest/globals";

import {
  BriefingInputError,
  bodyScalePhrase,
  buildBriefingInput,
  compassLabel,
  exposureFor,
  localDate,
  windKindFor,
} from "../swell-briefing-input";

const SOUTH_FACING = { id: "a", name: "A", aspect_deg: 225, wind_offshore_deg: null, wind_offshore_tol_deg: null };

describe("exposureFor", () => {
  it("separates San Diego's southwest-facing breaks from its west-facing ones", () => {
    // The real range of aspect_deg across San Diego beaches is 220-298.
    expect(exposureFor(220)).toBe("south_facing");
    expect(exposureFor(246)).toBe("south_facing");
    expect(exposureFor(250)).toBe("west_facing");
    expect(exposureFor(284)).toBe("west_facing");
    expect(exposureFor(298)).toBe("northwest_facing");
  });

  it("leaves a beach out rather than guessing when the aspect is unknown", () => {
    expect(exposureFor(null)).toBeNull();
    expect(exposureFor(Number.NaN)).toBeNull();
  });

  it("has no exposure for a coast facing away from the ocean here", () => {
    expect(exposureFor(90)).toBeNull();
  });
});

describe("windKindFor", () => {
  it("calls wind off the land offshore", () => {
    // A beach facing 225 is offshore from 45.
    expect(windKindFor(SOUTH_FACING, 45, 10)).toBe("offshore");
  });

  it("calls wind off the water onshore", () => {
    expect(windKindFor(SOUTH_FACING, 225, 15)).toBe("onshore");
  });

  it("calls the sideways case cross-shore", () => {
    expect(windKindFor(SOUTH_FACING, 135, 12)).toBe("cross");
  });

  it("treats a barely-moving wind as light and variable whatever its bearing", () => {
    expect(windKindFor(SOUTH_FACING, 225, 2)).toBe("light_variable");
  });

  it("says unknown rather than inventing a direction", () => {
    expect(windKindFor(SOUTH_FACING, null, 10)).toBe("unknown");
    const noAspect = { ...SOUTH_FACING, aspect_deg: null };
    expect(windKindFor(noAspect, 45, 10)).toBe("unknown");
  });
});

describe("bodyScalePhrase", () => {
  it("names one height when the range sits in a single band", () => {
    expect(bodyScalePhrase({ min: 2.1, max: 2.6 })).toBe("waist high");
  });

  it("spans two bands with an en dash, as the native copy does", () => {
    expect(bodyScalePhrase({ min: 2.5, max: 3.5 })).toBe("waist – chest");
  });

  it("does not append 'high' to a phrase that already reads as one", () => {
    expect(bodyScalePhrase({ min: 5.5, max: 6.5 })).toBe("head high");
  });

  it("is null when nothing was measured", () => {
    expect(bodyScalePhrase(null)).toBeNull();
  });
});

describe("compassLabel", () => {
  it("names the cardinal and intercardinal points", () => {
    expect(compassLabel(0)).toBe("N");
    expect(compassLabel(202)).toBe("SSW");
    expect(compassLabel(215)).toBe("SW");
    expect(compassLabel(270)).toBe("W");
  });

  it("wraps past a full turn rather than running off the end", () => {
    expect(compassLabel(360)).toBe("N");
    expect(compassLabel(-45)).toBe("NW");
  });
});

describe("localDate", () => {
  it("resolves the Pacific calendar day, not the UTC one", () => {
    // 06:00 UTC on the 26th is still 23:00 on the 25th in California (PDT).
    expect(localDate(new Date("2026-10-26T06:00:00Z"), "America/Los_Angeles")).toBe("2026-10-25");
    expect(localDate(new Date("2026-10-26T18:00:00Z"), "America/Los_Angeles")).toBe("2026-10-26");
  });
});

/* --------------------------------------------------- buildBriefingInput */

/** PostgREST's `max_rows` (supabase/config.toml), which truncates silently. */
const SERVER_MAX_ROWS = 1000;
const HOUR_MS = 60 * 60 * 1000;
/** San Diego's briefing region holds 53 beaches. */
const BRIEFING_BEACHES = 53;
/** Monday 2026-10-26, 08:00 in San Diego (PDT). */
const NOW = new Date("2026-10-26T15:00:00Z");

interface FakeBeach {
  id: string;
  name: string;
  aspect_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
}

interface FakeForecast {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
  swell_period_om: number | null;
  swell_direction_om: number | null;
  wind_speed: string | null;
  wind_direction_deg: string | number | null;
  om_fetched_at: string | null;
  wind_model_run_at: string | null;
  updated_at: string | null;
}

interface Call {
  method: string;
  args: unknown[];
}

function beachId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/** West-facing, so east (90) is offshore and west (270) is onshore. */
function westFacingBeach(index: number): FakeBeach {
  return {
    id: beachId(index),
    name: `Beach ${index}`,
    aspect_deg: 270,
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
  };
}

function forecast(beach: string, at: string, over: Partial<FakeForecast> = {}): FakeForecast {
  return {
    beach_id: beach,
    forecast_at: at,
    wave_height: "3 ft",
    swell_period_om: 14,
    swell_direction_om: 270,
    wind_speed: "8 mph",
    wind_direction_deg: 270,
    om_fetched_at: "2026-10-26T12:00:00.000Z",
    wind_model_run_at: null,
    updated_at: null,
    ...over,
  };
}

/** A three-hourly grid across the whole read window, for every beach. */
function gridRows(beaches: FakeBeach[]): FakeForecast[] {
  const rows: FakeForecast[] = [];
  const start = NOW.getTime() - 12 * HOUR_MS;
  const end = NOW.getTime() + 8 * 24 * HOUR_MS;
  for (let at = start; at <= end; at += 3 * HOUR_MS) {
    for (const beach of beaches) {
      rows.push(forecast(beach.id, new Date(at).toISOString()));
    }
  }
  return rows;
}

function compareBy(column: string, ascending: boolean) {
  return (a: FakeForecast, b: FakeForecast): number => {
    const left = String(a[column as keyof FakeForecast]);
    const right = String(b[column as keyof FakeForecast]);
    const order = left < right ? -1 : left > right ? 1 : 0;
    return ascending ? order : -order;
  };
}

/**
 * A Supabase client that answers the way PostgREST does: ordered, ranged when a
 * range is asked for, and never more than `max_rows` in one response whatever
 * was asked for - with no error to say so.
 */
function fakeClient(args: {
  beaches: FakeBeach[];
  forecasts: FakeForecast[];
  homeBeachId?: string | null;
  failForecastPage?: number;
}) {
  const forecastRequests: Call[][] = [];

  const forecastResult = (calls: Call[]) => {
    forecastRequests.push(calls);
    if (args.failForecastPage === forecastRequests.length) {
      return { data: null, error: { message: "boom" } };
    }
    let rows = [...args.forecasts];
    const orders = calls.filter((call) => call.method === "order");
    // Apply the requested keys right to left so the first one is primary.
    for (const order of [...orders].reverse()) {
      const options = (order.args[1] ?? {}) as { ascending?: boolean };
      rows = rows.sort(compareBy(String(order.args[0]), options.ascending !== false));
    }
    const range = calls.find((call) => call.method === "range");
    const from = range ? Number(range.args[0]) : 0;
    const to = range ? Number(range.args[1]) : Number.POSITIVE_INFINITY;
    const end = Math.min(to + 1, from + SERVER_MAX_ROWS);
    return { data: rows.slice(from, end), error: null };
  };

  const resultFor = (table: string, calls: Call[]) => {
    if (table === "beaches") return { data: args.beaches, error: null };
    if (table === "profiles") {
      return { data: { home_beach_id: args.homeBeachId ?? args.beaches[0].id }, error: null };
    }
    if (table === "enhanced_forecasts") return forecastResult(calls);
    // swell_briefing_inputs: nothing issued yet, and the save succeeds.
    return { data: null, error: null };
  };

  const builder = (table: string) => {
    const calls: Call[] = [];
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
              Promise.resolve(resultFor(table, calls)).then(onFulfilled, onRejected);
          }
          return (...callArgs: unknown[]) => {
            calls.push({ method: String(prop), args: callArgs });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const client = { from: (table: string) => builder(table) };
  return {
    client: client as unknown as Parameters<typeof buildBriefingInput>[0]["client"],
    forecastRequests,
  };
}

async function build(args: Parameters<typeof fakeClient>[0]) {
  const fake = fakeClient(args);
  const snapshot = await buildBriefingInput({
    client: fake.client,
    userId: "11111111-1111-4111-8111-111111111111",
    regionSlug: "san-diego",
    now: NOW,
  });
  return { snapshot, forecastRequests: fake.forecastRequests };
}

describe("buildBriefingInput forecast read", () => {
  it("reads past PostgREST's row cap so the whole week is populated", async () => {
    // 53 beaches x 8 rows a day x ~8.5 days is ~3,600 rows, several times what
    // one response holds. A single read ends early on Wednesday and leaves
    // Thursday through Sunday looking uncertain.
    const beaches = Array.from({ length: BRIEFING_BEACHES }, (_, index) => westFacingBeach(index));
    const forecasts = gridRows(beaches);
    expect(forecasts.length).toBeGreaterThan(SERVER_MAX_ROWS);

    const { snapshot, forecastRequests } = await build({ beaches, forecasts });

    expect(snapshot.briefing.week.map((day) => [day.date, day.uncertain, day.surfFt])).toEqual(
      ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]
        .map((date) => [date, false, { min: 3, max: 3 }]),
    );
    expect(forecastRequests.length).toBeGreaterThan(1);
  });

  it("pages in a total order, so no row is skipped or read twice", async () => {
    const beaches = Array.from({ length: BRIEFING_BEACHES }, (_, index) => westFacingBeach(index));
    const { forecastRequests } = await build({ beaches, forecasts: gridRows(beaches) });

    for (const calls of forecastRequests) {
      const orders = calls.filter((call) => call.method === "order").map((call) => call.args[0]);
      expect(orders).toEqual(["forecast_at", "beach_id"]);
    }
    const ranges = forecastRequests.map((calls) => calls.find((call) => call.method === "range")?.args);
    expect(ranges[0]).toEqual([0, SERVER_MAX_ROWS - 1]);
    expect(ranges[1]).toEqual([SERVER_MAX_ROWS, 2 * SERVER_MAX_ROWS - 1]);
  });

  it("fails the read rather than issuing a partial week when a later page errors", async () => {
    const beaches = Array.from({ length: BRIEFING_BEACHES }, (_, index) => westFacingBeach(index));
    await expect(build({ beaches, forecasts: gridRows(beaches), failForecastPage: 2 }))
      .rejects.toThrow(new BriefingInputError("forecast_read_failed"));
  });
});

describe("buildBriefingInput next 48 hours wind", () => {
  const home = westFacingBeach(0);
  // Tuesday 2026-10-27 in San Diego (PDT, UTC-7).
  const tuesdayAt = (localHour: number): string =>
    new Date(Date.UTC(2026, 9, 27, localHour + 7)).toISOString();

  async function tuesdayAm(rows: FakeForecast[]) {
    const { snapshot } = await build({ beaches: [home], forecasts: rows });
    const tuesday = snapshot.briefing.next48.find((day) => day.date === "2026-10-27");
    return { snapshot, tuesday, am: tuesday?.periods.find((period) => period.period === "am") };
  }

  it("reads offshore-then-onshore as the dawn offshore, not unknown", async () => {
    // Ocean Beach Pier, Tue Oct 27: equal winds from opposite sides cancel
    // when averaged as vectors, which is what used to print WIND UNKNOWN.
    const { snapshot, tuesday, am } = await tuesdayAm([
      forecast(home.id, tuesdayAt(8), { wind_direction_deg: 90, wind_speed: "5 mph" }),
      forecast(home.id, tuesdayAt(11), { wind_direction_deg: 270, wind_speed: "5 mph" }),
      forecast(home.id, tuesdayAt(14), { wind_direction_deg: 270, wind_speed: "12 mph" }),
    ]);

    expect(am).toMatchObject({ kind: "offshore", label: "OFFSHORE", directionDeg: 90, speedMph: 5 });
    expect(tuesday?.note).toBe("Cleanest early.");
    const factIds = snapshot.copyFacts.map((fact) => fact.id);
    expect(factIds).toContain("next48-clean-2026-10-27");
    expect(factIds).toContain("today-before-wind");
  });

  it("lets the most frequent kind win, with the bearing of its earliest row", async () => {
    const { am } = await tuesdayAm([
      forecast(home.id, tuesdayAt(6), { wind_direction_deg: 270, wind_speed: "6 mph" }),
      forecast(home.id, tuesdayAt(8), { wind_direction_deg: 80, wind_speed: "7 mph" }),
      forecast(home.id, tuesdayAt(10), { wind_direction_deg: 100, wind_speed: "9 mph" }),
    ]);

    // A vector mean of the two offshore rows would be 90; the reading is 80.
    expect(am).toMatchObject({ kind: "offshore", directionDeg: 80, speedMph: 9, speedLabel: "6 – 9 mph" });
  });

  it("is unknown only when no row in the period has a reading", async () => {
    const { tuesday, am } = await tuesdayAm([
      forecast(home.id, tuesdayAt(8), { wind_direction_deg: null, wind_speed: null }),
      forecast(home.id, tuesdayAt(10), { wind_direction_deg: null, wind_speed: "10 mph" }),
    ]);

    expect(am).toMatchObject({ kind: "unknown", label: "WIND UNKNOWN", directionDeg: null });
    expect(tuesday?.note).toBeNull();
  });

  it("still calls a period under 4 mph light and variable", async () => {
    const { am } = await tuesdayAm([
      forecast(home.id, tuesdayAt(7), { wind_direction_deg: 270, wind_speed: "2 mph" }),
      forecast(home.id, tuesdayAt(10), { wind_direction_deg: 200, wind_speed: "3 mph" }),
    ]);

    expect(am).toMatchObject({
      kind: "light_variable",
      label: "LIGHT / VARIABLE",
      speedLabel: null,
      speedMph: 3,
      directionDeg: 270,
    });
  });
});
