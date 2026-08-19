import type { MatchingWindow } from "./types";
import {
  formatWaveHeightRange,
  formatWindSpeed,
  formatSwellPeriod,
} from "@/lib/formatters/surf-data";

const KNOTS_TO_MPH = 1.15078;
const MAX_BODY_LENGTH = 150;

interface PushContent {
  title: string;
  body: string;
  data: { type: string; beach_id: string; forecast_at?: string };
}

export type PushDecisionVerdict = "go" | "maybe" | "no";

/**
 * Map a normalized window quality (best_score, 0..1) to a punchy, honest,
 * brand-consistent word. NOT the 0-100 composite — do not route through
 * getConditionLabel. Never implies ML correction.
 */
export function qualityWord(score: number): string {
  if (!Number.isFinite(score)) return "Looking good";
  if (score >= 0.85) return "Pumping";
  if (score >= 0.7) return "Firing";
  if (score >= 0.45) return "Looking good";
  if (score >= 0.3) return "Fun";
  return "Rideable";
}

/**
 * Short surf-voice phrase for the beginner sandy window. The snapshot carries a
 * verbose comma-joined reason for the email; the push only has room for a punchy
 * tag, so condense it here rather than spilling past the body budget.
 */
function shortBeginnerReason(raw: string): string {
  return raw.trim().length > 0 ? "beginner-friendly" : "";
}

/**
 * Phase 2 similarity-alerts dispatch branch.
 *
 * A queued alert is a similarity_match when the evaluator stamped
 * conditions_snapshot.alert_type = 'similarity_match' at enqueue time (see
 * app/api/cron/similarity-alerts/route.ts). In that case the push copy comes
 * from the stamped score + label, and the body stays generic because the
 * evaluator does not snapshot wind/wave context.
 */
function formatSimilarityPush(
  match: MatchingWindow,
  _decision?: PushDecisionVerdict,
): PushContent {
  const snap = match.conditions_snapshot as {
    alert_type?: string;
    score?: number;
    label?: string;
    forecast_at?: string;
  };
  const score = typeof snap.score === "number" ? snap.score.toFixed(1) : "";
  const label = typeof snap.label === "string" ? snap.label : "";
  const forecastAt =
    typeof snap.forecast_at === "string" ? snap.forecast_at : match.best_hour;
  const weekday = new Date(forecastAt).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: match.beach_timezone,
  });
  const time = new Date(forecastAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    timeZone: match.beach_timezone,
  });

  const scoreLabel = [score, label].filter(Boolean).join(" ");
  const titleParts = [match.beach_name];
  if (scoreLabel) titleParts.push(scoreLabel);
  titleParts.push(`${weekday} ${time}`);

  return {
    title: titleParts.join(" · "),
    // Intentionally generic — don't fabricate wind/wave details the cron
    // didn't capture at enqueue time.
    body: "Conditions match your profile today.",
    data: {
      type: "similarity_match",
      beach_id: match.beach_id,
      forecast_at: forecastAt,
    },
  };
}

export function formatPushNotification(
  matches: MatchingWindow[],
  decision?: PushDecisionVerdict,
  primaryMatch?: MatchingWindow,
): PushContent {
  const orderedMatches =
    primaryMatch && matches.includes(primaryMatch)
      ? [primaryMatch, ...matches.filter((match) => match !== primaryMatch)]
      : matches;
  const topMatch = orderedMatches[0];
  if (!topMatch)
    throw new Error("formatPushNotification requires at least one match");
  const topSnap = (topMatch.conditions_snapshot ?? {}) as {
    alert_type?: string;
  };

  // Similarity-match push copy: only apply when the single top match is the
  // similarity_match variant. If a user has both a similarity_match and
  // condition-alert queued for the same day, fall through to the consolidated
  // copy so we don't silently drop the other matches from the notification.
  if (
    orderedMatches.length === 1 &&
    topSnap.alert_type === "similarity_match"
  ) {
    return formatSimilarityPush(topMatch, decision);
  }

  if (orderedMatches.length === 1) {
    const snap = topMatch.conditions_snapshot;
    const timeWindow = formatTitleWindow(
      topMatch.window_start,
      topMatch.window_end,
      topMatch.beach_timezone,
    );
    const isBeginnerWindow =
      typeof snap.beginner_window_reason === "string" &&
      snap.beginner_window_reason.trim().length > 0;
    // A beginner-window rule is intentionally about approachable surf, not
    // a universal quality claim. Keep the actual wave range in the body and
    // avoid calling a 1–2 ft window "Firing" on the lock screen.
    const titleLabel = isBeginnerWindow
      ? "Beginner-friendly"
      : decision === "go"
        ? "Firing"
        : decision === "no"
          ? "Not ideal"
          : decision === "maybe"
            ? "Worth a look"
            : qualityWord(topMatch.best_score);
    const title = `${titleLabel} — ${topMatch.beach_name}, ${timeWindow}`;

    // Match the email's units + rounding so push and email don't disagree.
    // wind_speed is knots (per ForecastHour), wave_period prefers the total-
    // spectrum field that the website Current Conditions card reads, with
    // swell_1_period as fallback.
    const waveHeight =
      typeof snap.wave_height === "number" && Number.isFinite(snap.wave_height)
        ? formatWaveHeightRange(snap.wave_height)
        : "";
    const periodValue =
      typeof snap.wave_period === "number" && Number.isFinite(snap.wave_period)
        ? snap.wave_period
        : typeof snap.swell_1_period === "number" &&
            Number.isFinite(snap.swell_1_period)
          ? snap.swell_1_period
          : null;
    const period =
      periodValue !== null ? ` @ ${formatSwellPeriod(periodValue)}` : "";
    const wind =
      typeof snap.wind_speed === "number" && Number.isFinite(snap.wind_speed)
        ? `, ${formatWindSpeed(snap.wind_speed * KNOTS_TO_MPH)}`
        : "";
    const bodyTimeWindow = formatTimeRange(
      topMatch.window_start,
      topMatch.window_end,
      topMatch.beach_timezone,
    );
    const core = `${topMatch.beach_name} ${bodyTimeWindow} — ${waveHeight}${period}${wind}`;

    // Append the beginner reason only when it fits within the budget — never
    // let it trigger the truncation fallback that would drop the real data.
    const beginnerReason =
      typeof snap.beginner_window_reason === "string"
        ? shortBeginnerReason(snap.beginner_window_reason)
        : "";
    const withReason = beginnerReason ? `${core}, ${beginnerReason}` : core;

    let body = withReason.length <= MAX_BODY_LENGTH ? withReason : core;
    if (body.length > MAX_BODY_LENGTH)
      body = body.substring(0, MAX_BODY_LENGTH - 3) + "...";
    return {
      title,
      body,
      data: {
        type: "forecast_alert",
        beach_id: topMatch.beach_id,
        forecast_at: topMatch.best_hour ?? topMatch.window_start,
      },
    };
  }

  // Canonical producers pass their selected match explicitly. Keep it first so
  // lock-screen identity and summary order cannot drift from the decision.
  const sorted =
    primaryMatch && matches.includes(primaryMatch)
      ? orderedMatches
      : [...matches].sort((a, b) => b.best_score - a.best_score);
  const best = sorted[0];
  const others = sorted.length - 1;
  const title = `${best.beach_name} + ${others} more break${others === 1 ? "" : "s"} today`;

  const showCount = Math.min(sorted.length, 2);
  const parts: string[] = [];
  for (let i = 0; i < showCount; i++) {
    const m = sorted[i];
    parts.push(
      `${m.beach_name} ${formatTimeRange(m.window_start, m.window_end, m.beach_timezone)}`,
    );
  }
  let body = parts.join(" · ");
  if (sorted.length > 2) body += ` and ${sorted.length - 2} more`;
  if (body.length > MAX_BODY_LENGTH)
    body = body.substring(0, MAX_BODY_LENGTH - 3) + "...";
  return {
    title,
    body,
    data: {
      type: "forecast_alert",
      beach_id: best.beach_id,
      forecast_at: best.best_hour ?? best.window_start,
    },
  };
}

/**
 * Title window: en-dash, meridiem collapsed when shared ("7–9 AM"), so the
 * lock-screen line reads tight. Body uses formatTimeRange (hyphen, full).
 */
function formatTitleWindow(
  start: string,
  end: string,
  timezone: string,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    hour12: true,
    timeZone: timezone,
  };
  const startParts = new Intl.DateTimeFormat("en-US", opts).formatToParts(
    new Date(start),
  );
  const endParts = new Intl.DateTimeFormat("en-US", opts).formatToParts(
    new Date(end),
  );
  const startHour = startParts.find((p) => p.type === "hour")?.value ?? "";
  const startMeridiem =
    startParts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const endHour = endParts.find((p) => p.type === "hour")?.value ?? "";
  const endMeridiem = endParts.find((p) => p.type === "dayPeriod")?.value ?? "";

  if (startMeridiem && startMeridiem === endMeridiem) {
    return `${startHour}–${endHour} ${endMeridiem}`;
  }
  return `${startHour} ${startMeridiem}–${endHour} ${endMeridiem}`.trim();
}

function formatTimeRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    timeZone: timezone,
  };
  const startStr = new Date(start).toLocaleTimeString("en-US", opts);
  const endStr = new Date(end).toLocaleTimeString("en-US", opts);
  return `${startStr}-${endStr}`;
}
