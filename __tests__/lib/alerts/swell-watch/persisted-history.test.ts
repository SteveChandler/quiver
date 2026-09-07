/** @jest-environment node */
import { loadMatchedSwellWatchHistory, loadSwellWatchHistory } from "@/lib/alerts/swell-watch/persisted-history";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const id = "11111111-1111-4111-8111-111111111111";
const evaluationId = `genuine_completed:${id}`;
const tuple = { evaluation_id: evaluationId, source_slot: "s2", height_m: 1.8, period_s: 13, direction_deg: 170 };
const row = { regional_event_id: id, evaluation_id: evaluationId, beach_id: id,
  arrival_at: "2026-09-08T00:00Z", peak_at: "2026-09-08T06:00Z", evaluated_at: "2026-09-05T00:00Z",
  swell_watch_regional_events: { region_key: "fixture", latest_state: [], last_suppression: [] },
  swell_watch_beach_impacts: { policy_hash: "a".repeat(64), swell_watch_observations: { ...tuple,
    provider_batch_id: id, source_point_id: id, identity_kind: "genuine_completed", provider: "open_meteo", forecast_at: "2026-09-08T00:00Z" } },
};

function client(data: unknown = [row]) {
  const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn() };
  query.limit.mockImplementation((size) => size === 1 ? query : Promise.resolve({ data, count: Array.isArray(data) ? data.length : null, error: null }));
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  const from = jest.fn(() => query);
  const rpc = jest.fn().mockResolvedValue({ data: [{ ...tuple, source_slot: "s1" }, tuple], error: null });
  return { from: from as never, rpc, query };
}

it("does not turn one persisted evaluation into confidence or accept a superseded evaluation", async () => {
  const data = { ...row, swell_watch_beach_impacts: { ...row.swell_watch_beach_impacts,
    policy_hash: fixturePolicy.value_hash } };
  const value = { regionKey: "fixture", beachId: id, regionalEventId: id,
    evaluationId, policy: fixturePolicy as SwellWatchPolicy };
  expect(await loadMatchedSwellWatchHistory(value, client([data])))
    .toMatchObject({ regionalEvent: { regionalEventId: id, status: "candidate" }, confidence: null });
  await expect(loadMatchedSwellWatchHistory({ ...value,
    evaluationId: "genuine_completed:22222222-2222-4222-8222-222222222222" }, client([data])))
    .rejects.toThrow("absent or superseded");
});

it("loads exact attested matching fields without inventing significance metrics", async () => {
  const db = client();
  const history = await loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db);
  expect(history).toEqual([{ regionKey: "fixture", persistedRegionalEventId: id, evaluatedAt: row.evaluated_at,
    eventState: "candidate", identity: { kind: "genuine_completed", id: evaluationId }, peakAt: row.peak_at,
    impact: { kind: "candidate", arrivalAt: row.arrival_at, policyHash: "a".repeat(64), partition: {
      provider: "open_meteo", evaluationId, forecastAt: row.arrival_at, sourceSlot: "s2", heightM: 1.8, periodS: 13, directionDeg: 170, completeness: "complete" } } }]);
  expect(db.from).toHaveBeenCalledWith("swell_watch_event_impacts");
  expect(db.query.select).toHaveBeenCalledWith(expect.stringContaining("last_suppression:swell_watch_event_state_transitions(state,version,created_at)"), { count: "exact" });
  expect(db.query.eq.mock.calls).toEqual([["beach_id", id], ["swell_watch_regional_events.region_key", "fixture"], ["swell_watch_regional_events.last_suppression.state", "suppressed"]]);
  expect(db.query.order.mock.calls).toEqual([
    ["version", { referencedTable: "swell_watch_regional_events.latest_state", ascending: false }],
    ["created_at", { referencedTable: "swell_watch_regional_events.last_suppression", ascending: false }],
    ["evaluated_at", { ascending: true }], ["id", { ascending: true }],
  ]);
  expect(db.query.limit).toHaveBeenCalledWith(1001);
  expect(db.rpc).toHaveBeenCalledWith("read_swell_watch_attested_components", {
    p_provider_batch_id: id, p_source_point_id: id, p_forecast_at: row.arrival_at,
  });
});

it.each([null, [ { ...row, evaluation_id: `genuine_completed:00000000-0000-0000-0000-000000000000` } ],
  [{ ...row, beach_id: "22222222-2222-4222-8222-222222222222" }],
  [{ ...row, peak_at: "2026-09-07T00:00Z" }], Array(1001).fill(row)].map((data) => ({ data })))("rejects invalid, wrong-scope or truncated history", async ({ data }) => {
  const db = client(data);
  await expect(loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db)).rejects.toThrow();
  expect(db.rpc).not.toHaveBeenCalled();
});

it("propagates database failure instead of allocating from empty history", async () => {
  const db = client();
  db.query.limit.mockImplementation((size) => size === 1 ? db.query : Promise.resolve({ data: null, error: { message: "offline" } }));
  await expect(loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db)).rejects.toThrow("history read failed");
});

it.each([null, 2])("rejects a missing exact count or server-side truncation", async (count) => {
  const db = client(); db.query.limit.mockImplementation((size) => size === 1 ? db.query : Promise.resolve({ data: [row], count, error: null }));
  await expect(loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db)).rejects.toThrow("truncated or duplicated");
  expect(db.rpc).not.toHaveBeenCalled();
});

it("rejects duplicate persisted associations", async () => {
  const db = client([row, row]);
  await expect(loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db)).rejects.toThrow("truncated or duplicated");
  expect(db.rpc).not.toHaveBeenCalled();
});

it("does not restore pre-suppression evidence after a candidate reset", async () => {
  const db = client([{ ...row, swell_watch_regional_events: { ...row.swell_watch_regional_events,
    latest_state: [{ state: "candidate", version: 3, created_at: "2026-09-05T02:00Z" }],
    last_suppression: [{ state: "suppressed", version: 2, created_at: "2026-09-05T01:00Z" }],
  } }]);
  expect(await loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db)).toEqual([]);
  expect(db.rpc).not.toHaveBeenCalled();
});

it.each([
  { data: null, error: { message: "revoked" } },
  { data: [{ ...tuple, source_slot: "s1" }, { ...tuple, height_m: 9 }], error: null },
  { data: [tuple, tuple], error: null },
  { data: [{ ...tuple, source_slot: "s1", evaluation_id: `genuine_completed:22222222-2222-4222-8222-222222222222` }, tuple], error: null },
])("rejects revoked, mismatched or ambiguous attestation", async (result) => {
  const db = client(); db.rpc.mockResolvedValue(result);
  await expect(loadSwellWatchHistory({ regionKey: "fixture", beachId: id }, db)).rejects.toThrow();
});
