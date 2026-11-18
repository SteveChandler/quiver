import type { ActivationCall } from "@/lib/email/activation-call";
import { formatWindowLabel } from "@/lib/notifications/copy/daily-call-copy";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";
import { resolveOffshoreDeg } from "@/lib/domains/shared/wind-orientation";
import { classifyWindRelation, WIND_SPEED_GLASSY_MPH } from "@/lib/utils/wind-relation";
import { getLocalDateString } from "@/lib/utils/timezone-utils";

/**
 * Approved v4 activation copy. These templates, not the rendered text, go into
 * LIFECYCLE_CONTENT_HASH, so the per-user headline rotation never changes the hash.
 */
export const ACTIVATION_V4_COPY = {
  version: 1,
  eyebrow: "Your next window",
  headlines: {
    GOOD: ["{beach} is looking good {onDay}", "{Day}’s shaping up at {beach}", "{beach}’s lining up for {dayPart}", "Good one coming at {beach} {day}"],
    FAIR: ["{beach} could be fun {onDay}", "Decent shot at {beach} {day}"],
  },
  // Same phrases the app prints next to the label (quiver-native getSurfActionPhrase).
  actions: { GOOD: { now: "Worth a surf", upcoming: "Worth planning" }, FAIR: { now: "Worth a look", upcoming: "Worth a look" } },
  callLine: "{label} · {action}, {window}.",
  detail: { lead: "~{size}", period: " at {period}s", direction: " from the {direction}", wind: ", {wind}", end: "." },
  wind: { light: "light wind", relation: "{speed} mph {relation}", plain: "{speed} mph {direction} wind" },
  closing: "Check it before you drive. Quiver updates the call as the swell comes in.",
  cta: "See the window",
  fallback: { subject: "Planning a surf?", paragraph: "Check {beach} before you drive. Quiver tells you if it’s worth going.", cta: "Check {beach}" },
  noBeach: { subject: "Planning a surf?", paragraph: "Pick your home beach and Quiver tells you if it’s worth going.", cta: "Choose your home beach" },
  days: { today: "today", tomorrow: "tomorrow", on: "on {weekday}", morning: "morning", afternoon: "afternoon", thisPart: "this {part}", dayPart: "{day} {part}" },
} as const;

type Vars = Record<string, string>;

function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Missing activation copy value: ${key}`);
    return value;
  });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** FNV-1a, so a user sees one headline per day and different users see different ones. */
function rotationIndex(key: string, length: number): number {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(key)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash % length;
}

function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayWords(windowStartIso: string, nowIso: string, timezone: string): { day: string; onDay: string; dayPart: string } {
  const today = getLocalDateString(new Date(nowIso), timezone);
  const windowDate = getLocalDateString(new Date(windowStartIso), timezone);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(new Date(windowStartIso)));
  const part = hour < 12 ? ACTIVATION_V4_COPY.days.morning : ACTIVATION_V4_COPY.days.afternoon;
  if (windowDate === today) {
    return { day: ACTIVATION_V4_COPY.days.today, onDay: ACTIVATION_V4_COPY.days.today, dayPart: fill(ACTIVATION_V4_COPY.days.thisPart, { part }) };
  }
  if (windowDate === addDays(today, 1)) {
    const day = ACTIVATION_V4_COPY.days.tomorrow;
    return { day, onDay: day, dayPart: fill(ACTIVATION_V4_COPY.days.dayPart, { day, part }) };
  }
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(new Date(windowStartIso));
  return { day: weekday, onDay: fill(ACTIVATION_V4_COPY.days.on, { weekday }), dayPart: fill(ACTIVATION_V4_COPY.days.dayPart, { day: weekday, part }) };
}

function numberOf(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Names a relation only when the beach has a stored offshore bearing; a missing wind writes no clause. */
function windWords(call: Extract<ActivationCall, { kind: "window" }>): string | null {
  const speed = numberOf(call.window.forecast.windSpeed);
  if (speed === null) return null;
  if (speed < WIND_SPEED_GLASSY_MPH) return ACTIVATION_V4_COPY.wind.light;
  const direction = call.window.forecast.windDirection?.trim() || null;
  const fromDeg = cardinalToDegrees(direction);
  const offshoreDeg = resolveOffshoreDeg({ wind_offshore_deg: call.beach.windOffshoreDeg, aspect_deg: call.beach.aspectDeg });
  const rounded = String(Math.round(speed));
  if (fromDeg !== null && offshoreDeg !== null) {
    return fill(ACTIVATION_V4_COPY.wind.relation, { speed: rounded, relation: classifyWindRelation(fromDeg, offshoreDeg) });
  }
  return direction ? fill(ACTIVATION_V4_COPY.wind.plain, { speed: rounded, direction }) : `${rounded} mph wind`;
}

/** `beachSlug` null means the CTA opens home-beach onboarding. */
export interface ActivationContent { subject: string; paragraphs: string[]; cta: string; beachSlug: string | null }

export function activationWindowContent(call: Extract<ActivationCall, { kind: "window" }>, userId: string): ActivationContent {
  const { window, beach, label } = call;
  const days = dayWords(window.displayWindowStart, call.now, beach.timezone);
  const vars: Vars = { beach: beach.name, day: days.day, Day: capitalize(days.day), onDay: days.onDay, dayPart: days.dayPart };
  const headlines = ACTIVATION_V4_COPY.headlines[label];
  const subject = fill(headlines[rotationIndex(`${userId}|${getLocalDateString(new Date(call.now), beach.timezone)}`, headlines.length)], vars);
  const tense = Date.parse(window.displayWindowStart) > Date.parse(call.now) ? "upcoming" : "now";
  const callLine = fill(ACTIVATION_V4_COPY.callLine, {
    label, action: ACTIVATION_V4_COPY.actions[label][tense],
    window: formatWindowLabel(window.displayWindowStart, window.displayWindowEnd, beach.timezone, { forBody: true }),
  });
  const height = numberOf(window.forecast.waveHeight);
  if (height === null) throw new Error("Activation window has no wave height");
  const period = numberOf(window.forecast.period);
  const direction = window.forecast.swellDirection?.trim() || null;
  const wind = windWords(call);
  const size = formatWaveHeightRange(height).replace("-", "–").replace(/ft$/, " ft");
  const detail = [
    fill(ACTIVATION_V4_COPY.detail.lead, { size }),
    period === null ? "" : fill(ACTIVATION_V4_COPY.detail.period, { period: String(Math.round(period)) }),
    direction ? fill(ACTIVATION_V4_COPY.detail.direction, { direction }) : "",
    wind ? fill(ACTIVATION_V4_COPY.detail.wind, { wind }) : "",
    ACTIVATION_V4_COPY.detail.end,
  ].join("");
  return { subject, paragraphs: [callLine, detail, ACTIVATION_V4_COPY.closing], cta: ACTIVATION_V4_COPY.cta, beachSlug: beach.slug };
}

export function activationFallbackContent(call: Extract<ActivationCall, { kind: "fallback" }>): ActivationContent {
  const vars = { beach: call.beach.name };
  return {
    subject: ACTIVATION_V4_COPY.fallback.subject,
    paragraphs: [fill(ACTIVATION_V4_COPY.fallback.paragraph, vars)],
    cta: fill(ACTIVATION_V4_COPY.fallback.cta, vars),
    beachSlug: call.beach.slug,
  };
}

export function activationNoBeachContent(): ActivationContent {
  const copy = ACTIVATION_V4_COPY.noBeach;
  return { subject: copy.subject, paragraphs: [copy.paragraph], cta: copy.cta, beachSlug: null };
}
