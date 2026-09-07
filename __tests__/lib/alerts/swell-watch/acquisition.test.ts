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
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await acquireSwellWatchCohort(cohort, client)).toEqual({ skipped: true, reason: "collection_in_progress", enqueued: 0 });
    expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
    expect(acquireProviderRunReceipts).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([{ data: null, error: null }, { data: true, error: { message: "unavailable" } }])(
    "fails closed on unavailable or malformed lease responses", async (response) => {
      rpc.mockResolvedValueOnce(response);
      await expect(acquireSwellWatchCohort(cohort, client)).rejects.toThrow();
      expect(loadSwellWatchAcquisitionScope).not.toHaveBeenCalled();
      expect(acquireProviderRunReceipts).not.toHaveBeenCalled();
    },
  );

  it("fences receipt storage and releases only its own token", async () => {
    jest.mocked(acquireProviderRunReceipts).mockImplementationOnce(async (_input, _fetch, writer) => {
      await writer.rpc("record_swell_watch_provider_run_receipt", { p_scopes: [] });
      return stored;
    });
    expect(await acquireSwellWatchCohort(cohort, client)).toEqual(stored);
    const owner = rpc.mock.calls[0][1].p_owner;
    expect(owner).toMatch(/^[a-f0-9-]{36}$/);
    expect(rpc.mock.calls).toEqual([
      ["try_acquire_swell_watch_collection_lease", { p_owner: owner }],
      ["record_leased_swell_watch_provider_run_receipt", { p_owner: owner, p_scopes: [] }],
      ["release_swell_watch_collection_lease", { p_owner: owner }],
    ]);
  });

  it.each(["scope", "provider"])("releases after %s failure", async (stage) => {
    jest.mocked(stage === "scope" ? loadSwellWatchAcquisitionScope : acquireProviderRunReceipts)
      .mockRejectedValueOnce(new Error("fixture failure"));
    await expect(acquireSwellWatchCohort(cohort, client)).rejects.toThrow("fixture failure");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
  });
});
