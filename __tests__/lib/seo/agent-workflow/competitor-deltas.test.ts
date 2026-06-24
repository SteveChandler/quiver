import {
  extractMaterialDeltaSummaries,
} from "@/lib/seo/agent-workflow/competitor-deltas";

describe("SEO workflow competitor deltas", () => {
  it("extracts only material change bullets from the competitor report", () => {
    const markdown = [
      "# Competitor Research Refresh",
      "",
      "## Executive Summary",
      "",
      "- Broad context that should not be preferred when a tighter section exists.",
      "",
      "## Material Changes Since Last Check",
      "",
      "- Swellify IAP evidence now includes $4.99 alongside prior prices.",
      "- Duune store footprint is unchanged.",
      "- Swellify IAP evidence now includes $4.99 alongside prior prices.",
      "",
      "## Follow-Up Actions",
      "",
      "1. Confirm Swellify pricing.",
    ].join("\n");

    expect(extractMaterialDeltaSummaries(markdown)).toEqual([
      "Swellify IAP evidence now includes $4.99 alongside prior prices.",
      "Duune store footprint is unchanged.",
    ]);
  });

  it("falls back to executive summary bullets when material changes are absent", () => {
    const markdown = [
      "## Executive Summary",
      "",
      "- Swell Scope ratings increased.",
      "",
      "## Follow-Up Actions",
      "",
      "- This should not be included.",
    ].join("\n");

    expect(extractMaterialDeltaSummaries(markdown)).toEqual([
      "Swell Scope ratings increased.",
    ]);
  });
});
