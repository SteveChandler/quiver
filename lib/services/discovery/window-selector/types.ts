/**
 * Window Selector Types
 *
 * Shared types and interfaces for the window selector module.
 *
 * @module lib/services/discovery/window-selector/types
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { CandidateRejection, PersonalizedForecastWindow, TimeSlot } from '@/types/personalization';
import type { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import type { BoardClass, RideabilityBand } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';

/**
 * Options for the window selector algorithm.
 */
export interface WindowSelectorOptions {
  onRejection?: (rejection: CandidateRejection) => void;
  forecasts: EnhancedForecastEntity[];
  beach: Beach;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  horizonHours?: number;
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>;
  timeSlot?: TimeSlot;
  now?: Date;
  maxWindows?: number;
  rowLiveness?: 'default' | 'until-next-row';
  /** Week Scout candidate scope; other rows remain available for refinement. */
  acceptWindowStart?: (start: Date) => boolean;
  disableBelowFloorFallback?: boolean;
  /** Reuse only within one immutable beach/day/preferences/clock context. */
  forecastPreparationCache?: Map<EnhancedForecastEntity[], ScoredForecast[]>;
  onWindowRanked?: (window: PersonalizedForecastWindow, rank: WindowSelectionRank) => void;
  rideabilityBand?: RideabilityBand | null;
  boardClasses?: readonly BoardClass[];
  userSkillLevel?: SkillLevel | string | null;
}

/**
 * Interface for the internal best window structure before sub-hour refinement.
 */
export interface CandidateWindow {
  forecast: EnhancedForecastEntity;
  start: Date;
  end: Date;
  score: number;
  selectionScore?: number;
  usedTideBoundaries: boolean;
}

/**
 * Scored forecast with metadata for window selection.
 */
export interface ScoredForecast {
  forecast: EnhancedForecastEntity;
  forecastTime: Date;
  score: number;
  selectionScore?: number;
  isToday: boolean;
  localHourStr: string;
}

export interface WindowSelectionRank {
  adjustedScore: number;
  score: number;
  start: Date;
  forecast: EnhancedForecastEntity;
}
