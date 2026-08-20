import { COMPARISON_SOURCE_REVIEW } from "@/app/best-surf-forecast-app/comparison-sources";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

describe("Best surf forecast app source freshness", () => {
  it("requires comparison claims to be re-verified before they become stale", () => {
    const lastVerifiedAt = new Date(
      `${COMPARISON_SOURCE_REVIEW.lastVerified}T00:00:00.000Z`,
    );
    const staleAfter = new Date(
      lastVerifiedAt.getTime() +
        COMPARISON_SOURCE_REVIEW.freshnessThresholdDays *
          MILLISECONDS_PER_DAY,
    );
    const now = new Date();

    expect(() => {
      if (now.getTime() <= staleAfter.getTime()) {
        return;
      }

      throw new Error(
        [
          `Comparison sources are stale: last verified ${COMPARISON_SOURCE_REVIEW.lastVerified} by ${COMPARISON_SOURCE_REVIEW.reviewedBy}, with a ${COMPARISON_SOURCE_REVIEW.freshnessThresholdDays}-day threshold.`,
          "Re-verify the claims and bump COMPARISON_SOURCE_REVIEW.lastVerified only after completing every verification step:",
          "1. Confirm every material comparison claim against its cited source.",
          "2. Check App Store and competitor information.",
          "3. Check every source link for 404s or redirects with `yarn check:comparison-sources`.",
        ].join("\n"),
      );
    }).not.toThrow();
  });
});
