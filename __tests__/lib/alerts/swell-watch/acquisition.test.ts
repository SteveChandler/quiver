/** @jest-environment node */
import { acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { acquireProviderRunReceipts, loadSwellWatchAcquisitionScope } from "@/lib/alerts/swell-watch/provider-run-store";

jest.mock("@/lib/alerts/swell-watch/provider-run-store", () => ({
  acquireProviderRunReceipts: jest.fn(), loadSwellWatchAcquisitionScope: jest.fn(),
}));

describe("leased Swell Watch acquisition", () => {
  const cohort = [{ sourcePointId: "11111111-1111-4111-8111-111111111111", regionKey: "fixture" }];
  const stored = { issuanceId: "issuance", runBatchId: "batch", revisionSetId: "revision" };
  const rpc = jest.fn();
  const client = { rpc } as unknown as Parameters<typeof acquireSwellWatchCohort>[1];
  beforeEach(() => {
    jest.resetAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    jest.mocked(loadSwellWatchAcquisitionScope).mockResolvedValue([]);
    jest.mocked(acquireProviderRunReceipts).mockResolvedValue(stored);
  });

  it("does no provider or scope I/O when another collector owns the lease", async () => {
    const onStage = jest.fn();
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await acquireSwellWatchCohort(cohort, client, onStage)).toEqual({ skipped: true, reason: "collection_in_progress", enqueued: 0 });
    expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
    expect(acquireProviderRunReceipts).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(onStage.mock.calls).toEqual([["collection_lease"]]);
  });

  it.each([{ data: null, error: null }, { data: true, error: { message: "unavailable" } }])(
    "fails closed on unavailable or malformed lease responses", async (response) => {
      const onStage = jest.fn();
      rpc.mockResolvedValueOnce(response);
      await expect(acquireSwellWatchCohort(cohort, client, onStage)).rejects.toThrow("Collection lease unavailable");
      expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
      expect(acquireProviderRunReceipts).not.toHaveBeenCalled();
      expect(onStage.mock.calls).toEqual([["collection_lease"]]);
    },
  );

  it("fences receipt storage and releases only its own token", async () => {
    const onStage = jest.fn();
    jest.mocked(acquireProviderRunReceipts).mockImplementationOnce(async (_input, _fetch, writer) => {
      await writer.rpc("record_swell_watch_provider_run_receipt", { p_scopes: [] });
      return stored;
    });
    expect(await acquireSwellWatchCohort(cohort, client, onStage)).toEqual(stored);
    const owner = rpc.mock.calls[0][1].p_owner;
    expect(owner).toMatch(/^[a-f0-9-]{36}$/);
    expect(rpc.mock.calls).toEqual([
      ["try_acquire_swell_watch_collection_lease", { p_owner: owner }],
      ["record_leased_swell_watch_provider_run_receipt", { p_owner: owner, p_scopes: [] }],
      ["release_swell_watch_collection_lease", { p_owner: owner }],
    ]);
    expect(onStage.mock.calls).toEqual([
      ["collection_lease"], ["acquisition_scope"], ["provider_fetch"], ["receipt_storage"],
    ]);
  });

  it.each(["scope", "provider"])("releases after %s failure", async (stage) => {
    const onStage = jest.fn();
    const failure = new Error("fixture failure");
    jest.mocked(stage === "scope" ? loadSwellWatchAcquisitionScope : acquireProviderRunReceipts)
      .mockRejectedValueOnce(failure);
    await expect(acquireSwellWatchCohort(cohort, client, onStage)).rejects.toBe(failure);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
    expect(onStage.mock.calls).toEqual(stage === "scope"
      ? [["collection_lease"], ["acquisition_scope"]]
      : [["collection_lease"], ["acquisition_scope"], ["provider_fetch"]]);
  });

  it("reports receipt storage when its leased RPC fails", async () => {
    const onStage = jest.fn();
    const failure = new Error("private receipt error");
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockRejectedValueOnce(failure);
    jest.mocked(acquireProviderRunReceipts).mockImplementationOnce(async (_input, _fetch, writer) => {
      await writer.rpc("record_swell_watch_provider_run_receipt", { p_scopes: [] });
      return stored;
    });
    await expect(acquireSwellWatchCohort(cohort, client, onStage)).rejects.toBe(failure);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "record_leased_swell_watch_provider_run_receipt",
      "release_swell_watch_collection_lease",
    ]);
    expect(onStage.mock.calls).toEqual([
      ["collection_lease"], ["acquisition_scope"], ["provider_fetch"], ["receipt_storage"],
    ]);
  });

  it("reports lease release only when release fails", async () => {
    const onStage = jest.fn();
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private release error" } });
    await expect(acquireSwellWatchCohort(cohort, client, onStage))
      .rejects.toThrow("Collection lease release unavailable");
    expect(onStage.mock.calls).toEqual([
      ["collection_lease"], ["acquisition_scope"], ["provider_fetch"], ["lease_release"],
    ]);
  });

  it("reports the release error and stage when collection and release both fail", async () => {
    const onStage = jest.fn();
    const primaryFailure = new Error("private provider error");
    const releaseFailure = new Error("private release error");
    jest.mocked(acquireProviderRunReceipts).mockRejectedValueOnce(primaryFailure);
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockRejectedValueOnce(releaseFailure);
    await expect(acquireSwellWatchCohort(cohort, client, onStage)).rejects.toBe(releaseFailure);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
    expect(onStage.mock.calls).toEqual([
      ["collection_lease"], ["acquisition_scope"], ["provider_fetch"], ["lease_release"],
    ]);
  });

  it("fails with a fixed provider budget error before provider work can consume the route budget", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValue(181_001);
    jest.mocked(acquireProviderRunReceipts).mockImplementationOnce(async (_input, fetcher) => {
      await fetcher("https://provider.test", { method: "GET", redirect: "error" });
      return stored;
    });

    await expect(acquireSwellWatchCohort(cohort, client)).rejects.toThrow("provider budget exceeded");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
    now.mockRestore();
  });
});
