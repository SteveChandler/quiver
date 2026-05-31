/**
 * @jest-environment node
 *
 * Regression coverage for /api/cron/forecast-digest-email push ownership.
 */

import { readFileSync } from "fs";
import { join } from "path";

describe("Cron: forecast-digest-email", () => {
  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cron/forecast-digest-email/route.ts"),
      "utf8",
    );

    expect(source).not.toContain("@/lib/api-utils");
    expect(source).toContain("@/lib/middleware/api-wrappers");
  });

  it("does not enqueue forecast push notifications from the email digest route", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cron/forecast-digest-email/route.ts"),
      "utf8",
    );

    expect(source).not.toContain("@/lib/notifications/enqueue");
    expect(source).not.toContain("enqueueNotification(");
    expect(source).not.toContain("dedupeKey: `daily_digest:");
  });

  it("uses canonical beach tide preference columns", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cron/forecast-digest-email/route.ts"),
      "utf8",
    );

    expect(source).toContain("preferred_tide_ft_min");
    expect(source).toContain("preferred_tide_ft_max");
    expect(source).not.toContain("tide_min_ft");
    expect(source).not.toContain("tide_max_ft");
  });

  it("tracks the one-action forecast CTA template", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cron/forecast-digest-email/route.ts"),
      "utf8",
    );

    expect(source).toContain("utm_campaign=forecast_digest");
    expect(source).toContain("utm_content=check_forecast_v1");
    expect(source).toContain('template: "check_forecast_v1"');
    expect(source).toContain('primary_action: "check_forecast"');
  });
});
