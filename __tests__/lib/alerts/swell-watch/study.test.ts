/** @jest-environment node */
import { completeSwellWatchStudyRun, readSwellWatchStudyStatus, recoverSwellWatchStudyRuns, studyConfig } from "@/lib/alerts/swell-watch/study";
import { loadSwellWatchAcquisitionScope } from "@/lib/alerts/swell-watch/provider-run-store";
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";
import { calculateSwellWatchPolicyHash } from "@/lib/alerts/swell-watch/policy";
import fixture from "@/__tests__/fixtures/swell-watch-provisional-policy.json";

jest.mock("@/lib/alerts/swell-watch/provider-run-store", () => ({ loadSwellWatchAcquisitionScope: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/shadow-evaluation", () => ({ evaluateSwellWatchShadow: jest.fn() }));
jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: () => { throw new Error("Forbidden send path"); } }));

const policy = { ...fixture, schema_version: "swell-watch-policy.v2" as const,
  policy_values: { ...fixture.policy_values, volume_caps: { ...fixture.policy_values.volume_caps, projected_send_window_hours: 24 as const } } };
policy.value_hash = calculateSwellWatchPolicyHash(policy as never);
const config = { policy, cohort: Array.from({ length: 10 }, (_, i) => ({
  sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: `region-${i}`,
})) };
const batch = "20000000-0000-4000-8000-000000000001";
const revision = "30000000-0000-4000-8000-000000000001";
const completion = { provider_batch_id: batch, evaluation_id: `genuine_completed:${batch}`, already_evaluated: false };
const scopes = config.cohort.map((scope) => ({ ...scope, latitude: 32, longitude: -117,
  beach: { swell_window_center_deg: 270, swell_window_halfwidth_deg: 90 } }));
const scopeInputs = scopes.map(({ sourcePointId, latitude, longitude, beach }) => ({ sourcePointId, latitude, longitude,
  beach: { ...beach, swell_access_factors: null, terrain_enabled: null, deepwater_decay_factor: null, shoaling_factors: null } }));
const rpc = jest.fn();
const client = { rpc } as unknown as Parameters<typeof completeSwellWatchStudyRun>[2];

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(loadSwellWatchAcquisitionScope).mockResolvedValue(scopes as never);
  jest.mocked(evaluateSwellWatchShadow).mockResolvedValue({ providerBatchId: batch, policyHash: policy.value_hash,
    status: "evaluated", enqueued: 0, scopeOutcomes: null } as never);
  rpc.mockImplementation(async (name: string) => ({ data: name === "complete_swell_watch_study_run"
    ? [completion] : { recorded: true }, error: null }));
});

it("requires the entire cohort and an hourly verified v2 policy", () => {
  expect(studyConfig.safeParse(config).success).toBe(true);
  expect(studyConfig.safeParse({ ...config, cohort: config.cohort.slice(1) }).success).toBe(false);
  expect(studyConfig.safeParse({ ...config, policy: { ...policy, value_hash: "a".repeat(64) } }).success).toBe(false);
  const changed = structuredClone(policy);
  changed.policy_values.cadence.evaluation_interval_minutes = 120;
  changed.value_hash = calculateSwellWatchPolicyHash(changed as never);
  expect(studyConfig.safeParse({ ...config, policy: changed }).success).toBe(false);
});

it("completes before evaluation and requires durable outcome recording", async () => {
  await expect(completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).resolves.toMatchObject({ status: "evaluated", enqueued: 0 });
  expect(rpc.mock.calls[0]).toEqual(["complete_swell_watch_study_run", { p_revision_set_id: revision,
    p_policy_hash: policy.value_hash, p_cohort: config.cohort, p_scope_inputs: scopeInputs }]);
  expect(evaluateSwellWatchShadow).toHaveBeenCalledWith(expect.objectContaining({ providerBatchId: batch, scopes, forecastDays: 7 }), client);
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(evaluateSwellWatchShadow).mock.invocationCallOrder[0]);
  expect(rpc.mock.calls[1]).toEqual(["record_swell_watch_study_evaluation", expect.objectContaining({ p_provider_batch_id: batch,
    p_policy_hash: policy.value_hash, p_scope_inputs: scopeInputs, p_result: expect.objectContaining({ status: "evaluated" }) })]);
});

it("retains suppressed scope diagnostics without converting them into success", async () => {
  const result = { providerBatchId: batch, policyHash: policy.value_hash, status: "suppressed", reason: "incomplete_partition",
    scopeOutcomes: [{ sourcePointId: config.cohort[0].sourcePointId, status: "suppressed", reason: "incomplete_partition" }], enqueued: 0 };
  jest.mocked(evaluateSwellWatchShadow).mockResolvedValue(result as never);
  expect(await completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).toEqual(result);
  expect(rpc.mock.calls[1][1].p_result).toEqual(result);
});

it("does not reevaluate a successfully recorded immutable run", async () => {
  rpc.mockResolvedValueOnce({ data: [{ ...completion, already_evaluated: true }], error: null });
  expect(await completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).toEqual({
    skipped: true, reason: "already_evaluated", providerBatchId: batch, enqueued: 0,
  });
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledTimes(1);
});

it.each([null, [], [{ ...completion, provider_batch_id: "invalid" }], [{ ...completion, already_evaluated: undefined }]])(
  "rejects malformed completion without evaluating", async (data) => {
    rpc.mockResolvedValueOnce({ data, error: null });
    await expect(completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).rejects.toThrow();
    expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
  },
);

it.each(["complete_swell_watch_study_run", "record_swell_watch_study_evaluation"])("propagates %s failure", async (failed) => {
  rpc.mockImplementation(async (name: string) => name === failed ? { data: null, error: { message: "unavailable" } }
    : { data: [completion], error: null });
  await expect(completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).rejects.toThrow();
  expect(evaluateSwellWatchShadow).toHaveBeenCalledTimes(failed === "complete_swell_watch_study_run" ? 0 : 1);
});

it("does not record an evaluation that threw", async () => {
  jest.mocked(evaluateSwellWatchShadow).mockRejectedValueOnce(new Error("evaluation failed"));
  await expect(completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).rejects.toThrow("evaluation failed");
  expect(rpc).toHaveBeenCalledTimes(1);
});

it.each(["active", "complete", "expired", "unconfigured", "blocked"] as const)("reads %s from durable study health", async (status) => {
  rpc.mockResolvedValueOnce({ data: { status }, error: null });
  expect(await readSwellWatchStudyStatus(client)).toBe(status);
  expect(rpc).toHaveBeenCalledWith("read_swell_watch_study_health");
});

it.each([{ data: null, error: null }, { data: { status: "active" }, error: "unavailable" }, { data: { status: "unknown" }, error: null }])(
  "fails closed on unavailable health", async (result) => {
    rpc.mockResolvedValueOnce(result);
    await expect(readSwellWatchStudyStatus(client)).rejects.toThrow();
  },
);

it("recovers an older issuance after its result recording failed", async () => {
  let recordingFails = true;
  rpc.mockImplementation(async (name: string) => {
    if (name === "read_swell_watch_study_pending_runs") return { data: [{ revision_set_id: revision }], error: null };
    if (name === "complete_swell_watch_study_run") return { data: [completion], error: null };
    return recordingFails ? { data: null, error: "transient failure" } : { data: { recorded: true }, error: null };
  });
  await expect(completeSwellWatchStudyRun(revision, studyConfig.parse(config), client)).rejects.toThrow("Study outcome recording failed");
  recordingFails = false;
  expect(await recoverSwellWatchStudyRuns(studyConfig.parse(config), client)).toEqual({ processed: 1, failed: 0 });
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    "complete_swell_watch_study_run", "record_swell_watch_study_evaluation", "read_swell_watch_study_pending_runs",
    "complete_swell_watch_study_run", "record_swell_watch_study_evaluation",
  ]);
  expect(rpc.mock.calls[3][1].p_revision_set_id).toBe(revision);
});

it("continues through retained runs when an older recovery fails", async () => {
  const second = "30000000-0000-4000-8000-000000000002";
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "read_swell_watch_study_pending_runs") return { data: [{ revision_set_id: revision }, { revision_set_id: second }], error: null };
    if (name === "complete_swell_watch_study_run") return args.p_revision_set_id === revision
      ? { data: null, error: "failed" } : { data: [completion], error: null };
    return { data: { recorded: true }, error: null };
  });
  expect(await recoverSwellWatchStudyRuns(studyConfig.parse(config), client)).toEqual({ processed: 1, failed: 1 });
  expect(rpc.mock.calls.filter(([name]) => name === "complete_swell_watch_study_run").map(([, args]) => args.p_revision_set_id))
    .toEqual([revision, second]);
});

it("rejects an unavailable pending queue", async () => {
  rpc.mockResolvedValueOnce({ data: [], error: "unavailable" });
  await expect(recoverSwellWatchStudyRuns(studyConfig.parse(config), client)).rejects.toThrow("Pending study runs unavailable");
  expect(evaluateSwellWatchShadow).not.toHaveBeenCalled();
});
