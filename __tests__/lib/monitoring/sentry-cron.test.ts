import * as Sentry from "@sentry/nextjs";
import { completeCronCheckIn } from "@/lib/monitoring/sentry-cron";

jest.mock("@sentry/nextjs", () => ({
  captureCheckIn: jest.fn(),
  flush: jest.fn(),
}));

const captureCheckInMock = jest.mocked(Sentry.captureCheckIn);
const flushMock = jest.mocked(Sentry.flush);

describe("completeCronCheckIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    flushMock.mockResolvedValue(true);
  });

  it.each([
    ["ok", "ok"],
    ["error", "error"],
  ] as const)("flushes a completed %s check-in with an explicit duration", async (_label, status) => {
    await completeCronCheckIn("check-in-1", "test-monitor", status, 1500);

    expect(captureCheckInMock).toHaveBeenCalledWith({
      checkInId: "check-in-1",
      monitorSlug: "test-monitor",
      status,
      duration: 1.5,
    });
    expect(flushMock).toHaveBeenCalledWith(2000);
  });

  it("swallows flush failures", async () => {
    flushMock.mockRejectedValueOnce(new Error("flush failed"));

    await expect(
      completeCronCheckIn("check-in-1", "test-monitor", "error", 2500),
    ).resolves.toBeUndefined();
  });

  it("preserves the empty check-in guard", async () => {
    await completeCronCheckIn("", "test-monitor", "ok", 500);

    expect(captureCheckInMock).not.toHaveBeenCalled();
    expect(flushMock).not.toHaveBeenCalled();
  });
});
