/**
 * Shared email formatting utilities.
 * Used by both email templates and email cron handlers.
 */

export interface ConditionLabelData {
  label: string;
  color: string;
}

/**
 * Get the condition label with styling data for the email template.
 * Score is on 0-100 scale from beach_daily_intel.
 * Labels follow the brand vocabulary (EPIC / GOOD / FAIR / RIDEABLE / MEH) — no emoji.
 */
export function getConditionLabel(score: number): ConditionLabelData {
  if (score >= 85) {
    return { label: "EPIC", color: "#00D4AA" };
  } else if (score >= 70) {
    return { label: "GOOD", color: "#1D9E75" };
  } else if (score >= 55) {
    return { label: "FAIR", color: "#FDB84B" };
  } else if (score >= 40) {
    return { label: "RIDEABLE", color: "#888780" };
  } else {
    return { label: "MEH", color: "#5F5E5A" };
  }
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
