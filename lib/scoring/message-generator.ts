/**
 * Natural language message generation utilities for surf scoring
 *
 * Generates human-readable messages describing surf conditions and windows.
 */

import type { WindowBoundaryReason } from './types';

/**
 * Generates a natural language message explaining a surf window
 *
 * @param start - The reason for the window start
 * @param end - The reason for the window end
 * @returns A human-readable message describing the window
 *
 * @example
 * generateWindowMessage(
 *   { time: new Date(), factor: 'tide', description: 'rising tide enters range' },
 *   { time: new Date(), factor: 'wind', description: 'wind picks up' }
 * )
 * // => "ride the incoming tide; window ends when wind picks up"
 */
export function generateWindowMessage(
  start: WindowBoundaryReason,
  end: WindowBoundaryReason
): string {
  const startDesc = getStartDescription(start);
  const endDesc = getEndDescription(end);

  if (startDesc && endDesc) {
    return `${startDesc}; ${endDesc}`;
  }

  if (endDesc) {
    return endDesc;
  }

  return startDesc || 'good conditions expected';
}

/**
 * Generates a description for window start based on the factor
 */
function getStartDescription(reason: WindowBoundaryReason): string {
  switch (reason.factor) {
    case 'tide':
      return `ride the ${reason.description.includes('rising') ? 'incoming' : 'dropping'} tide`;
    case 'wind':
      return 'before wind picks up';
    case 'score':
      return 'conditions line up';
    default:
      return '';
  }
}

/**
 * Generates a description for window end based on the factor
 */
function getEndDescription(reason: WindowBoundaryReason): string {
  switch (reason.factor) {
    case 'tide':
      return `ends when tide ${reason.description.includes('high') ? 'gets too high' : 'gets too low'}`;
    case 'wind':
      return 'window ends when wind picks up';
    case 'sunset':
      return 'surf until sunset';
    case 'score':
      return 'conditions degrade after';
    default:
      return '';
  }
}

/**
 * Input for generating condition summary
 */
export interface ConditionSummaryInput {
  /** Current wind condition */
  windCondition: 'offshore' | 'light' | 'cross' | 'onshore';
  /** Current tide condition */
  tideCondition: 'in_range' | 'low' | 'high' | 'rising' | 'falling';
  /** Current swell condition */
  swellCondition: 'optimal' | 'acceptable' | 'marginal';
  /** Optional warning message */
  warning?: string;
}

/**
 * Generates a natural language summary of current conditions
 *
 * @param input - Condition states for wind, tide, and swell
 * @returns A human-readable summary
 *
 * @example
 * generateConditionSummary({
 *   windCondition: 'offshore',
 *   tideCondition: 'in_range',
 *   swellCondition: 'optimal'
 * })
 * // => "offshore winds and tide in the sweet spot"
 */
export function generateConditionSummary(input: ConditionSummaryInput): string {
  const parts: string[] = [];

  // Add wind description
  switch (input.windCondition) {
    case 'offshore':
      parts.push('offshore winds');
      break;
    case 'light':
      parts.push('light winds');
      break;
    case 'cross':
      parts.push('cross-shore winds');
      break;
    // onshore winds are usually not highlighted positively
  }

  // Add tide description
  switch (input.tideCondition) {
    case 'in_range':
      parts.push('tide in the sweet spot');
      break;
    case 'rising':
      parts.push('incoming tide');
      break;
    case 'falling':
      parts.push('dropping tide');
      break;
    // low/high tides are usually warnings, not highlights
  }

  let summary = parts.join(' and ');

  // Append warning if provided
  if (input.warning) {
    summary += `. ${input.warning}`;
  }

  return summary || 'conditions look surfable';
}

/**
 * Formats a time in compact form like "6:15am"
 *
 * @param date - The date to format
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns Compact time string
 *
 * @example
 * formatTimeCompact(new Date('2026-01-14T06:15:00Z'), 'UTC')
 * // => "6:15am"
 */
export function formatTimeCompact(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  return formatter.format(date).toLowerCase().replace(' ', '');
}

/**
 * Formats a time range with shared AM/PM suffix when possible
 *
 * @param start - Start time
 * @param end - End time
 * @param timezone - IANA timezone string
 * @returns Formatted time range
 *
 * @example
 * formatTimeRange(
 *   new Date('2026-01-14T06:15:00Z'),
 *   new Date('2026-01-14T08:45:00Z'),
 *   'UTC'
 * )
 * // => "6:15-8:45am"
 */
export function formatTimeRange(
  start: Date,
  end: Date,
  timezone: string
): string {
  const startStr = formatTimeCompact(start, timezone);
  const endStr = formatTimeCompact(end, timezone);

  const startPeriod = startStr.slice(-2);
  const endPeriod = endStr.slice(-2);

  // If both times share the same period (am/pm), omit the first one
  if (startPeriod === endPeriod) {
    return `${startStr.slice(0, -2)}-${endStr}`;
  }

  return `${startStr}-${endStr}`;
}
