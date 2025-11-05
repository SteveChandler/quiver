/**
 * LearnedPreferencesDisplay Component
 *
 * Displays user's learned surf preferences from session history with:
 * - Wave height and period ranges
 * - Wind tolerance and preferred directions
 * - Tide preferences
 * - Confidence indicator based on sample size
 * - Sample size badge
 *
 * Handles null/missing data gracefully with "Not enough data" fallbacks.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

interface LearnedPreferencesDisplayProps {
  preferences: UserSurfPreferences;
}

/**
 * Convert degrees to cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Get confidence indicator color based on confidence score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.75) return 'bg-green-500';
  if (confidence >= 0.50) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Get confidence explanation based on score
 */
function getConfidenceExplanation(confidence: number, sampleSize: number): string {
  if (confidence >= 0.75) {
    return `High confidence based on ${sampleSize} ${sampleSize === 1 ? 'session' : 'sessions'}. These preferences are well-established.`;
  }
  if (confidence >= 0.50) {
    return `Good confidence based on ${sampleSize} ${sampleSize === 1 ? 'session' : 'sessions'}. More sessions will improve accuracy.`;
  }
  return `Low confidence based on ${sampleSize} ${sampleSize === 1 ? 'session' : 'sessions'}. Log more sessions to improve accuracy.`;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function LearnedPreferencesDisplay({
  preferences,
}: LearnedPreferencesDisplayProps) {
  const hasWaveHeight =
    preferences.wave_min_ft !== null && preferences.wave_max_ft !== null;
  const hasWavePeriod =
    preferences.wave_period_min_s !== null && preferences.wave_period_max_s !== null;
  const hasWindSpeed = preferences.max_wind_mph !== null;
  const hasWindDirections =
    preferences.preferred_wind_directions &&
    preferences.preferred_wind_directions.length > 0;
  const hasTidePreferences =
    preferences.preferred_tide_statuses &&
    preferences.preferred_tide_statuses.length > 0;

  const confidenceColor = getConfidenceColor(preferences.confidence);
  const confidencePercentage = Math.round(preferences.confidence * 100);
  const confidenceExplanation = getConfidenceExplanation(
    preferences.confidence,
    preferences.sample_size
  );

  return (
    <div className="space-y-6">
      {/* Header with confidence and sample size */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-3 h-3 rounded-full ${confidenceColor}`}
                  data-testid="confidence-indicator"
                  aria-label={`${confidencePercentage}% confidence based on ${preferences.sample_size} sessions`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">{confidenceExplanation}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-sm font-medium text-gray-700">
            {confidencePercentage}% Confidence
          </span>
        </div>

        <Badge variant="secondary" className="text-xs">
          Based on {preferences.sample_size}{' '}
          {preferences.sample_size === 1 ? 'session' : 'sessions'}
        </Badge>
      </div>

      {/* Preferences Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wave Height */}
        <div className="space-y-2">
          <h4 role="heading" className="text-sm font-semibold text-gray-900">
            Wave Height
          </h4>
          <p className="text-base text-gray-700">
            {hasWaveHeight
              ? `${preferences.wave_min_ft} - ${preferences.wave_max_ft} ft`
              : 'Not enough data'}
          </p>
        </div>

        {/* Wave Period */}
        <div className="space-y-2">
          <h4 role="heading" className="text-sm font-semibold text-gray-900">
            Wave Period
          </h4>
          <p className="text-base text-gray-700">
            {hasWavePeriod
              ? `${preferences.wave_period_min_s} - ${preferences.wave_period_max_s} seconds`
              : 'Not enough data'}
          </p>
        </div>

        {/* Wind Tolerance */}
        <div className="space-y-2">
          <h4 role="heading" className="text-sm font-semibold text-gray-900">
            Wind Tolerance
          </h4>
          <p className="text-base text-gray-700">
            {hasWindSpeed
              ? `Up to ${preferences.max_wind_mph} mph`
              : 'Not enough data'}
          </p>
        </div>

        {/* Preferred Wind Directions */}
        <div className="space-y-2">
          <h4 role="heading" className="text-sm font-semibold text-gray-900">
            Preferred Wind Directions
          </h4>
          {hasWindDirections ? (
            <div className="flex flex-wrap gap-2">
              {preferences.preferred_wind_directions!.map((degrees) => (
                <Badge key={degrees} variant="outline" className="text-xs">
                  {degreesToCardinal(degrees)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-base text-gray-700">Not enough data</p>
          )}
        </div>

        {/* Preferred Tides */}
        <div className="space-y-2 md:col-span-2">
          <h4 role="heading" className="text-sm font-semibold text-gray-900">
            Preferred Tides
          </h4>
          {hasTidePreferences ? (
            <div className="flex flex-wrap gap-2">
              {preferences.preferred_tide_statuses!.map((status) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {capitalize(status)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-base text-gray-700">Not enough data</p>
          )}
        </div>
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500 italic">
        These preferences were learned by analyzing your highly-rated sessions (rating ≥ 3 stars).
        They help us recommend beaches that match your style.
      </p>
    </div>
  );
}
