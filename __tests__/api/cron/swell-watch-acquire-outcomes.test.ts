/** @jest-environment node */
import { GET } from "@/app/api/cron/swell-watch-acquire/route";
import { acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns } from "@/lib/alerts/swell-watch/study";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { calculateSwellWatchPolicyHash } from "@/lib/alerts/swell-watch/policy";
import fixture from "@/__tests__/fixtures/swell-watch-provisional-policy.json";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/acquisition", () => ({ ...jest.requireActual("@/lib/alerts/swell-watch/acquisition"), acquireSwellWatchCohort: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/study", () => ({ ...jest.requireActual("@/lib/alerts/swell-watch/study"),
  completeSwellWatchStudyRun: jest.fn(), readSwellWatchStudyStatus: jest.fn(), recoverSwellWatchStudyRuns: jest.fn() }));
jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: () => { throw new Error("Forbidden send path"); } }));

const originalEnv = process.env;
const cohort = Array.from({ length: 10 }, (_, i) => ({ sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: `fixture-${i}` }));
const stored = { issuanceId: "20000000-0000-4000-8000-000000000001", runBatchId: "20000000-0000-4000-8000-000000000002", revisionSetId: "20000000-0000-4000-8000-000000000003" };
const policy = { ...fixture, schema_version: "swell-watch-policy.v2" as const,
  policy_values: { ...fixture.policy_values, volume_caps: { ...fixture.policy_values.volume_caps, projected_send_window_hours: 24 as const } } };
policy.value_hash = calculateSwellWatchPolicyHash(policy as never);
const suppressed = { providerBatchId: "20000000-0000-4000-8000-000000000004", policyHash: policy.value_hash,
  evaluationIds: [], status: "suppressed" as const, reason: "incomplete_partition",
  derivation: null, scopeOutcomes: cohort.map(({ sourcePointId }) => ({ sourcePointId, status: "suppressed" as const, reason: "incomplete_partition" })),
  suppressionReasons: {}, candidateCount: null, stableRegionalEventCount: null, preSafetyRecipientsThisEvaluation: null,
  sendEligibility: "not_evaluated" as const, projectedSendsRolling24Hours: null, deliveryHealth: null,
  recordedDemand: null, safety: null, enqueued: 0 as const };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, CRON_SECRET: "fixture-secret", SWELL_WATCH_ACQUISITION_ENABLED: "true",
    SWELL_WATCH_STUDY_ENABLED: "true", SWELL_WATCH_SHADOW_EVALUATION_ENABLED: "true",
    SWELL_WATCH_ENABLED: "false", SWELL_WATCH_PUSH_ENABLED: "false", SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ cohort, policy }) };
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({} as never);
  jest.mocked(acquireSwellWatchCohort).mockResolvedValue(stored);
  jest.mocked(readSwellWatchStudyStatus).mockResolvedValue({ status: "active", qualificationRule: "primary_partition_with_retained_unavailable_secondary.v1" });
  jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValue({ processed: 0, failed: 0 });
  jest.mocked(completeSwellWatchStudyRun).mockResolvedValue(suppressed);
});
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });
const call = () => GET(new Request("http://localhost/api/cron/swell-watch-acquire", { headers: { Authorization: "Bearer fixture-secret" } }));

it("returns 503 after recording suppression, retaining complete scope accounting and no-store", async () => {
  const response = await call();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
  expect(await response.json()).toMatchObject({ success: false, error: "Study suppressed",
    details: { ...stored, study: suppressed, recovery: { processed: 0, failed: 0 }, qualification: "automated_study", enqueued: 0 } });
  expect(completeSwellWatchStudyRun).toHaveBeenCalledTimes(1);
});

it("preserves recovery-failure precedence over a suppressed current run", async () => {
  jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValue({ processed: 0, failed: 1 });
  const response = await call();
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ error: "Study recovery incomplete", details: { recovery: { failed: 1 }, study: suppressed } });
});

it("still acknowledges an already evaluated immutable run as a no-op", async () => {
  jest.mocked(completeSwellWatchStudyRun).mockResolvedValue({ skipped: true, reason: "already_evaluated", providerBatchId: suppressed.providerBatchId, enqueued: 0 });
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { study: { skipped: true, reason: "already_evaluated" }, enqueued: 0 } });
});
