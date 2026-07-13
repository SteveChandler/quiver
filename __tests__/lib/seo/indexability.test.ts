import {
  evaluateBeachIndexability,
  evaluateCityEditorialIndexability,
  type EditorialSource,
} from "@/lib/seo/indexability";

const source: EditorialSource = {
  url: "https://www.noaa.gov/example",
  publisher: "NOAA",
  retrievedAt: "2026-07-13T00:00:00.000Z",
};

describe("SEO indexability", () => {
  it("allows a reviewed beach with sourced, local guidance", () => {
    expect(
      evaluateBeachIndexability({
        seoIndexable: true,
        seoReviewedAt: "2026-07-13T00:00:00.000Z",
        seoSources: [source],
        description: "A dependable beach break with several peaks along the shore.",
        waveTips: "Look for the cleaner inside peak when the tide is rising.",
      }),
    ).toEqual({ indexable: true, reason: null });
  });

  it("withholds a beach that has not been reviewed", () => {
    expect(
      evaluateBeachIndexability({
        seoIndexable: true,
        seoReviewedAt: null,
        seoSources: [source],
        description: "A dependable beach break with several peaks along the shore.",
        crowdTips: "Arrive early before the main parking lot fills.",
      }),
    ).toEqual({ indexable: false, reason: "missing-review" });
  });

  it("requires approved, sourced content for each city intent", () => {
    expect(
      evaluateCityEditorialIndexability(
        {
          seoIndexable: true,
          seoReviewedAt: "2026-07-13T00:00:00.000Z",
          seoSources: [source],
          description: [
            "This city has a documented local surf pattern and multiple distinct breaks.",
          ],
          intent: "beginner",
          intro: "Beginner surfers should start at the sheltered inside peak.",
          localGuidance: "Avoid the exposed outer bar during larger winter swells.",
        },
        "beginner",
      ),
    ).toEqual({ indexable: true, reason: null });
  });

  it("does not let city-wide approval stand in for intent-specific evidence", () => {
    expect(
      evaluateCityEditorialIndexability(
        {
          seoIndexable: true,
          seoReviewedAt: "2026-07-13T00:00:00.000Z",
          seoSources: [source],
          description: [
            "This city has a documented local surf pattern and multiple distinct breaks.",
          ],
          intent: "general",
        },
        "best-time",
      ),
    ).toEqual({ indexable: false, reason: "missing-intent-editorial" });
  });

  it("accepts approved general editorial for a location page", () => {
    expect(
      evaluateCityEditorialIndexability(
        {
          seoIndexable: true,
          seoReviewedAt: "2026-07-13T00:00:00.000Z",
          seoSources: [source],
          description: ["Reviewed city-level local guidance."],
          intent: "general",
          intro: "A reviewed city introduction.",
          localGuidance: "Use the documented access and safety guidance.",
        },
        null,
      ),
    ).toEqual({ indexable: true, reason: null });
  });

  it("requires the explicit human-approval flag", () => {
    expect(
      evaluateBeachIndexability({
        seoIndexable: false,
        seoReviewedAt: "2026-07-13T00:00:00.000Z",
        seoSources: [source],
        description: "A dependable beach break with several peaks along the shore.",
        waveTips: "Look for the cleaner inside peak when the tide is rising.",
      }),
    ).toEqual({ indexable: false, reason: "missing-review" });
  });
});
