/**
 * @jest-environment node
 */
import { getPublicSurfCall, PUBLIC_HOLD_REASONS } from "@/lib/utils/public-surf-call";

const AVAILABLE = { state: "available" as const, holdEpoch: "e1" };

describe("getPublicSurfCall", () => {
  it("speaks home's vocabulary for a go call", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 82, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "GOOD", action: "Worth a surf" });
  });

  it("picks the tier inside the maybe band from the score", () => {
    expect(getPublicSurfCall({ verdict: "MAYBE", score: 60, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "FAIR", action: "Worth a look" });
    expect(getPublicSurfCall({ verdict: "MAYBE", score: 45, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "RIDEABLE", action: "Slim pickings" });
  });

  it("never lets a score contradict the verdict", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 50, availability: AVAILABLE, isTomorrow: false }))
      .toMatchObject({ label: "GOOD" });
    expect(getPublicSurfCall({ verdict: "NO", score: 90, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "MEH", action: "Skip it" });
  });

  it("uses planning words when the window is tomorrow", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 75, availability: AVAILABLE, isTomorrow: true }))
      .toEqual({ kind: "call", label: "GOOD", action: "Worth planning" });
  });

  it("falls back to the verdict's band when the score is missing", () => {
    expect(getPublicSurfCall({ verdict: "MAYBE", score: null, availability: AVAILABLE, isTomorrow: false }))
      .toMatchObject({ label: "RIDEABLE" });
  });

  it("shows a hold, never a positive word, even when the raw verdict is YES", () => {
    const held = { state: "none" as const, reasonCode: "water_quality_hold" as const, holdEpoch: "h1" };
    expect(getPublicSurfCall({ verdict: "YES", score: 88, availability: held, isTomorrow: false }))
      .toEqual({ kind: "no_call", reason: PUBLIC_HOLD_REASONS.water_quality_hold });
  });

  it("treats a hold without a reason as unavailable", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 88, availability: { state: "none", holdEpoch: "h2" }, isTomorrow: false }))
      .toEqual({ kind: "no_call", reason: PUBLIC_HOLD_REASONS.hold_state_unavailable });
  });

  it("is unknown when there is no report", () => {
    expect(getPublicSurfCall({ verdict: null, score: null, availability: null, isTomorrow: false }))
      .toEqual({ kind: "unknown" });
  });
});
