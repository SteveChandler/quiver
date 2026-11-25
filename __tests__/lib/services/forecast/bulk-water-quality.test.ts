/** @jest-environment node */
import { resolveBulkWaterQuality } from "@/lib/services/forecast/bulk-water-quality";

const mockResolve = jest.fn();
jest.mock("@/lib/recommendations/major-event-hold/water-quality", () => ({
  resolveWaterQualityHolds: (...args: unknown[]) => mockResolve(...args),
}));

const BEACH = "11111111-1111-4111-8111-111111111111";
const AT = new Date("2026-11-25T15:00:00Z");

afterEach(() => {
  jest.useRealTimers();
  mockResolve.mockReset();
});

it("returns null when the read runs past its time limit", async () => {
  jest.useFakeTimers();
  mockResolve.mockReturnValue(new Promise(() => {}));
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const pending = resolveBulkWaterQuality([BEACH], AT, { timeoutMs: 100 });
  await jest.advanceTimersByTimeAsync(100);
  await expect(pending).resolves.toBeNull();
  expect(warn).toHaveBeenCalledWith("[forecast-bulk:water-quality-timeout]", { beachCount: 1 });
  warn.mockRestore();
});

it("returns null when the request aborts during the read", async () => {
  mockResolve.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const pending = resolveBulkWaterQuality([BEACH], AT, { signal: controller.signal });
  controller.abort();
  await expect(pending).resolves.toBeNull();
});

it("asks the live resolver for every beach at the selected hour", async () => {
  mockResolve.mockResolvedValue({ state: "resolved", heldBeachIds: [], waterQualityStatusByBeachId: {}, epoch: "e" });
  await expect(resolveBulkWaterQuality([BEACH], AT)).resolves.toEqual({ [BEACH]: null });
  expect(mockResolve).toHaveBeenCalledWith(
    [{ candidateId: `bulk-water-quality:${BEACH}`, beachId: BEACH, startsAt: AT.toISOString(), endsAt: "2026-11-25T18:00:00.000Z" }],
    {},
  );
});

it("does not catch a fault outside the read", async () => {
  // A malformed resolution is a code fault, not a failed read; it must not turn into "status unknown".
  mockResolve.mockResolvedValue({ state: "resolved", heldBeachIds: null, waterQualityStatusByBeachId: {}, epoch: "e" });
  await expect(resolveBulkWaterQuality([BEACH], AT)).rejects.toThrow(TypeError);
});

it("makes no read for no beaches", async () => {
  await expect(resolveBulkWaterQuality([], AT)).resolves.toEqual({});
  expect(mockResolve).not.toHaveBeenCalled();
});
