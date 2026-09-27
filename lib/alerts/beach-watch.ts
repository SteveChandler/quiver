import { SITE_URL } from "@/lib/constants/seo";
import { formatTimeCasual } from "@/lib/utils/date-time";
import { normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";
import type { PublicSurfCall } from "@/lib/utils/public-surf-call";

export interface BeachWatchWindow {
  start: string;
  end: string;
  forecastAt: string;
  label: string;
}

/** Only a window worth surfing, that hasn't ended, can be watched. */
export function selectBeachWatchWindow(input: {
  call: PublicSurfCall;
  start: string | null;
  end: string | null;
  forecastAt: string | null;
  timezone: string;
  isTomorrow: boolean;
  now?: Date;
}): BeachWatchWindow | null {
  if (input.call.kind !== "call" || input.call.label === "MEH") return null;
  if (!input.start || !input.end) return null;
  const now = (input.now ?? new Date()).getTime();
  if (!(Date.parse(input.end) > now)) return null;
  const range = `${formatTimeCasual(input.start, input.timezone)}–${formatTimeCasual(input.end, input.timezone)}`;
  return {
    start: input.start,
    end: input.end,
    forecastAt: input.forecastAt ?? input.start,
    label: `${input.isTomorrow ? "tomorrow" : "today"} ${range}`,
  };
}

export interface BeachWatchRuleBody {
  beach_id: string;
  name: string;
  preset_type: "watched_call";
  conditions: {
    watched_call: {
      version: 1;
      recommendationId: string;
      sourceSurface: "beach_detail";
      mode: "beach-detail";
      beachId: string;
      windowStart: string;
      windowEnd: string;
      forecastAt: string | null;
      recommendationState: "ready_today" | "future_fallback";
      conditionScore: number;
      personalMatchScore: number;
      overallScore: number;
      reasonType: string;
      dedupeKey: string;
    };
  };
  notify_email: boolean;
  notify_push: boolean;
}

/** Same identity and dedupe key as the app's watch (quiver-native src/lib/alert-rule-seed.ts). */
export function buildBeachWatchRule(input: {
  beachId: string;
  beachName: string;
  window: BeachWatchWindow;
  score: number | null;
}): BeachWatchRuleBody {
  const { beachId, window } = input;
  const recommendationId = `beach-detail:${beachId}:${window.forecastAt}`;
  const score = Math.max(0, Math.min(100, Math.round(input.score ?? 0)));
  const dedupeKey = ["watched-call.v1", beachId, recommendationId, window.start, window.end]
    .map(encodeURIComponent)
    .join(":");
  return {
    beach_id: beachId,
    name: `Watch ${input.beachName} ${window.label}`,
    preset_type: "watched_call",
    conditions: {
      watched_call: {
        version: 1,
        recommendationId,
        sourceSurface: "beach_detail",
        mode: "beach-detail",
        beachId,
        windowStart: window.start,
        windowEnd: window.end,
        forecastAt: normalizeForecastWindowParam(window.forecastAt),
        recommendationState: window.label.startsWith("tomorrow") ? "future_fallback" : "ready_today",
        conditionScore: score,
        personalMatchScore: 0,
        overallScore: score,
        reasonType: "public_call",
        dedupeKey,
      },
    },
    notify_email: false,
    notify_push: true,
  };
}

/** A universal link: the app opens this beach at this window; the web shows the handoff page. */
export function buildBeachWatchAppLink(slug: string, forecastAt: string): string {
  const params = new URLSearchParams({ window: forecastAt });
  return `${SITE_URL.replace(/\/$/, "")}/app/spot/${encodeURIComponent(slug.trim().toLowerCase())}?${params.toString()}`;
}
