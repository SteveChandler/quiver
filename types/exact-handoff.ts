export const HANDOFF_CONTEXT_VERSION = 1 as const;

export enum HandoffSourceSurface {
  SurfComparison = "surf_comparison",
  SpotForecast = "spot_forecast",
  MyCoast = "my_coast",
}

export enum HandoffRecommendationMode {
  Now = "now",
  Best = "best",
  MySpots = "my_spots",
}

export enum HandoffRecommendationVerdict {
  Go = "go",
  Maybe = "maybe",
  No = "no",
  Unknown = "unknown",
}

export interface PriorRecommendationSummary {
  recommendationId: string;
  mode: HandoffRecommendationMode;
  verdict: HandoffRecommendationVerdict;
}

export interface HandoffContext {
  v: typeof HANDOFF_CONTEXT_VERSION;
  beachId: string;
  slug: string;
  windowId: string;
  sourceSurface: HandoffSourceSurface;
  generatedAt: string;
  expiresAt: string;
  priorRecommendation: PriorRecommendationSummary;
}

export type HandoffParseFailureReason =
  | "malformed"
  | "unsupported_version";

export type HandoffParseResult =
  | { ok: true; context: HandoffContext }
  | { ok: false; reason: HandoffParseFailureReason };

export interface HandoffReplacementIdentity {
  beachId: string;
  slug: string;
  windowId: string;
  recommendationId: string;
}

export type HandoffResolutionResult =
  | { classification: "exact"; context: HandoffContext }
  | {
      classification: "replaced";
      context: HandoffContext;
      replacement: HandoffReplacementIdentity;
      reason: "window_replaced";
    }
  | {
      classification: "beach_only";
      context: HandoffContext;
      reason: "expired" | "window_removed";
    }
  | {
      classification: "invalid";
      reason: HandoffParseFailureReason | "beach_removed";
    };
