/** @jest-environment node */
import { GET } from "@/app/api/cron/swell-watch-acquire/route";
import { acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns } from "@/lib/alerts/swell-watch/study";
import { calculateSwellWatchPolicyHash } from "@/lib/alerts/swell-watch/policy";
import fixture from "@/__tests__/fixtures/swell-watch-provisional-policy.json";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/acquisition", () => ({
  ...jest.requireActual("@/lib/alerts/swell-watch/acquisition"), acquireSwellWatchCohort: jest.fn(),
}));
jest.mock("@/lib/alerts/swell-watch/study", () => ({
  ...jest.requireActual("@/lib/alerts/swell-watch/study"), completeSwellWatchStudyRun: jest.fn(), readSwellWatchStudyStatus: jest.fn(),
  recoverSwellWatchStudyRuns: jest.fn(),
}));

const originalEnv = process.env;
const receipt = { issuanceId: "issuance", runBatchId: "batch", revisionSetId: "revision" };
const rule = "model_reported_swell_system_count.v1";

beforeEach(() => {
  jest.clearAllMocks();
  const policy = { ...fixture, schema_version: "swell-watch-policy.v2", policy_values: {
    ...fixture.policy_values, volume_caps: { ...fixture.policy_values.volume_caps, projected_send_window_hours: 24 },
  } };
  policy.value_hash = calculateSwellWatchPolicyHash(policy as never);
  process.env = { ...originalEnv, CRON_SECRET: "fixture-secret", SWELL_WATCH_STUDY_ENABLED: "true", SWELL_WATCH_SHADOW_EVALUATION_ENABLED: "true",
    SWELL_WATCH_ACQUISITION_ENABLED: "true", SWELL_WATCH_ENABLED: "false", SWELL_WATCH_PUSH_ENABLED: "false",
    SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ policy, cohort: Array.from({ length: 10 }, (_, i) => ({
      sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: `region-${i}` })) }) };
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({} as never);
  jest.mocked(acquireSwellWatchCohort).mockResolvedValue(receipt);
  jest.mocked(completeSwellWatchStudyRun).mockResolvedValue({ status: "evaluated", enqueued: 0 } as never);
  jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValue({ processed: 0, failed: 0 });
});
afterAll(() => { process.env = originalEnv; });

const call = (): Promise<Response> => GET(new Request("http://localhost/api/cron/swell-watch-acquire", { headers: { Authorization: "Bearer fixture-secret" } }));

it("calls recovery and completion with their exact legacy arguments when the authority has no tracking", async () => {
  jest.mocked(readSwellWatchStudyStatus).mockResolvedValue({ status: "active", qualificationRule: rule });
  expect((await call()).status).toBe(200);
  expect(completeSwellWatchStudyRun).toHaveBeenCalledWith(receipt.revisionSetId, expect.anything(), expect.anything(), rule, expect.any(Function));
  expect(recoverSwellWatchStudyRuns).toHaveBeenCalledWith(expect.anything(), expect.anything(), rule, expect.any(Function));
  expect(jest.mocked(completeSwellWatchStudyRun).mock.calls[0]).toHaveLength(5);
  expect(jest.mocked(recoverSwellWatchStudyRuns).mock.calls[0]).toHaveLength(4);
});

it("passes the authority's tracking mode to recovery and completion once it is active", async () => {
  jest.mocked(readSwellWatchStudyStatus).mockResolvedValue({ status: "active", qualificationRule: rule, trackingMode: "sub_floor_tracking.v1" });
  expect((await call()).status).toBe(200);
  expect(completeSwellWatchStudyRun).toHaveBeenCalledWith(receipt.revisionSetId, expect.anything(), expect.anything(), rule, expect.any(Function), "sub_floor_tracking.v1");
  expect(recoverSwellWatchStudyRuns).toHaveBeenCalledWith(expect.anything(), expect.anything(), rule, expect.any(Function), "sub_floor_tracking.v1");
});

it("follows an authority change observed after recovery, in either direction", async () => {
  jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 1, failed: 0 });
  jest.mocked(readSwellWatchStudyStatus)
    .mockResolvedValueOnce({ status: "active", qualificationRule: rule })
    .mockResolvedValueOnce({ status: "active", qualificationRule: rule, trackingMode: "sub_floor_tracking.v1" });
  expect((await call()).status).toBe(200);
  expect(completeSwellWatchStudyRun).toHaveBeenCalledWith(receipt.revisionSetId, expect.anything(), expect.anything(), rule, expect.any(Function), "sub_floor_tracking.v1");
  jest.clearAllMocks();
  jest.mocked(acquireSwellWatchCohort).mockResolvedValue(receipt);
  jest.mocked(completeSwellWatchStudyRun).mockResolvedValue({ status: "evaluated", enqueued: 0 } as never);
  jest.mocked(recoverSwellWatchStudyRuns).mockResolvedValueOnce({ processed: 1, failed: 0 });
  jest.mocked(readSwellWatchStudyStatus)
    .mockResolvedValueOnce({ status: "active", qualificationRule: rule, trackingMode: "sub_floor_tracking.v1" })
    .mockResolvedValueOnce({ status: "active", qualificationRule: rule });
  expect((await call()).status).toBe(200);
  expect(jest.mocked(completeSwellWatchStudyRun).mock.calls[0]).toHaveLength(5);
});
