export const SWELL_BEACH_ID = "402ec6ad-4e80-47d2-882f-5053eb9aa433";
export const SWELL_EVENT_KEY = `${SWELL_BEACH_ID}:NW:2026-10-08`;
export const SWELL_NOW = new Date("2026-10-04T18:00:00.000Z");

export interface SwellSnapshotFixture {
  run_date: string;
  detected_at: string;
  direction_deg: number;
  period_s: number;
  peak_face_height_ft: number;
  arrival_at: string;
  peak_at: string;
  fade_at: string | null;
}

export function swellSnapshot(
  overrides: Partial<SwellSnapshotFixture> = {},
): SwellSnapshotFixture {
  return {
    run_date: "2026-10-03",
    detected_at: "2026-10-03T14:30:00.000Z",
    direction_deg: 300,
    period_s: 14.2,
    peak_face_height_ft: 5.6,
    arrival_at: "2026-10-08T06:00:00.000Z",
    peak_at: "2026-10-08T15:00:00.000Z",
    fade_at: "2026-10-09T12:00:00.000Z",
    ...overrides,
  };
}

export const SWELL_BEACH_ROW = {
  id: SWELL_BEACH_ID,
  name: "Trinidad State Beach",
  slug: "trinidad-state-beach-ca",
  timezone: "America/Los_Angeles",
};

interface FakeSwellDb {
  snapshots?: SwellSnapshotFixture[];
  beach?: Record<string, unknown> | null;
  snapshotError?: string;
}

/** Minimal PostgREST-shaped client for the two reads loadSwellShareEvent makes. */
export function fakeSwellSupabase(db: FakeSwellDb): any {
  const filters: Array<[string, unknown]> = [];
  return {
    filters,
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([`${table}.${column}`, value]);
          return builder;
        },
        order: () => builder,
        limit: () =>
          Promise.resolve(
            db.snapshotError
              ? { data: null, error: { message: db.snapshotError } }
              : {
                  // Newest first, as the query orders it.
                  data: [...(db.snapshots ?? [])].sort((a, b) =>
                    b.run_date.localeCompare(a.run_date),
                  ),
                  error: null,
                },
          ),
        maybeSingle: () =>
          Promise.resolve({ data: db.beach === undefined ? SWELL_BEACH_ROW : db.beach, error: null }),
      };
      return builder;
    },
  };
}
