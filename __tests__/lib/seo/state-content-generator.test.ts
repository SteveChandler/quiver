import { generateStateSummary, generateStateFAQ } from "@/lib/seo/state-content-generator";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";
import type { Beach } from "@/types/database";

function makeBeach(overrides: Partial<Beach> & { id: string; name: string }): Beach {
  return createBeachWithDefaults(overrides);
}

describe("generateStateSummary", () => {
  it("includes beach and city counts", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", city: "City1", skill_level: "beginner" }),
      makeBeach({ id: "2", name: "B", city: "City1" }),
      makeBeach({ id: "3", name: "C", city: "City2" }),
    ];
    const summary = generateStateSummary({
      stateName: "California",
      stateSlug: "ca",
      beaches,
      cityCount: 2,
    });

    expect(summary).toContain("3 surf spots");
    expect(summary).toContain("2 cities");
  });

  it("produces sensible fallback when beaches is empty", () => {
    const summary = generateStateSummary({
      stateName: "California",
      stateSlug: "ca",
      beaches: [],
      cityCount: 5,
    });

    expect(summary).not.toContain("0 surf");
    expect(summary).toContain("Explore surf cities across California");
    // Should still include regional data when available
    expect(summary).toContain("55-72");
  });

  it("shows beginner percentage when beginner spots exist", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", skill_level: "beginner" }),
      makeBeach({ id: "2", name: "B", skill_level: "beginner" }),
      makeBeach({ id: "3", name: "C", skill_level: "advanced" }),
      makeBeach({ id: "4", name: "D", skill_level: "intermediate" }),
    ];
    const summary = generateStateSummary({
      stateName: "California",
      stateSlug: "ca",
      beaches,
      cityCount: 1,
    });

    expect(summary).toContain("50%");
    expect(summary).toContain("a great destination");
  });

  it("reports intermediate/advanced when no beginner spots", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", skill_level: "advanced" }),
    ];
    const summary = generateStateSummary({
      stateName: "Oregon",
      stateSlug: "or",
      beaches,
      cityCount: 1,
    });

    expect(summary).toContain("intermediate to advanced");
  });

  it("includes break type distribution", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", break_type: "Beach Break" }),
      makeBeach({ id: "2", name: "B", break_type: "Beach Break" }),
      makeBeach({ id: "3", name: "C", break_type: "Reef Break" }),
    ];
    const summary = generateStateSummary({
      stateName: "California",
      stateSlug: "ca",
      beaches,
      cityCount: 1,
    });

    expect(summary).toContain("beach break");
    expect(summary).toContain("reef break");
  });

  it("includes water temperature for known states", () => {
    const summary = generateStateSummary({
      stateName: "Florida",
      stateSlug: "fl",
      beaches: [makeBeach({ id: "1", name: "A" })],
      cityCount: 1,
    });

    expect(summary).toContain("65-85");
    expect(summary).toContain("°F");
  });

  it("omits water temperature for unknown states", () => {
    const summary = generateStateSummary({
      stateName: "Unknown",
      stateSlug: "xx",
      beaches: [makeBeach({ id: "1", name: "A" })],
      cityCount: 1,
    });

    expect(summary).not.toContain("°F");
  });

  it("handles single beach singular forms", () => {
    const summary = generateStateSummary({
      stateName: "California",
      stateSlug: "ca",
      beaches: [makeBeach({ id: "1", name: "A" })],
      cityCount: 1,
    });

    expect(summary).toContain("1 surf spot");
    expect(summary).toContain("1 city");
  });
});

describe("generateStateFAQ", () => {
  it("returns 4 FAQ items", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", city: "City1", skill_level: "beginner" }),
    ];
    const faqs = generateStateFAQ({
      stateName: "California",
      stateSlug: "ca",
      beaches,
      cityCount: 1,
    });

    expect(faqs).toHaveLength(4);
  });

  it("FAQ 1 includes spot and city count", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A" }),
      makeBeach({ id: "2", name: "B" }),
    ];
    const faqs = generateStateFAQ({
      stateName: "Florida",
      stateSlug: "fl",
      beaches,
      cityCount: 3,
    });

    expect(faqs[0].question).toContain("How many");
    expect(faqs[0].answer).toContain("2 documented surf spots");
    expect(faqs[0].answer).toContain("3 coastal cities");
  });

  it("FAQ 1 handles 0 beaches without saying '0 documented'", () => {
    const faqs = generateStateFAQ({
      stateName: "California",
      stateSlug: "ca",
      beaches: [],
      cityCount: 5,
    });

    expect(faqs[0].answer).not.toContain("0 documented");
    expect(faqs[0].answer).toContain("5 coastal cities");
  });

  it("FAQ 2 includes best time with regional data", () => {
    const faqs = generateStateFAQ({
      stateName: "California",
      stateSlug: "ca",
      beaches: [makeBeach({ id: "1", name: "A" })],
      cityCount: 1,
    });

    const timeFaq = faqs.find((f) => f.question.includes("best time"));
    expect(timeFaq?.answer).toContain("warmest");
  });

  it("FAQ 2 provides fallback without regional data", () => {
    const faqs = generateStateFAQ({
      stateName: "Unknown",
      stateSlug: "xx",
      beaches: [makeBeach({ id: "1", name: "A" })],
      cityCount: 1,
    });

    const timeFaq = faqs.find((f) => f.question.includes("best time"));
    expect(timeFaq?.answer).toContain("varies by region");
  });

  it("FAQ 3 includes trunks season when available", () => {
    const faqs = generateStateFAQ({
      stateName: "Florida",
      stateSlug: "fl",
      beaches: [makeBeach({ id: "1", name: "A" })],
      cityCount: 1,
    });

    const wetsuitFaq = faqs.find((f) => f.question.includes("wetsuit"));
    expect(wetsuitFaq?.answer).toContain("Trunks are fine");
  });

  it("FAQ 4 lists top beginner cities when beginner spots exist", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", city: "Daytona Beach", skill_level: "beginner" }),
      makeBeach({ id: "2", name: "B", city: "Daytona Beach", skill_level: "beginner" }),
      makeBeach({ id: "3", name: "C", city: "Miami Beach", skill_level: "beginner" }),
      makeBeach({ id: "4", name: "D", city: "Miami Beach", skill_level: "advanced" }),
    ];
    const faqs = generateStateFAQ({
      stateName: "Florida",
      stateSlug: "fl",
      beaches,
      cityCount: 2,
    });

    const beginnerFaq = faqs.find((f) => f.question.includes("beginner"));
    expect(beginnerFaq?.answer).toContain("3 beginner-friendly spots");
    expect(beginnerFaq?.answer).toContain("Daytona Beach (2 spots)");
    expect(beginnerFaq?.answer).toContain("Miami Beach (1 spot)");
  });

  it("FAQ 4 handles no beginner spots", () => {
    const beaches = [
      makeBeach({ id: "1", name: "A", skill_level: "advanced" }),
    ];
    const faqs = generateStateFAQ({
      stateName: "Oregon",
      stateSlug: "or",
      beaches,
      cityCount: 1,
    });

    const beginnerFaq = faqs.find((f) => f.question.includes("beginner"));
    expect(beginnerFaq?.answer).toContain("intermediate to advanced");
  });
});
