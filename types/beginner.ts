/**
 * Type definitions for the beginner page redesign.
 *
 * These types power the server actions in actions/beginner/beginner-actions.ts
 * and are consumed by beginner page components.
 */

// ================================================
// Conditions Badge
// ================================================

export type BeginnerConditionStatus = "great" | "fair" | "challenging";

export interface BeginnerConditionsBadge {
  status: BeginnerConditionStatus;
  statusLabel: string;
  waveHeight: string;
  wind: string;
  waterTemp: string;
  spotName: string;
  spotSlug: string;
}

// ================================================
// Right Now Conditions
// ================================================

export type MetricStatus = "good" | "caution" | "warning";

export interface ConditionMetric {
  value: string;
  label: string;
  status: MetricStatus;
}

export interface ConditionMetricWithIcon extends ConditionMetric {
  icon: string;
}

export interface RightNowMetrics {
  waveHeight: ConditionMetric;
  wind: ConditionMetric;
  waterTemp: ConditionMetricWithIcon;
  tide: ConditionMetric;
  crowd: ConditionMetric;
}

export type BeginnerVerdictRating =
  | "ideal"
  | "acceptable"
  | "poor"
  | "unknown";

export interface BeginnerVerdictReason {
  factor: "Wave size" | "Wind" | "Tide" | "Time window";
  detail: string;
}

export interface BeginnerVerdict {
  rating: BeginnerVerdictRating;
  reasons: BeginnerVerdictReason[];
}

export interface RightNowConditions {
  spotId: string;
  spotName: string;
  spotSlug: string;
  metrics: RightNowMetrics;
  beginnerVerdict: BeginnerVerdict;
  summary: string;
  lastUpdated: string;
}

// ================================================
// Beginner Beach with Editorial
// ================================================

export interface BeginnerBeachLogistics {
  parking: string;
  walkDistance: string;
  lifeguards: boolean;
  bestHours: string;
  facilities: string;
}

export interface BeginnerBeachEditorial {
  whyBeginnersLoveIt: string[];
  logistics: BeginnerBeachLogistics;
  description: string;
}

export interface BeginnerBeachWithEditorial {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  rating: number;
  reviewCount: number;
  skillLevel: string;
  breakType: string;
  currentWaveHeight: string | null;
  editorial: BeginnerBeachEditorial | null;
  photoUrl?: string | null;
}

// ================================================
// Beginner City Editorial
// ================================================

export interface BeginnerCityEditorial {
  id: string;
  citySlug: string;
  stateSlug: string;
  cityName: string;
  regionLabel: string;
  description: string[];
  sessionTiming: Array<{
    icon: string;
    title: string;
    summary: string;
  }>;
  quickLinks: Array<{
    label: string;
    href: string;
  }>;
  planningChecklist: string[];
}
