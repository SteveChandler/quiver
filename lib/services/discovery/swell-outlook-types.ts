import type { BoardClass } from '@/lib/domains/rideability';

import type { SwellChangeKind, SwellConfidence } from './swell-tracking';

export type OutlookTier = SwellConfidence | 'early_signal';
export type OutlookStatus = 'forecast' | 'shrinking' | 'arrived' | 'faded';
export type OutlookChange = SwellChangeKind;
export type SwellFitStatus = 'in_range' | 'rideable' | 'below_range' | 'above_range' | 'unknown';
export type SwellSource = 'southern_hemisphere' | 'tropical' | 'north_pacific' | 'local' | 'unknown';

export interface SwellFit {
  status: SwellFitStatus;
  /** The user's board classes whose IDEAL band contains this size; empty unless in_range. */
  boards: BoardClass[];
}

export interface FaceHeightRangeFt {
  min: number;
  max: number;
}

export interface OutlookSwell {
  id: string;
  eventKey: string;
  tier: OutlookTier;
  status: OutlookStatus;
  change: OutlookChange;
  arrivalAt: string | null;
  peakAt: string;
  peakWindow: { from: string; to: string } | null;
  faceHeightFt: FaceHeightRangeFt;
  periodS: number | null;
  directionDeg: number;
  directionLabel: string;
  beach: { id: string; name: string };
  beachCount: number;
  notable: boolean;
  fit: SwellFit;
  source: SwellSource;
  stormName: string | null;
  sizeByOrientation: {
    southFacing: FaceHeightRangeFt | null;
    westFacing: FaceHeightRangeFt | null;
  };
  history: Array<{ runDate: string; peakAt: string; faceHeightFt: number; periodS: number | null }>;
}

export interface SwellOutlookResponse {
  generatedAt: string;
  runDate: string;
  horizonDays: number;
  homeBeach: { id: string; name: string } | null;
  swells: OutlookSwell[];
}

/** The list as it was returned for one snapshot run; sticky tracking compares against the previous one. */
export interface StoredOutlookList {
  runDate: string;
  swells: OutlookSwell[];
}
