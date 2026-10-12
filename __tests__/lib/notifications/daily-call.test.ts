import {
  DAILY_CALL_SCHEMA_VERSION,
  parseDailyCallPayload,
} from "@/lib/notifications/types/daily-call";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

const options = [
  { beach_id: "22222222-2222-4222-8222-222222222222", beach_slug: "scripps", beach_name: "Scripps",
    window_start: "2026-09-18T16:00:00.000Z", window_end: "2026-09-18T18:00:00.000Z",
    window_local: "9–11 AM", wave_height_ft: 3.5, relation: "home" as const },
  { beach_id: "33333333-3333-4333-8333-333333333333", beach_slug: "ob-pier", beach_name: "OB Pier",
    window_start: "2026-09-18T15:00:00.000Z", window_end: "2026-09-18T17:00:00.000Z",
    window_local: "8–10 AM", wave_height_ft: null, relation: "favorite" as const },
];

const validPayload = {
  schema_version: DAILY_CALL_SCHEMA_VERSION,
  beach_id: "11111111-1111-4111-8111-111111111111",
  beach_slug: "blacks",
  beach_name: "Black's",
  alert_date: "2026-09-18",
  window_start: "2026-09-18T14:15:00.000Z",
  window_end: "2026-09-18T16:40:00.000Z",
  window_local: "7:15–~9:40",
  drivers: [
    {
      kind: "wind" as const,
      edge: "end" as const,
      at: "2026-09-18T16:40:00.000Z",
      approximate: true,
      label: "Offshore through ~9:40",
    },
  ],
  wave_height_ft: 3,
  wave_period_s: 13,
  swell_dir: "SW",
  wind_label: "Light offshore",
  tide_label: "Rising to a 9:52 high",
  reason: "Offshore through ~9:40, then it turns.",
  title: "Wind stays polite. Blacks 7:15–9:40",
  title_id: "daily-wind-1",
  comparison: null,
  swell_event_key: null,
  decision_id: "decision-1",
  session_decision: { verdict: "go" },
};

describe("dailyCallPayloadSchema", () => {
  it("parses a valid daily call payload", () => {
    expect(parseDailyCallPayload(validPayload)).toEqual(validPayload);
  });

  it("rejects titles over 40 Unicode characters", () => {
    expect(() =>
      parseDailyCallPayload({ ...validPayload, title: "x".repeat(41) }),
    ).toThrow();
  });

  it.each([[], options.slice(0, 1), options].map((entries) => ({ entries })))("preserves an optional options array %#", ({ entries }) => {
    expect(parseDailyCallPayload({ ...validPayload, options: entries })).toEqual({ ...validPayload, options: entries });
  });

  it.each([
    [options[0], options[1], options[0]],
    [{ ...options[0], beach_id: "invalid" }],
    [{ ...options[0], window_start: "invalid" }],
    [{ ...options[0], relation: "unknown" }],
    [{ ...options[0], wave_height_ft: "3" }],
  ])("rejects invalid options %#", (...entries) => {
    expect(() => parseDailyCallPayload({ ...validPayload, options: entries })).toThrow();
  });
});

describe("daily call push options", () => {
  const def = NOTIFICATION_REGISTRY.daily_call;

  it("appends the options sentence and carries both options in push and in-app data", () => {
    const payload = def.validatePayload!({ ...validPayload, options });
    const push = def.buildPushPayload!(payload);
    expect(push.title).toBe(validPayload.title);
    expect(push.body).toBe(`${validPayload.reason} Also: Scripps 9–11 AM, OB Pier 8–10 AM.`);
    expect(push.body.length).toBeLessThanOrEqual(240);
    expect(JSON.parse(push.data.options as string)).toEqual(options);
    expect(push.data.reason).toBe(validPayload.reason);
    expect(def.buildInAppPayload!(payload).data).toEqual(payload);
  });

  it.each([undefined, []].map((entries) => ({ entries })))("keeps the original body and omits empty push options %#", ({ entries }) => {
    const payload = def.validatePayload!({ ...validPayload, options: entries });
    const push = def.buildPushPayload!(payload);
    expect(push.body).toBe(validPayload.reason);
    expect(push.data).not.toHaveProperty("options");
  });

  it.each([
    { first: "Scripps", second: "B".repeat(200), suffix: " Also: Scripps 9–11 AM." },
    { first: "A".repeat(200), second: "OB Pier", suffix: "" },
  ])("drops options from the end before shortening reason %#", ({ first, second, suffix }) => {
    const entries = [{ ...options[0], beach_name: first }, { ...options[1], beach_name: second }];
    const push = def.buildPushPayload!(def.validatePayload!({ ...validPayload, options: entries }));
    expect(push.body).toBe(`${validPayload.reason}${suffix}`);
    expect(push.body.length).toBeLessThanOrEqual(240);
    expect(JSON.parse(push.data.options as string)).toEqual(entries);
  });

  it.each([217, 218, 240])("preserves a %i character reason at the body limit", (length) => {
    const reason = "r".repeat(length);
    const push = def.buildPushPayload!(def.validatePayload!({ ...validPayload, reason, options }));
    expect(push.body).toBe(length === 217 ? `${reason} Also: Scripps 9–11 AM.` : reason);
    expect(push.body.length).toBeLessThanOrEqual(240);
  });
});
