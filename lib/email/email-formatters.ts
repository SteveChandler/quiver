/**
 * Shared email formatting utilities.
 * Used by both email templates and email cron handlers.
 */

import { scoreLabel, type ScoreLabel } from "@/lib/utils/score-color-utils";

interface ConditionLabelData {
  label: string;
  color: string;
}

interface FormattedBestWindow {
  start: string;
  end: string;
}

const CONDITION_LABEL_COLORS: Record<ScoreLabel, string> = {
  EPIC: "#00D4AA",
  GOOD: "#1D9E75",
  FAIR: "#FDB84B",
  RIDEABLE: "#888780",
  MEH: "#5F5E5A",
};

/**
 * Get the condition label with styling data for the email template.
 * Score is on 0-100 scale from beach_daily_intel.
 * Labels follow the brand vocabulary (scoreLabel: GOOD / FAIR / RIDEABLE / MEH while EPIC is off) — no emoji.
 */
export function getConditionLabel(score: number): ConditionLabelData {
  const label = scoreLabel(score);
  return { label, color: CONDITION_LABEL_COLORS[label] };
}

/**
 * Get just the condition label text for email subjects.
 * Score is on 0-100 scale from beach_daily_intel.
 */
export function getConditionLabelText(score: number): string {
  return getConditionLabel(score).label;
}

/**
 * Format time from database format (HH:MM:SS) to display format (h:mm AM/PM).
 */
export function formatDatabaseTime(timeStr: string | null): string | null {
  if (!timeStr) return null;

  try {
    // Parse HH:MM:SS or HH:MM format
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
  } catch {
    return timeStr;
  }
}

function parseDatabaseHour(timeStr: string | null): number | null {
  if (!timeStr) return null;

  const hour = Number(timeStr.split(":")[0]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

/**
 * Format a best surf window only when it is usable customer-facing copy.
 * Stored daily intel may predate timezone fixes, so suppress night/overnight
 * windows rather than emailing stale "firing at 2 AM" recommendations.
 */
export function formatActionableBestWindow(
  startTime: string | null,
  endTime: string | null
): FormattedBestWindow | null {
  const startHour = parseDatabaseHour(startTime);
  const endHour = parseDatabaseHour(endTime);

  if (startHour === null || endHour === null) return null;
  if (startHour < 5 || startHour >= 21) return null;
  if (endHour <= startHour) return null;

  const start = formatDatabaseTime(startTime);
  const end = formatDatabaseTime(endTime);

  if (!start || !end) return null;

  return { start, end };
}
