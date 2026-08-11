import {
  applyIndexabilityToMetadata,
  evaluateBeachIndexability,
  evaluateCityDataIntentIndexability,
  evaluateCityEditorialIndexability,
  resolveIndexability,
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
    ).toEqual({ indexable: true, reason: "editorial-approved" });
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
    ).toEqual({ indexable: false, reason: "unproven" });
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
    ).toEqual({ indexable: true, reason: "editorial-approved" });
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
    ).toEqual({ indexable: false, reason: "unproven" });
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
    ).toEqual({ indexable: true, reason: "editorial-approved" });
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
    ).toEqual({ indexable: false, reason: "editorial-rejected" });
  });

  it.each([
    {
      context: {
        canonicalPath: "/ca/encinitas/swamis/water-temp",
        editorialApproved: false,
        editorialRejected: false,
        dataRich: false,
        performanceProtected: true,
      },
      expected: { indexable: false, reason: "insufficient-data" },
    },
    {
      context: {
        canonicalPath: "/ca/encinitas/swamis/water-temp",
        editorialApproved: true,
        editorialRejected: true,
        dataRich: true,
        performanceProtected: true,
      },
      expected: { indexable: false, reason: "editorial-rejected" },
    },
    {
      context: {
        canonicalPath: "/new-reviewed-page",
        editorialApproved: true,
        editorialRejected: false,
        dataRich: true,
        performanceProtected: false,
      },
      expected: { indexable: true, reason: "editorial-approved" },
    },
    {
      context: {
        canonicalPath: "/ca/encinitas/swamis/water-temp",
        editorialApproved: false,
        editorialRejected: false,
        dataRich: true,
        performanceProtected: true,
      },
      expected: { indexable: true, reason: "gsc-protected" },
    },
    {
      context: {
        canonicalPath: "/new-unreviewed-page",
        editorialApproved: false,
        editorialRejected: false,
        dataRich: true,
        performanceProtected: false,
      },
      expected: { indexable: false, reason: "unproven" },
    },
  ])("applies the fixed precedence matrix", ({ context, expected }) => {
    expect(resolveIndexability(context)).toEqual(expected);
  });

  it("applies consistent noindex directives without changing indexable metadata", () => {
    const metadata = { title: "Test page" };

    expect(
      applyIndexabilityToMetadata(metadata, {
        indexable: false,
        reason: "unproven",
      }),
    ).toEqual({
      title: "Test page",
      robots: {
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      },
    });
    expect(
      applyIndexabilityToMetadata(metadata, {
        indexable: true,
        reason: "gsc-protected",
      }),
    ).toBe(metadata);
  });
});

describe("evaluateCityDataIntentIndexability", () => {
  const noEditorial = null;

  it("indexes a water-temp city page with live data and no editorial row", () => {
    const decision = evaluateCityDataIntentIndexability(
      noEditorial,
      "/water-temp/corolla",
      { hasIntentData: true, dataRich: true },
    );
    expect(decision).toEqual({ indexable: true, reason: "forecast-approved" });
  });

  it("does not index when the city has no live reading", () => {
    expect(
      evaluateCityDataIntentIndexability(noEditorial, "/water-temp/ma", {
        hasIntentData: false,
        dataRich: true,
      }).indexable,
    ).toBe(false);
  });

  it("does not index when the city has no matching beaches", () => {
    expect(
      evaluateCityDataIntentIndexability(noEditorial, "/tide/nowhere", {
        hasIntentData: true,
        dataRich: false,
      }).indexable,
    ).toBe(false);
  });

  it("still honours an explicit editorial rejection", () => {
    const decision = evaluateCityDataIntentIndexability(
      {
        seoIndexable: false,
        seoReviewedAt: "2026-07-20T00:00:00Z",
        seoSources: [],
        description: null,
        intent: "water-temp",
        intro: null,
        localGuidance: null,
      },
      "/water-temp/corolla",
      { hasIntentData: true, dataRich: true },
    );
    expect(decision).toEqual({
      indexable: false,
      reason: "editorial-rejected",
    });
  });
});
