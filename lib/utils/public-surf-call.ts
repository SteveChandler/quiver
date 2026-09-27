import { getCanonicalVerdictCall } from "@/components/forecast/score-band-call";
import type {
  RecommendationAvailability,
  RecommendationHoldReasonCode,
} from "@/lib/recommendations/major-event-hold/types";
import type { ScoreLabel } from "@/lib/utils/score-color-utils";
import type { SurfCallVerdict } from "@/lib/utils/surf-call-logic";

/**
 * The beach page's call for everyone, signed in or not: home's words, not
 * personalized. The report has already been through the major-event hold
 * check (`getSpotSurfReportPublic`), so a held window arrives as state "none".
 */
export type PublicSurfCall =
  | { kind: "call"; label: ScoreLabel; action: string }
  | { kind: "no_call"; reason: string }
  | { kind: "unknown" };

export interface PublicSurfCallInput {
  verdict: SurfCallVerdict | null | undefined;
  score: number | null | undefined;
  availability: RecommendationAvailability | null | undefined;
  isTomorrow: boolean;
}

const CANONICAL_VERDICT = { YES: "go", MAYBE: "maybe", NO: "no" } as const;

export const PUBLIC_HOLD_REASONS: Record<RecommendationHoldReasonCode, string> = {
  major_event_hold: "A big swell or storm is running, so there's no call here right now.",
  water_quality_hold: "There's a water-quality advisory here, so there's no call until it clears.",
  hold_state_unavailable: "We can't confirm conditions right now, so there's no call.",
};

export function getPublicSurfCall(input: PublicSurfCallInput): PublicSurfCall {
  if (input.availability?.state === "none") {
    const reasonCode = input.availability.reasonCode ?? "hold_state_unavailable";
    return { kind: "no_call", reason: PUBLIC_HOLD_REASONS[reasonCode] };
  }
  if (!input.verdict) return { kind: "unknown" };

  const call = getCanonicalVerdictCall(
    CANONICAL_VERDICT[input.verdict],
    input.score,
    input.isTomorrow ? "upcoming" : "now",
  );
  return { kind: "call", label: call.label, action: call.action };
}
