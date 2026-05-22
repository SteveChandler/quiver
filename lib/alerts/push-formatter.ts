import type { MatchingWindow } from "./types";
import {
  formatWaveHeightRange,
  formatWindSpeed,
  formatSwellPeriod,
} from "@/lib/formatters/surf-data";

const KNOTS_TO_MPH = 1.15078;

interface PushContent {
  title: string;
  body: string;
  data: { type: string; beach_id: string; forecast_at?: string };
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
function formatSimilarityPush(match: MatchingWindow): PushContent {
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
    data: { type: "similarity_match", beach_id: match.beach_id, forecast_at: forecastAt },
  };
}

export function formatPushNotification(matches: MatchingWindow[]): PushContent {
  const topMatch = matches[0];
  const topSnap = (topMatch.conditions_snapshot ?? {}) as {
    alert_type?: string;
  };

  // Similarity-match push copy: only apply when the single top match is the
  // similarity_match variant. If a user has both a similarity_match and
  // condition-alert queued for the same day, fall through to the consolidated
  // copy so we don't silently drop the other matches from the notification.
  if (matches.length === 1 && topSnap.alert_type === "similarity_match") {
    return formatSimilarityPush(topMatch);
  }

  const title = "Conditions lining up today";

  if (matches.length === 1) {
    const snap = topMatch.conditions_snapshot;
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
        : typeof snap.swell_1_period === "number" && Number.isFinite(snap.swell_1_period)
        ? snap.swell_1_period
        : null;
    const period = periodValue !== null ? ` @ ${formatSwellPeriod(periodValue)}` : "";
    const wind =
      typeof snap.wind_speed === "number" && Number.isFinite(snap.wind_speed)
        ? `, ${formatWindSpeed(snap.wind_speed * KNOTS_TO_MPH)}`
        : "";
    const beginnerReason =
      typeof snap.beginner_window_reason === "string"
        ? `, ${snap.beginner_window_reason.replace(/\.$/, "")}`
        : "";
    const timeWindow = formatTimeRange(topMatch.window_start, topMatch.window_end, topMatch.beach_timezone);
    let body = `${topMatch.beach_name} ${timeWindow} — ${waveHeight}${period}${wind}${beginnerReason}`;
    if (body.length > 150) body = `${topMatch.beach_name} ${timeWindow} — ${waveHeight}${period}`;
    if (body.length > 150) body = body.substring(0, 147) + "...";
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

  const showCount = Math.min(matches.length, 2);
  const parts: string[] = [];
  for (let i = 0; i < showCount; i++) {
    const m = matches[i];
    parts.push(`${m.beach_name} ${formatTimeRange(m.window_start, m.window_end, m.beach_timezone)}`);
  }
  let body = parts.join(" · ");
  if (matches.length > 2) body += ` and ${matches.length - 2} more`;
  if (body.length > 150) body = body.substring(0, 147) + "...";
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

function formatTimeRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", timeZone: timezone };
  const startStr = new Date(start).toLocaleTimeString("en-US", opts);
  const endStr = new Date(end).toLocaleTimeString("en-US", opts);
  return `${startStr}-${endStr}`;
}
