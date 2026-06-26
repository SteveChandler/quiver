jest.mock("server-only", () => ({}));

import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";

describe("free-growth phase feature flag", () => {
  const originalFlag = process.env.FREE_GROWTH_PHASE;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.FREE_GROWTH_PHASE;
    } else {
      process.env.FREE_GROWTH_PHASE = originalFlag;
    }
  });

  it("defaults off", () => {
    delete process.env.FREE_GROWTH_PHASE;

    expect(isFreeGrowthPhaseEnabled()).toBe(false);
  });

  it("turns on only when explicitly true", () => {
    process.env.FREE_GROWTH_PHASE = "true";

    expect(isFreeGrowthPhaseEnabled()).toBe(true);
  });
});
