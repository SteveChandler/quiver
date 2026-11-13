import { gateSurfDiscoveryResponse } from "@/lib/services/discovery/surf-discovery-gating";

const paid = { hasPaidAccess: true } as never;

function respond(rec: Record<string, unknown>) {
  return gateSurfDiscoveryResponse({ recommendations: [rec], includedRecommendations: [rec] } as never, paid);
}

describe("gateSurfDiscoveryResponse personal explanation", () => {
  it("sends no personal explanation when nothing specific explains the window", () => {
    const result = respond({ reasons: [], conditionBadges: [] });
    const rec = result.recommendations[0] as { personalExplanation?: string };

    expect(rec.personalExplanation).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/lines up with your profile/);
  });

  it("keeps a specific explanation built from the window's own parts", () => {
    const result = respond({ reasons: [], conditionBadges: [{ label: "Offshore" }, { label: "Mid tide" }] });
    const rec = result.recommendations[0] as { personalExplanation?: string };

    expect(rec.personalExplanation).toBe("Conditions line up: Offshore, Mid tide.");
  });

  it("joins scorer sentences with one full stop each, never \"..\"", () => {
    const result = respond({
      reasons: ["Good size at 3–4 ft.", "Solid swell period behind it."],
      conditionBadges: [{ label: "Offshore" }],
    });
    const rec = result.recommendations[0] as { personalExplanation?: string };

    expect(rec.personalExplanation).toBe(
      "Good size at 3–4 ft. Solid swell period behind it. Conditions line up: Offshore.",
    );
    expect(rec.personalExplanation).not.toContain("..");
  });
});
