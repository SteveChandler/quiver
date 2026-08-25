export const HANDOFF_CONTEXT_VERSION = 1 as const;

export enum HandoffSourceSurface {
  SurfComparison = "surf_comparison",
  SpotForecast = "spot_forecast",
  MyCoast = "my_coast",
}

export enum HandoffRecommendationMode {
  Now = "now",
  Best = "best",
  MySpots = "my-spots",
}

export enum HandoffRecommendationVerdict {
  Go = "go",
  Maybe = "maybe",
  No = "no",
  Unknown = "unknown",
}

export interface PriorRecommendationSummary {
  readonly recommendationId: string;
  readonly mode: HandoffRecommendationMode;
  readonly verdict: HandoffRecommendationVerdict;
}

export interface HandoffContext {
  readonly v: typeof HANDOFF_CONTEXT_VERSION;
  readonly beachId: string;
  readonly slug: string;
  readonly windowId: string;
  readonly sourceSurface: HandoffSourceSurface;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly priorRecommendation: PriorRecommendationSummary;
}

export type HandoffParseFailureReason =
  | "malformed"
  | "unsupported_version";

export type HandoffParseResult =
  | { readonly ok: true; readonly context: HandoffContext }
  | { readonly ok: false; readonly reason: HandoffParseFailureReason };

export interface HandoffReplacementIdentity {
  readonly beachId: string;
  readonly slug: string;
  readonly windowId: string;
  readonly recommendationId: string;
}

export type HandoffResolutionResult =
  | { readonly classification: "exact"; readonly context: HandoffContext }
  | {
      readonly classification: "replaced";
      readonly context: HandoffContext;
      readonly replacement: HandoffReplacementIdentity;
      readonly reason: "window_replaced";
    }
  | {
      readonly classification: "beach_only";
      readonly context: HandoffContext;
      readonly reason: "expired" | "window_removed";
    }
  | {
      readonly classification: "invalid";
      readonly reason: HandoffParseFailureReason | "beach_removed";
    };
