import { isRainAdvisoryPushEnabled } from "@/lib/flags/rain-advisory-push";

describe("rain advisory push flag", () => {
  const originalValue = process.env.RAIN_ADVISORY_PUSH_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.RAIN_ADVISORY_PUSH_ENABLED;
    else process.env.RAIN_ADVISORY_PUSH_ENABLED = originalValue;
  });

  it("defaults off and enables only for exact true", () => {
    delete process.env.RAIN_ADVISORY_PUSH_ENABLED;
    expect(isRainAdvisoryPushEnabled()).toBe(false);
    process.env.RAIN_ADVISORY_PUSH_ENABLED = "TRUE";
    expect(isRainAdvisoryPushEnabled()).toBe(false);
    process.env.RAIN_ADVISORY_PUSH_ENABLED = "true";
    expect(isRainAdvisoryPushEnabled()).toBe(true);
  });
});
