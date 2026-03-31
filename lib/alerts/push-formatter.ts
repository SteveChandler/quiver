import type { MatchingWindow } from "./types";

interface PushContent {
  title: string;
  body: string;
  data: { type: string; beach_id: string };
}

export function formatPushNotification(matches: MatchingWindow[]): PushContent {
  const title = "Conditions lining up today";
  const topMatch = matches[0];

  if (matches.length === 1) {
    const snap = topMatch.conditions_snapshot;
    const waveHeight = snap.wave_height ? `${snap.wave_height}ft` : "";
    const period = snap.swell_1_period ? ` @ ${snap.swell_1_period}s` : "";
    const wind = snap.wind_speed ? `, ${snap.wind_speed}kt wind` : "";
    const timeWindow = formatTimeRange(topMatch.window_start, topMatch.window_end, topMatch.beach_timezone);
    let body = `${topMatch.beach_name} ${timeWindow} — ${waveHeight}${period}${wind}`;
    if (body.length > 150) body = `${topMatch.beach_name} ${timeWindow} — ${waveHeight}${period}`;
    if (body.length > 150) body = body.substring(0, 147) + "...";
    return { title, body, data: { type: "forecast_alert", beach_id: topMatch.beach_id } };
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
  return { title, body, data: { type: "forecast_alert", beach_id: topMatch.beach_id } };
}

function formatTimeRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", timeZone: timezone };
  const startStr = new Date(start).toLocaleTimeString("en-US", opts);
  const endStr = new Date(end).toLocaleTimeString("en-US", opts);
  return `${startStr}-${endStr}`;
}
