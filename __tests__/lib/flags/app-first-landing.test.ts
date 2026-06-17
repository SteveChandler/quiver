jest.mock("server-only", () => ({}));

import {
  appFirstCohort,
  isAppFirstLandingEnabled,
} from "@/lib/flags/app-first-landing";

describe("app-first landing feature flag", () => {
  const originalFlag = process.env.APP_FIRST_LANDING_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.APP_FIRST_LANDING_ENABLED;
    } else {
      process.env.APP_FIRST_LANDING_ENABLED = originalFlag;
    }
  });

  it("defaults the app-first landing experience on", () => {
    delete process.env.APP_FIRST_LANDING_ENABLED;

    expect(isAppFirstLandingEnabled()).toBe(true);
    expect(appFirstCohort()).toBe("app_first");
  });

  it("supports an instant false rollback flag", () => {
    process.env.APP_FIRST_LANDING_ENABLED = "false";

    expect(isAppFirstLandingEnabled()).toBe(false);
    expect(appFirstCohort()).toBe("control");
  });
});
