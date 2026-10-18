/** @jest-environment node */
import { processRainAdvisoryPushes } from "@/lib/services/water-quality/rain-advisory-push";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";
import { enqueueNotification } from "@/lib/notifications/enqueue";

jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: jest.fn() }));
jest.mock("@/lib/services/water-quality/current-status", () => ({
  ...jest.requireActual("@/lib/services/water-quality/current-status"),
  currentWaterQuality: jest.fn(),
}));

const eventId = "11111111-1111-4111-8111-111111111111";
const beachA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const beachB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const beachOutside = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = new Date("2026-10-18T12:00:00Z");
const baseEvent = {
  id: eventId, region: "san_diego", source: "county_general", status: "active",
  started_at: "2026-10-18T11:00:00Z", last_rain_at: null,
  expires_at: "2026-10-21T11:00:00Z", ended_at: null, end_reason: null,
  sources: {}, created_at: "2026-10-18T11:05:00Z", updated_at: "2026-10-18T11:05:00Z",
};
const beaches = [
  { id: beachA, slug: "ocean-beach", name: "Ocean Beach", lat: 32.75, lon: -117.25 },
  { id: beachB, slug: "la-jolla", name: "La Jolla", lat: 32.85, lon: -117.27 },
  { id: beachOutside, slug: "malibu", name: "Malibu", lat: 34.03, lon: -118.68 },
];
const profiles = [
  { id: "user-a", home_beach_id: beachA, notif_water_quality: true, is_mock: false },
  { id: "user-b", home_beach_id: beachB, notif_water_quality: true, is_mock: false },
  { id: "user-off", home_beach_id: beachA, notif_water_quality: false, is_mock: false },
  { id: "user-mock", home_beach_id: beachA, notif_water_quality: true, is_mock: true },
  { id: "user-outside", home_beach_id: beachOutside, notif_water_quality: true, is_mock: false },
];

function fakeClient(options: {
  events?: Record<string, unknown>[];
  starts?: string[];
  held?: string[];
  failTable?: string;
  missingEvents?: boolean;
} = {}) {
  const ledger = new Set((options.starts ?? []).map((user) => `${user}|water_quality|rain_advisory:${eventId}:start:${user}`));
  const from = jest.fn((table: string) => {
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const query: Record<string, unknown> = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn((column: string, value: unknown) => { filters.push((row) => row[column] === value); return query; });
    query.gte = jest.fn((column: string, value: string | number) => { filters.push((row) => row[column] != null &&
      (typeof value === "number" ? Number(row[column]) >= value : String(row[column]) >= value)); return query; });
    query.lte = jest.fn((column: string, value: number) => { filters.push((row) => row[column] != null && Number(row[column]) <= value); return query; });
    query.in = jest.fn((column: string, values: string[]) => { filters.push((row) => values.includes(row[column] as string)); return query; });
    query.then = (resolve: (value: unknown) => unknown) => {
      const all: Record<string, unknown>[] = table === "rain_advisory_events" ? options.events ?? [baseEvent]
        : table === "beaches" ? beaches
          : table === "profiles" ? profiles
            : table === "notification_events" ? [...ledger].map((entry) => {
              const [recipient_user_id, type, dedupe_key] = entry.split("|");
              return { recipient_user_id, type, dedupe_key };
            })
              : table === "water_quality_held_beaches" ? (options.held ?? []).map((beach_id) => ({ beach_id }))
                : table === "beach_water_quality" ? [] : [];
      const error = table === options.failTable ? { code: "XX000", message: "read failed" }
        : table === "rain_advisory_events" && options.missingEvents ? { code: "PGRST205", message: "missing" } : null;
      return Promise.resolve(resolve({ data: error ? null : all.filter((row) => filters.every((filter) => filter(row))), error }));
    };
    return query;
  });
  jest.mocked(enqueueNotification).mockImplementation(async (args) => {
    const key = `${args.recipientUserId}|${args.type}|${args.dedupeKey}`;
    if (ledger.has(key)) return { enqueued: false, reason: "duplicate" };
    ledger.add(key);
    return { enqueued: true, eventId: `queued-${ledger.size}` };
  });
  return { client: { from } as never, from, ledger };
}

beforeEach(() => {
  process.env.RAIN_ADVISORY_PUSH_ENABLED = "true";
  jest.clearAllMocks();
  jest.mocked(currentWaterQuality).mockImplementation(async (rows) => rows.map((row) =>
    ({ ...row, county_advisory_status: "clear" as const })));
});
afterAll(() => { delete process.env.RAIN_ADVISORY_PUSH_ENABLED; });

it("does no reads or enqueues when the flag is off", async () => {
  delete process.env.RAIN_ADVISORY_PUSH_ENABLED;
  const { client, from } = fakeClient();
  expect(await processRainAdvisoryPushes(client, now)).toEqual({ status: "disabled" });
  expect(from).not.toHaveBeenCalled();
  expect(enqueueNotification).not.toHaveBeenCalled();
});

it("enqueues one start per eligible home beach user and dedupes the next tick", async () => {
  const { client } = fakeClient();
  const first = await processRainAdvisoryPushes(client, now);
  const second = await processRainAdvisoryPushes(client, now);
  expect(first).toMatchObject({ status: "ok", started: { enqueued: 2, duplicates: 0 } });
  // The second tick finds both dedupe keys and enqueues nothing.
  expect(second).toMatchObject({ status: "ok", started: { enqueued: 0, duplicates: 0 } });
  expect(jest.mocked(enqueueNotification).mock.calls.map(([args]) => args.recipientUserId)).toEqual([
    "user-a", "user-b",
  ]);
  expect(jest.mocked(enqueueNotification).mock.calls[0][0]).toMatchObject({
    type: "water_quality", dedupeKey: `rain_advisory:${eventId}:start:user-a`,
    payload: { status: "advisory", previous_status: null, rain_advisory: { phase: "start" } },
  });
});

it("targets only beaches assigned to a METAR cluster", async () => {
  const event = { ...baseEvent, id: "22222222-2222-4222-8222-222222222222",
    region: "malibu_santa_monica", source: "metar_runoff", last_rain_at: baseEvent.started_at };
  const { client } = fakeClient({ events: [event] });
  expect(await processRainAdvisoryPushes(client, now)).toMatchObject({ status: "ok", started: { enqueued: 1 } });
  expect(jest.mocked(enqueueNotification).mock.calls[0][0].recipientUserId).toBe("user-outside");
});

it("sends an all-clear only to users with a start, once", async () => {
  const ended = { ...baseEvent, status: "ended", started_at: "2026-10-15T11:00:00Z",
    created_at: "2026-10-15T11:05:00Z", ended_at: "2026-10-18T11:00:00Z", end_reason: "dry_72h" };
  const { client } = fakeClient({ events: [ended], starts: ["user-a"] });
  const first = await processRainAdvisoryPushes(client, now);
  const second = await processRainAdvisoryPushes(client, now);
  expect(first).toMatchObject({ status: "ok", ended: { enqueued: 1, duplicates: 0 } });
  expect(second).toMatchObject({ status: "ok", ended: { enqueued: 0, duplicates: 0 } });
  expect(jest.mocked(enqueueNotification).mock.calls.map(([args]) => args.recipientUserId)).toEqual(["user-a"]);
  expect(jest.mocked(enqueueNotification).mock.calls[0][0]).toMatchObject({
    dedupeKey: `rain_advisory:${eventId}:end:user-a`,
    payload: { status: "good", previous_status: "advisory", rain_advisory: { phase: "end", end_reason: "dry_72h" } },
  });
});

it("sends San Diego all-clears while the County still lists the expired streak", async () => {
  const ended = { ...baseEvent, status: "ended", ended_at: "2026-10-18T11:30:00Z", end_reason: "dry_72h" };
  // After a dry end the projection marks general rows expired (no County status) and
  // returns owner-held rows untouched; neither means the County read failed.
  jest.mocked(currentWaterQuality).mockImplementation(async (rows) => rows.map((row) =>
    row.beach_id === beachA ? { ...row } : { ...row, status: "unknown", county_general_expired: true }));
  const { client } = fakeClient({ events: [ended], starts: ["user-a", "user-b"], held: [beachA] });
  expect(await processRainAdvisoryPushes(client, now)).toMatchObject({ status: "ok", ended: { enqueued: 1 }, errors: [] });
  expect(jest.mocked(enqueueNotification).mock.calls.map(([args]) => args.recipientUserId)).toEqual(["user-b"]);
});

it.each(["closure", "advisory"])("suppresses all-clear for County %s", async (status) => {
  const ended = { ...baseEvent, status: "ended", ended_at: "2026-10-18T11:30:00Z", end_reason: "county_lifted" };
  jest.mocked(currentWaterQuality).mockImplementation(async (rows) => rows.map((row) =>
    ({ ...row, county_advisory_status: row.beach_id === beachA ? status as "closure" | "advisory" : "clear" as const })));
  const { client } = fakeClient({ events: [ended], starts: ["user-a", "user-b"] });
  expect(await processRainAdvisoryPushes(client, now)).toMatchObject({ status: "ok", ended: { enqueued: 1 } });
  expect(jest.mocked(enqueueNotification).mock.calls[0][0].recipientUserId).toBe("user-b");
});

it("suppresses all-clear for a sample advisory and a failed status projection", async () => {
  const ended = { ...baseEvent, status: "ended", ended_at: "2026-10-18T11:30:00Z", end_reason: "county_lifted" };
  jest.mocked(currentWaterQuality).mockImplementation(async (rows) => rows.map((row) => ({
    ...row, status: row.beach_id === beachA ? "advisory" : row.status,
    county_advisory_status: "clear" as const,
  })));
  const { client } = fakeClient({ events: [ended], starts: ["user-a", "user-b"] });
  expect(await processRainAdvisoryPushes(client, now)).toMatchObject({ status: "ok", ended: { enqueued: 1 } });
  jest.mocked(enqueueNotification).mockClear();
  jest.mocked(currentWaterQuality).mockImplementation(async (rows) => [...rows]);
  const failed = fakeClient({ events: [ended], starts: ["user-a", "user-b"] });
  expect(await processRainAdvisoryPushes(failed.client, now)).toMatchObject({ status: "ok", ended: { enqueued: 0 } });
  expect(enqueueNotification).not.toHaveBeenCalled();
});

it("suppresses all-clear for an owner hold and for a failed hold read", async () => {
  const ended = { ...baseEvent, status: "ended", ended_at: "2026-10-18T11:30:00Z", end_reason: "county_lifted" };
  const held = fakeClient({ events: [ended], starts: ["user-a", "user-b"], held: [beachA] });
  expect(await processRainAdvisoryPushes(held.client, now)).toMatchObject({ status: "ok", ended: { enqueued: 1 } });
  expect(jest.mocked(enqueueNotification).mock.calls[0][0].recipientUserId).toBe("user-b");
  jest.mocked(enqueueNotification).mockClear();
  const failed = fakeClient({ events: [ended], starts: ["user-a", "user-b"], failTable: "water_quality_held_beaches" });
  expect(await processRainAdvisoryPushes(failed.client, now)).toMatchObject({ status: "ok", ended: { enqueued: 0 } });
  expect(enqueueNotification).not.toHaveBeenCalled();
});

it("skips backfilled events and degrades when the event table is absent", async () => {
  const { client } = fakeClient({ events: [{ ...baseEvent, created_at: "2026-10-21T11:00:00Z" }] });
  expect(await processRainAdvisoryPushes(client, now)).toMatchObject({ status: "ok", started: { enqueued: 0, skipped: 1 } });
  expect(enqueueNotification).not.toHaveBeenCalled();
  const ended = fakeClient({ events: [{ ...baseEvent, status: "ended", ended_at: "2026-10-18T11:30:00Z",
    end_reason: "dry_72h", started_at: "2026-10-15T11:00:00Z" }], starts: ["user-a"] });
  expect(await processRainAdvisoryPushes(ended.client, now)).toMatchObject({ status: "ok", ended: { enqueued: 0, skipped: 1 } });
  expect(enqueueNotification).not.toHaveBeenCalled();
  const missing = fakeClient({ missingEvents: true });
  expect(await processRainAdvisoryPushes(missing.client, now)).toEqual({ status: "table_missing" });
  expect(enqueueNotification).not.toHaveBeenCalled();
});
