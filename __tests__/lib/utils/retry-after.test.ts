import { retryAfterSeconds } from "@/lib/utils/retry-after";

describe("retryAfterSeconds", () => {
  it("spreads retries across 3 to 6 whole seconds", () => {
    expect(retryAfterSeconds(() => 0)).toBe(3);
    expect(retryAfterSeconds(() => 0.999)).toBe(6);
    for (let i = 0; i < 50; i += 1) {
      const seconds = retryAfterSeconds();
      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThanOrEqual(3);
      expect(seconds).toBeLessThanOrEqual(6);
    }
  });
});
