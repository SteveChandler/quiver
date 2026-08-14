// Bluesky Auto-Post Edge Function
// Queries forecast data, scores beaches for beginner-friendliness,
// generates posts from templates, and publishes to Bluesky via AT Protocol.
//
// Invoked by pg_cron with { post_type: "go_no" | "weekend_wave" | "longboard_sunday" | "dev_notes" }

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  authorizationContextKey,
  evaluateHoldAuthorizationRows,
  shouldUseObjectiveSafetyPost,
} from "./hold-policy.ts";
import type {
  HoldAuthorizationContext,
  HoldAuthorizationResolution,
} from "./hold-policy.ts";
import { filterBeachesByWaterQualityHolds } from "./water-quality-filter.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostType = "go_no" | "weekend_wave" | "longboard_sunday" | "dev_notes";
type Verdict = "go" | "maybe" | "no";

interface PostRequest {
  post_type: PostType;
}

interface BeachRow {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
}

interface ForecastRow {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
  wave_period: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  wind_direction_deg: number | null;
  tide_height: string | null;
  tide_status: string | null;
  swell_1_period: string | null;
}

interface ScoredBeach {
  beach: BeachRow;
  score: number;
  verdict: Verdict;
  forecasts: ForecastRow[];
  avgHeight: number;
  avgWindSpeed: number;
  avgSwellPeriod: number;
  windDesc: string;
  tideDesc: string;
  vibeWord: string;
  oneLinerReason: string;
  caveat: string;
  heightRange: string;
  bestWindow: string;
  endTime: string;
  beachPath: string;
}

interface BlueskySession {
  accessJwt: string;
  did: string;
}

interface PostingConfig {
  id: string;
  post_type: string;
  enabled: boolean;
  cadence_phase: string;
  last_posted_at: string | null;
}

interface PostingLogEntry {
  post_type: PostType;
  bluesky_uri: string | null;
  content_text: string;
  image_url: string | null;
  template_index: number;
  beaches_featured: string[];
  success: boolean;
  error_message: string | null;
}

interface DevNoteRow {
  id: string;
  raw_text: string;
  polished_text: string | null;
  posted: boolean;
  posted_at: string | null;
  posting_log_id: string | null;
  created_at: string;
}

interface GeneratedForecastPost {
  text: string;
  templateIndex: number;
  beachesFeatured: string[];
  imageUrl: string | null;
  authorizationContexts: HoldAuthorizationContext[];
}

type HoldFilterResult =
  | { state: "resolved"; scoredBeaches: ScoredBeach[] }
  | { state: "unavailable"; scoredBeaches: [] };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUESKY_API = "https://bsky.social/xrpc";
const APP_BASE_URL = "https://quiversurf.app";

// San Diego city filter — matches the `city` column in the beaches table
const SAN_DIEGO_CITY = "San Diego";

// Scoring thresholds
const SCORE_GO = 7;
const SCORE_MAYBE = 4;

// Template rotation: avoid last N posts of same type
const TEMPLATE_ROTATION_LOOKBACK = 3;

function objectiveSafetyPost(): GeneratedForecastPost {
  return {
    text:
      "San Diego swell and safety awareness\n" +
      "Wave, wind, and tide conditions can change quickly. Check current forecasts and official advisories before entering the water.\n" +
      "quiversurf.app",
    templateIndex: -1,
    beachesFeatured: [],
    imageUrl: null,
    authorizationContexts: [],
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const GO_TEMPLATES = [
  `San Diego -- today's a go.\n{beach_1}: {height_1}ft, {wind_desc_1}. {reason_1}.\n{beach_2}: {height_2}ft, {wind_desc_2}. {reason_2}.\nBest window: {time_window}.\nquiversurf.app`,
  `Get out there, San Diego.\n{beach_1} is looking {vibe_1} -- {height_1}ft with {wind_desc_1}.\n{time_window} is your window.\nquiversurf.app`,
  `Good morning, San Diego. Conditions are working.\n{beach_1}: {height_1}ft, {wind_desc_1}.\n{beach_2}: {height_2}ft, {wind_desc_2}.\nHead out before {end_time}.\nquiversurf.app`,
];

const MAYBE_TEMPLATES = [
  `San Diego -- maybe today.\n{beach_1} could work if you go early -- {height_1}ft but {caveat_1}.\n{beach_2} is a skip unless you're comfortable in {condition_1}.\nquiversurf.app`,
  `Not the cleanest day in San Diego, but {beach_1} has a window.\n{height_1}ft with {wind_desc_1}. Go {time_window} if you're going.\nquiversurf.app`,
];

const NO_TEMPLATES = [
  `San Diego -- rest day.\n{reason} across the board.\nGood day to stretch, wax your board, or watch some surf clips.\nTomorrow's looking {tomorrow_outlook}.\nquiversurf.app`,
  `Skip it today, San Diego. {reason}.\nSave your energy -- {tomorrow_outlook} tomorrow.\nquiversurf.app`,
];

const WEEKEND_WAVE_TEMPLATES = [
  `Weekend Wave Check -- San Diego\nSaturday: {sat_verdict} -- {sat_summary}\nSunday: {sun_verdict} -- {sun_summary}\nBest call: {best_window}.\nFull forecast: quiversurf.app`,
  `Your San Diego weekend surf plan:\n{best_day} {best_time} is the move.\n{best_beach} -- {height_1}ft, {wind_desc_1}, {vibe_1}.\nThe rest of the weekend: {other_summary}.\nquiversurf.app`,
  `Weekend outlook for San Diego:\n{best_day} is your day. {best_beach} looking {vibe_1}.\n{other_day}: {other_summary}.\nquiversurf.app`,
];

const LONGBOARD_SUNDAY_TEMPLATES = [
  `Longboard Sunday -- {beach_1}\n{height_1}ft, {wind_desc_1}, {tide_desc_1}.\n{vibe_line}.\nquiversurf.app/{beach_path_1}`,
  `Small wave paradise today.\n{beach_1}: {height_1}ft and {wind_desc_1}.\nGrab the log, take your time.\nquiversurf.app/{beach_path_1}`,
  `Sunday session at {beach_1}.\n{height_1}ft, {wind_desc_1}. {tide_desc_1}.\nThis is what longboarding is for.\nquiversurf.app/{beach_path_1}`,
];

// ---------------------------------------------------------------------------
// Beginner scoring
// ---------------------------------------------------------------------------

function parseNumeric(val: string | null): number | null {
  if (val === null || val === undefined || val === "") return null;
  // Handle range strings like "2-3" by taking the average
  if (val.includes("-")) {
    const parts = val.split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return (parts[0] + parts[1]) / 2;
    }
  }
  // Handle strings like "2ft" or "8 mph"
  const cleaned = val.replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function scoreWaveHeight(ft: number): number {
  if (ft >= 1 && ft <= 3) return 3;
  if (ft > 3 && ft < 5) return 1;
  if (ft >= 5) return -3;
  // < 1ft is too small even for beginners
  return 0;
}

function scoreSwellPeriod(seconds: number): number {
  if (seconds >= 8 && seconds <= 12) return 2;
  if (seconds > 12 && seconds < 15) return 0;
  if (seconds >= 15) return -2;
  // Short period (< 8s) is generally messy
  return -1;
}

function scoreWindSpeed(mph: number): number {
  if (mph < 8) return 2;
  if (mph >= 8 && mph < 12) return 0;
  return -2;
}

function scoreWindDirection(direction: string | null, directionDeg: number | null): number {
  if (!direction && directionDeg === null) return 0;

  const dir = (direction || "").toUpperCase().trim();

  // Check for explicitly labeled offshore/calm
  if (dir === "OFFSHORE" || dir === "CALM" || dir === "VARIABLE") return 2;
  if (dir === "ONSHORE") return -1;

  // Use degree-based heuristic if available
  // For San Diego (west-facing): offshore ~ E (90 deg), onshore ~ W (270 deg)
  if (directionDeg !== null) {
    // Offshore range: NE to SE (45-135 deg)
    if (directionDeg >= 45 && directionDeg <= 135) return 2;
    // Onshore range: SW to NW (225-315 deg)
    if (directionDeg >= 225 && directionDeg <= 315) return -1;
    // Cross-shore or calm
    return 1;
  }

  // Cardinal direction fallback
  if (dir === "E" || dir === "NE" || dir === "SE") return 2;
  if (dir === "W" || dir === "SW" || dir === "NW") return -1;
  if (dir === "N" || dir === "S") return 1;
  return 0;
}

function scoreTide(tideStatus: string | null, tideHeightFt: number | null): number {
  const status = (tideStatus || "").toLowerCase();
  if (status.includes("mid")) return 1;
  if (status.includes("rising") || status.includes("incoming")) return 1;
  if (status.includes("high") || status.includes("low")) return -1;

  // Fallback: use height if available (SD typical range 0-6ft)
  if (tideHeightFt !== null) {
    if (tideHeightFt >= 2 && tideHeightFt <= 4) return 1;
    if (tideHeightFt < 0.5 || tideHeightFt > 5.5) return -1;
  }
  return 0;
}

function computeBeginnerScore(forecasts: ForecastRow[]): number {
  if (forecasts.length === 0) return 0;

  let totalScore = 0;
  let count = 0;

  for (const f of forecasts) {
    const waveHt = parseNumeric(f.wave_height);
    const swellPeriod = parseNumeric(f.swell_1_period) ?? parseNumeric(f.wave_period);
    const windSpd = parseNumeric(f.wind_speed);
    const tideHt = parseNumeric(f.tide_height);

    let score = 0;
    score += waveHt !== null ? scoreWaveHeight(waveHt) : 0;
    score += swellPeriod !== null ? scoreSwellPeriod(swellPeriod) : 0;
    score += windSpd !== null ? scoreWindSpeed(windSpd) : 0;
    score += scoreWindDirection(f.wind_direction, f.wind_direction_deg);
    score += scoreTide(f.tide_status, tideHt);

    totalScore += score;
    count++;
  }

  return count > 0 ? Math.round(totalScore / count) : 0;
}

function verdictFromScore(score: number): Verdict {
  if (score >= SCORE_GO) return "go";
  if (score >= SCORE_MAYBE) return "maybe";
  return "no";
}

// ---------------------------------------------------------------------------
// Data slot helpers
// ---------------------------------------------------------------------------

function avgValue(forecasts: ForecastRow[], field: keyof ForecastRow): number {
  const vals = forecasts
    .map((f) => parseNumeric(f[field] as string | null))
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function deriveWindDesc(avgSpeed: number, direction: string | null): string {
  const speedWord = avgSpeed < 5 ? "glassy" : avgSpeed < 8 ? "light" : avgSpeed < 12 ? "moderate" : "strong";
  const dirWord = (() => {
    if (!direction) return "";
    const d = direction.toUpperCase().trim();
    if (d === "OFFSHORE" || d === "E" || d === "NE" || d === "SE") return "offshore";
    if (d === "ONSHORE" || d === "W" || d === "SW" || d === "NW") return "onshore";
    if (d === "CALM" || d === "VARIABLE") return "";
    return "cross-shore";
  })();

  if (speedWord === "glassy") return "glassy";
  return dirWord ? `${speedWord} ${dirWord}` : speedWord;
}

function deriveTideDesc(tideStatus: string | null, tideHeight: string | null): string {
  const status = (tideStatus || "").toLowerCase();
  const height = tideHeight ? `${parseNumeric(tideHeight)?.toFixed(1)}ft` : "";
  if (status.includes("rising") || status.includes("incoming"))
    return height ? `incoming ${height} tide` : "incoming tide";
  if (status.includes("falling") || status.includes("dropping"))
    return height ? `dropping ${height} tide` : "dropping tide";
  if (status.includes("high")) return height ? `high tide ${height}` : "high tide";
  if (status.includes("low")) return height ? `low tide ${height}` : "low tide";
  if (status.includes("mid")) return "mid-tide";
  return height ? `${height} tide` : "mid-tide";
}

function deriveVibeWord(score: number, windDesc: string): string {
  if (score >= 9) return "pristine";
  if (score >= 7) return windDesc.includes("glassy") ? "glassy" : "clean";
  if (score >= 5) return "workable";
  if (score >= 3) return "bumpy";
  return "rough";
}

function deriveOneLiner(score: number, windDesc: string): string {
  if (score >= 9) return "clean and mellow";
  if (score >= 7) return windDesc.includes("glassy") ? "glassy and fun" : "clean conditions";
  if (score >= 5) return "decent if you time it right";
  return "not ideal for beginners";
}

function deriveCaveat(forecasts: ForecastRow[]): string {
  const avgWind = avgValue(forecasts, "wind_speed");
  if (avgWind >= 12) return "wind picks up by noon";
  if (avgWind >= 8) return "the wind is borderline";
  const avgWave = avgValue(forecasts, "wave_height");
  if (avgWave >= 4) return "it's on the bigger side";
  return "conditions are inconsistent";
}

function deriveConditionWord(forecasts: ForecastRow[]): string {
  const avgWind = avgValue(forecasts, "wind_speed");
  if (avgWind >= 12) return "choppy surf";
  const avgWave = avgValue(forecasts, "wave_height");
  if (avgWave >= 5) return "overhead waves";
  return "mixed conditions";
}

function deriveNoReason(forecasts: ForecastRow[]): string {
  const avgWind = avgValue(forecasts, "wind_speed");
  const avgWave = avgValue(forecasts, "wave_height");
  if (avgWind >= 15) return "Strong onshore wind";
  if (avgWave >= 6) return "Heavy swell";
  if (avgWave < 1) return "Flat conditions";
  if (avgWind >= 10) return "Onshore wind and choppy conditions";
  return "Mixed messy conditions";
}

/** Build a height range string like "2-3" from forecast data */
function deriveHeightRange(forecasts: ForecastRow[]): string {
  const heights = forecasts
    .map((f) => parseNumeric(f.wave_height))
    .filter((v): v is number => v !== null);
  if (heights.length === 0) return "1-2";
  const min = Math.floor(Math.min(...heights));
  const max = Math.ceil(Math.max(...heights));
  if (min === max) return `${min}`;
  return `${min}-${max}`;
}

/** Estimate best window from forecasts — morning is usually best for SD */
function deriveBestWindow(forecasts: ForecastRow[]): string {
  if (forecasts.length === 0) return "early morning";
  // Score each forecast hour and find the best stretch
  let bestStart = 6;
  let bestEnd = 10;
  let bestScore = -Infinity;

  for (let i = 0; i < forecasts.length; i++) {
    const f = forecasts[i];
    // Derive PT hour, accounting for PDT (UTC-7) vs PST (UTC-8)
    const forecastDate = new Date(f.forecast_at);
    const ptOffset = isPacificDaylightTime(forecastDate) ? 7 : 8;
    const hour = forecastDate.getUTCHours() - ptOffset;
    const adjustedHour = hour < 0 ? hour + 24 : hour;
    const waveHt = parseNumeric(f.wave_height) ?? 0;
    const windSpd = parseNumeric(f.wind_speed) ?? 0;
    const s = scoreWaveHeight(waveHt) + scoreWindSpeed(windSpd);
    if (s > bestScore) {
      bestScore = s;
      bestStart = adjustedHour;
      bestEnd = Math.min(adjustedHour + 3, 18);
    }
  }

  return `${formatHour(bestStart)}-${formatHour(bestEnd)}`;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function deriveEndTime(forecasts: ForecastRow[]): string {
  const window = deriveBestWindow(forecasts);
  const parts = window.split("-");
  return parts.length === 2 ? parts[1].trim() : "10 AM";
}

function deriveVibeLineForLongboard(score: number): string {
  if (score >= 8) return "Perfect morning to cruise on a log";
  if (score >= 6) return "Mellow vibes for a Sunday glide";
  return "Grab the longboard and make the most of it";
}

function buildBeachPath(beach: BeachRow): string {
  const state = (beach.state || "ca").toLowerCase();
  const city = (beach.city || "san-diego").toLowerCase().replace(/\s+/g, "-");
  const slug = beach.slug || beach.name.toLowerCase().replace(/\s+/g, "-");
  return `${state}/${city}/${slug}`;
}

// ---------------------------------------------------------------------------
// Scoring and enrichment
// ---------------------------------------------------------------------------

function buildScoredBeach(beach: BeachRow, forecasts: ForecastRow[]): ScoredBeach {
  const score = computeBeginnerScore(forecasts);
  const avgWind = avgValue(forecasts, "wind_speed");
  const avgWaveHt = avgValue(forecasts, "wave_height");
  const avgPeriod = avgValue(forecasts, "swell_1_period") || avgValue(forecasts, "wave_period");

  // Dominant wind direction: use the most common from the forecasts
  const dominantWind = forecasts
    .map((f) => f.wind_direction)
    .filter(Boolean)[0] ?? null;
  const dominantTideStatus = forecasts
    .map((f) => f.tide_status)
    .filter(Boolean)[0] ?? null;
  const dominantTideHeight = forecasts
    .map((f) => f.tide_height)
    .filter(Boolean)[0] ?? null;

  const windDesc = deriveWindDesc(avgWind, dominantWind);
  const tideDesc = deriveTideDesc(dominantTideStatus, dominantTideHeight);

  return {
    beach,
    score,
    verdict: verdictFromScore(score),
    forecasts,
    avgHeight: avgWaveHt,
    avgWindSpeed: avgWind,
    avgSwellPeriod: avgPeriod,
    windDesc,
    tideDesc,
    vibeWord: deriveVibeWord(score, windDesc),
    oneLinerReason: deriveOneLiner(score, windDesc),
    caveat: deriveCaveat(forecasts),
    heightRange: deriveHeightRange(forecasts),
    bestWindow: deriveBestWindow(forecasts),
    endTime: deriveEndTime(forecasts),
    beachPath: buildBeachPath(beach),
  };
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

interface TemplateSlots {
  [key: string]: string;
}

function resolveTemplate(template: string, slots: TemplateSlots): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return slots[key] ?? match;
  });
}

function buildGoNoSlots(scoredBeaches: ScoredBeach[], tomorrowOutlook: string): TemplateSlots {
  const b1 = scoredBeaches[0];
  const b2 = scoredBeaches.length > 1 ? scoredBeaches[1] : scoredBeaches[0];

  return {
    beach_1: b1.beach.name,
    beach_2: b2.beach.name,
    height_1: b1.heightRange,
    height_2: b2.heightRange,
    wind_desc_1: b1.windDesc,
    wind_desc_2: b2.windDesc,
    reason_1: b1.oneLinerReason,
    reason_2: b2.oneLinerReason,
    vibe_1: b1.vibeWord,
    vibe_2: b2.vibeWord,
    time_window: b1.bestWindow,
    end_time: b1.endTime,
    caveat_1: b1.caveat,
    condition_1: deriveConditionWord(b1.forecasts),
    reason: deriveNoReason(b1.forecasts),
    tomorrow_outlook: tomorrowOutlook,
  };
}

interface DaySummary {
  verdict: string;
  summary: string;
  scoredBeaches: ScoredBeach[];
}

interface TomorrowOutlook {
  text: string;
  authorizationContexts: HoldAuthorizationContext[];
}

function buildWeekendSlots(saturday: DaySummary, sunday: DaySummary): TemplateSlots {
  const bestDay = saturday.scoredBeaches[0]?.score >= (sunday.scoredBeaches[0]?.score ?? 0) ? "Saturday" : "Sunday";
  const otherDay = bestDay === "Saturday" ? "Sunday" : "Saturday";
  const bestDayData = bestDay === "Saturday" ? saturday : sunday;
  const otherDayData = bestDay === "Saturday" ? sunday : saturday;
  const bestBeach = bestDayData.scoredBeaches[0];

  return {
    sat_verdict: saturday.verdict,
    sat_summary: saturday.summary,
    sun_verdict: sunday.verdict,
    sun_summary: sunday.summary,
    best_day: bestDay,
    other_day: otherDay,
    best_time: "morning",
    best_window: `${bestDay} morning`,
    best_beach: bestBeach?.beach.name ?? "TBD",
    height_1: bestBeach?.heightRange ?? "1-2",
    wind_desc_1: bestBeach?.windDesc ?? "light",
    vibe_1: bestBeach?.vibeWord ?? "clean",
    other_summary: otherDayData.summary,
  };
}

function buildLongboardSlots(topBeach: ScoredBeach): TemplateSlots {
  return {
    beach_1: topBeach.beach.name,
    height_1: topBeach.heightRange,
    wind_desc_1: topBeach.windDesc,
    tide_desc_1: topBeach.tideDesc,
    vibe_line: deriveVibeLineForLongboard(topBeach.score),
    beach_path_1: topBeach.beachPath,
  };
}

// ---------------------------------------------------------------------------
// Template selection with rotation
// ---------------------------------------------------------------------------

async function pickTemplate(
  templates: string[],
  postType: PostType,
  supabase: SupabaseClient,
): Promise<{ template: string; index: number }> {
  // Get last N template indices used for this post type
  const { data: recentLogs } = await supabase
    .from("posting_log")
    .select("template_index")
    .eq("post_type", postType)
    .eq("success", true)
    .order("posted_at", { ascending: false })
    .limit(TEMPLATE_ROTATION_LOOKBACK);

  const recentIndices = new Set(
    (recentLogs || []).map((l: { template_index: number | null }) => l.template_index).filter((i: number | null) => i !== null),
  );

  // Find a template not recently used
  const available = templates
    .map((t, i) => ({ template: t, index: i }))
    .filter((t) => !recentIndices.has(t.index));

  if (available.length > 0) {
    const pick = available[Math.floor(Math.random() * available.length)];
    return pick;
  }

  // All recently used — just pick random
  const idx = Math.floor(Math.random() * templates.length);
  return { template: templates[idx], index: idx };
}

// ---------------------------------------------------------------------------
// Bluesky API client
// ---------------------------------------------------------------------------

async function createBlueskySession(): Promise<BlueskySession> {
  const handle = Deno.env.get("BLUESKY_HANDLE");
  const password = Deno.env.get("BLUESKY_APP_PASSWORD");

  if (!handle || !password) {
    throw new Error("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD env vars");
  }

  const res = await fetch(`${BLUESKY_API}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return { accessJwt: data.accessJwt, did: data.did };
}

async function uploadImageBlob(
  session: BlueskySession,
  imageBytes: ArrayBuffer,
): Promise<any> {
  const res = await fetch(`${BLUESKY_API}/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "image/png",
    },
    body: imageBytes,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky image upload failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.blob;
}

/**
 * Build AT Protocol facets for URLs in the post text.
 * CRITICAL: Bluesky requires byte-level UTF-8 indices, not character indices.
 */
function buildLinkFacets(text: string): any[] {
  const facets: any[] = [];
  // Match URLs starting with http(s) or quiversurf.app
  const urlRegex = /(https?:\/\/[^\s]+|quiversurf\.app[^\s]*)/g;
  let match: RegExpExecArray | null;

  const encoder = new TextEncoder();

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const charStart = match.index;

    // Calculate byte offset for the start position
    const prefixBytes = encoder.encode(text.slice(0, charStart));
    const urlBytes = encoder.encode(url);
    const byteStart = prefixBytes.length;
    const byteEnd = byteStart + urlBytes.length;

    // Ensure the URL has a scheme for the facet URI
    const uri = url.startsWith("http") ? url : `https://${url}`;

    facets.push({
      index: { byteStart, byteEnd },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri,
        },
      ],
    });
  }

  return facets;
}

async function createBlueskyPost(
  session: BlueskySession,
  text: string,
  imageBlob: any | null,
  altText: string,
): Promise<string> {
  const record: any = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    facets: buildLinkFacets(text),
  };

  if (imageBlob) {
    record.embed = {
      $type: "app.bsky.embed.images",
      images: [{ alt: altText, image: imageBlob }],
    };
  }

  const res = await fetch(`${BLUESKY_API}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky post creation failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.uri;
}

// ---------------------------------------------------------------------------
// Image fetching
// ---------------------------------------------------------------------------

async function fetchOgImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/png" },
    });
    if (!res.ok) {
      console.warn(`OG image fetch failed (${res.status}): ${url}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`OG image fetch error: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forecast queries
// ---------------------------------------------------------------------------

async function getSanDiegoBeaches(supabase: SupabaseClient): Promise<BeachRow[]> {
  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, slug, city, state")
    .ilike("city", `%${SAN_DIEGO_CITY}%`)
    .or("is_private.is.null,is_private.eq.false");

  if (error) throw new Error(`Failed to fetch SD beaches: ${error.message}`);

  const beaches = (data || []) as BeachRow[];
  const { data: heldRows, error: heldError } = await supabase
    .from("water_quality_held_beaches")
    .select("beach_id")
    .in("beach_id", beaches.map(({ id }) => id));

  if (heldError) {
    throw new Error(
      `Failed to fetch water-quality holds: ${heldError.message}`,
    );
  }

  const safeBeaches = filterBeachesByWaterQualityHolds(beaches, heldRows);
  if (safeBeaches === null) {
    throw new Error("Invalid water-quality hold response");
  }
  return safeBeaches;
}

async function getForecastsForWindow(
  supabase: SupabaseClient,
  beachIds: string[],
  startISO: string,
  endISO: string,
): Promise<ForecastRow[]> {
  if (beachIds.length === 0) return [];

  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select(
      "beach_id, forecast_at, wave_height, wave_period, wind_speed, wind_direction, wind_direction_deg, tide_height, tide_status, swell_1_period",
    )
    .in("beach_id", beachIds)
    .gte("forecast_at", startISO)
    .lt("forecast_at", endISO)
    .order("forecast_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch forecasts: ${error.message}`);
  return (data || []) as ForecastRow[];
}

function groupForecastsByBeach(forecasts: ForecastRow[]): Map<string, ForecastRow[]> {
  const map = new Map<string, ForecastRow[]>();
  for (const f of forecasts) {
    const existing = map.get(f.beach_id);
    if (existing) {
      existing.push(f);
    } else {
      map.set(f.beach_id, [f]);
    }
  }
  return map;
}

function exactForecastSlot(
  forecasts: ForecastRow[],
): { start: string; end: string } | null {
  const instants = Array.from(
    new Set(
      forecasts
        .map(({ forecast_at }) => Date.parse(forecast_at))
        .filter(Number.isFinite),
    ),
  ).sort((left, right) => left - right);
  if (instants.length < 2 || instants[1] <= instants[0]) return null;
  return {
    start: new Date(instants[0]).toISOString(),
    end: new Date(instants[1]).toISOString(),
  };
}

function authorizationContextsForScoredBeaches(
  scoredBeaches: readonly ScoredBeach[],
  window: { start: string; end: string },
): HoldAuthorizationContext[] {
  return scoredBeaches.map(({ beach }) => ({
    beachId: beach.id,
    startsAt: window.start,
    endsAt: window.end,
  }));
}

function uniqueAuthorizationContexts(
  contexts: readonly HoldAuthorizationContext[],
): HoldAuthorizationContext[] {
  return [
    ...new Map(
      contexts.map((context) => [authorizationContextKey(context), context]),
    ).values(),
  ];
}

async function resolveMajorEventHoldAuthorizationContexts(
  supabase: SupabaseClient,
  contexts: readonly HoldAuthorizationContext[],
  configuredMode = Deno.env.get("MAJOR_EVENT_HOLD_MODE") ?? "off",
): Promise<HoldAuthorizationResolution> {
  if (configuredMode === "off") {
    return { state: "resolved", blockedContextKeys: new Set() };
  }
  if (configuredMode !== "shadow" && configuredMode !== "enforce") {
    return { state: "unavailable", blockedContextKeys: new Set() };
  }

  const uniqueContexts = uniqueAuthorizationContexts(contexts);
  if (uniqueContexts.length === 0) {
    return { state: "resolved", blockedContextKeys: new Set() };
  }

  const contextsByWindow = new Map<string, HoldAuthorizationContext[]>();
  for (const context of uniqueContexts) {
    const key = `${context.startsAt}|${context.endsAt}`;
    const existing = contextsByWindow.get(key);
    if (existing) {
      existing.push(context);
    } else {
      contextsByWindow.set(key, [context]);
    }
  }

  const asOf = new Date().toISOString();
  const blockedContextKeys = new Set<string>();
  try {
    for (const windowContexts of contextsByWindow.values()) {
      const first = windowContexts[0];
      const { data, error } = await supabase.rpc(
        "resolve_active_regional_recommendation_holds",
        {
          p_as_of: asOf,
          p_beach_ids: windowContexts.map(({ beachId }) => beachId),
          p_window_start: first.startsAt,
          p_window_end: first.endsAt,
        },
      );
      if (configuredMode === "shadow") continue;
      if (error) {
        return { state: "unavailable", blockedContextKeys: new Set() };
      }

      const resolution = evaluateHoldAuthorizationRows({
        contexts: windowContexts,
        rows: data,
        asOf,
      });
      if (resolution.state === "unavailable") return resolution;
      for (const key of resolution.blockedContextKeys) {
        blockedContextKeys.add(key);
      }
    }
  } catch {
    return configuredMode === "shadow"
      ? { state: "resolved", blockedContextKeys: new Set() }
      : { state: "unavailable", blockedContextKeys: new Set() };
  }

  return { state: "resolved", blockedContextKeys };
}

async function filterScoredBeachesForMajorEventHold(
  supabase: SupabaseClient,
  scoredBeaches: ScoredBeach[],
  window: { start: string; end: string },
): Promise<HoldFilterResult> {
  const configuredMode = Deno.env.get("MAJOR_EVENT_HOLD_MODE") ?? "off";
  const contexts = authorizationContextsForScoredBeaches(
    scoredBeaches,
    window,
  );
  const resolution = await resolveMajorEventHoldAuthorizationContexts(
    supabase,
    contexts,
    configuredMode,
  );
  if (resolution.state === "unavailable") {
    return { state: "unavailable", scoredBeaches: [] };
  }
  return {
    state: "resolved",
    scoredBeaches: scoredBeaches.filter((_scoredBeach, index) =>
      !resolution.blockedContextKeys.has(
        authorizationContextKey(contexts[index]),
      )
    ),
  };
}

// ---------------------------------------------------------------------------
// Pacific Time helpers
// ---------------------------------------------------------------------------

/** Approximate PDT check: second Sunday of March to first Sunday of November */
function isPacificDaylightTime(date: Date): boolean {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed

  // Jan, Feb, Dec are always PST
  if (month < 2 || month > 10) return false;
  // Apr through Oct are always PDT
  if (month > 2 && month < 10) return true;

  // March: PDT starts second Sunday at 2 AM PT
  if (month === 2) {
    const firstDay = new Date(Date.UTC(year, 2, 1)).getUTCDay();
    const secondSunday = firstDay === 0 ? 8 : 15 - firstDay;
    return date.getUTCDate() > secondSunday ||
      (date.getUTCDate() === secondSunday && date.getUTCHours() >= 10); // 2 AM PT = 10 UTC
  }

  // November: PST starts first Sunday at 2 AM PT
  if (month === 10) {
    const firstDay = new Date(Date.UTC(year, 10, 1)).getUTCDay();
    const firstSunday = firstDay === 0 ? 1 : 8 - firstDay;
    return date.getUTCDate() < firstSunday ||
      (date.getUTCDate() === firstSunday && date.getUTCHours() < 9); // 2 AM PDT = 9 UTC
  }

  return false;
}

// ---------------------------------------------------------------------------
// Time window builders
// ---------------------------------------------------------------------------

/** Today's full forecast range */
function todayFullWindow(): { start: string; end: string } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];
  return {
    start: `${todayStr}T00:00:00Z`,
    end: `${tomorrowStr}T00:00:00Z`,
  };
}

function tomorrowFullWindow(): { start: string; end: string } {
  const now = new Date();
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  return {
    start: `${tomorrowDate.toISOString().split("T")[0]}T00:00:00Z`,
    end: `${dayAfterDate.toISOString().split("T")[0]}T00:00:00Z`,
  };
}

/** Weekend windows for Thu evening posts: upcoming Sat + Sun */
function weekendWindows(): { saturday: { start: string; end: string }; sunday: { start: string; end: string } } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 4=Thu, 5=Fri, 6=Sat

  // Find next Saturday
  let daysUntilSat = (6 - dayOfWeek + 7) % 7;
  if (daysUntilSat === 0 && dayOfWeek !== 6) daysUntilSat = 7;
  // If it's Thursday (dayOfWeek=4), Saturday is in 2 days
  if (dayOfWeek === 4) daysUntilSat = 2;

  const satDate = new Date(now.getTime() + daysUntilSat * 24 * 60 * 60 * 1000);
  const sunDate = new Date(satDate.getTime() + 24 * 60 * 60 * 1000);
  const monDate = new Date(sunDate.getTime() + 24 * 60 * 60 * 1000);

  return {
    saturday: {
      start: `${satDate.toISOString().split("T")[0]}T00:00:00Z`,
      end: `${sunDate.toISOString().split("T")[0]}T00:00:00Z`,
    },
    sunday: {
      start: `${sunDate.toISOString().split("T")[0]}T00:00:00Z`,
      end: `${monDate.toISOString().split("T")[0]}T00:00:00Z`,
    },
  };
}

// ---------------------------------------------------------------------------
// Day summary for weekend posts
// ---------------------------------------------------------------------------

function buildDaySummary(scoredBeaches: ScoredBeach[]): DaySummary {
  if (scoredBeaches.length === 0) {
    return { verdict: "Skip", summary: "no data available", scoredBeaches: [] };
  }

  const best = scoredBeaches[0];
  const verdict = best.verdict === "go" ? "Go" : best.verdict === "maybe" ? "Maybe" : "Skip";
  const summary = `${best.heightRange}ft, ${best.windDesc}, ${best.vibeWord}`;

  return { verdict, summary, scoredBeaches };
}

// ---------------------------------------------------------------------------
// Tomorrow outlook for no-go posts
// ---------------------------------------------------------------------------

async function getTomorrowOutlook(
  supabase: SupabaseClient,
  beachIds: string[],
  beaches: BeachRow[],
): Promise<TomorrowOutlook> {
  const window = tomorrowFullWindow();
  const forecasts = await getForecastsForWindow(supabase, beachIds, window.start, window.end);
  const grouped = groupForecastsByBeach(forecasts);

  const beachMap = new Map(beaches.map((b) => [b.id, b]));
  const scored: ScoredBeach[] = [];
  for (const [beachId, beachForecasts] of grouped) {
    const beach = beachMap.get(beachId);
    if (beach) {
      scored.push(buildScoredBeach(beach, beachForecasts));
    }
  }
  const policy = await filterScoredBeachesForMajorEventHold(
    supabase,
    scored,
    window,
  );
  if (policy.state === "unavailable" || policy.scoredBeaches.length === 0) {
    return { text: "unclear", authorizationContexts: [] };
  }
  const allowedScored = policy.scoredBeaches.sort((a, b) => b.score - a.score);

  const bestScore = allowedScored[0].score;
  const text = bestScore >= 8
    ? "much better"
    : bestScore >= 6
    ? "better"
    : bestScore >= 4
    ? "a bit better"
    : "about the same";
  return {
    text,
    authorizationContexts: authorizationContextsForScoredBeaches(
      [allowedScored[0]],
      window,
    ),
  };
}

// ---------------------------------------------------------------------------
// Post generators
// ---------------------------------------------------------------------------

async function generateGoNoPost(
  supabase: SupabaseClient,
  beaches: BeachRow[],
): Promise<GeneratedForecastPost> {
  const window = todayFullWindow();
  const beachIds = beaches.map((b) => b.id);
  const forecasts = await getForecastsForWindow(supabase, beachIds, window.start, window.end);
  const grouped = groupForecastsByBeach(forecasts);

  const beachMap = new Map(beaches.map((b) => [b.id, b]));
  let scoredBeaches: ScoredBeach[] = [];

  for (const [beachId, beachForecasts] of grouped) {
    const beach = beachMap.get(beachId);
    if (beach) {
      scoredBeaches.push(buildScoredBeach(beach, beachForecasts));
    }
  }

  const policy = await filterScoredBeachesForMajorEventHold(
    supabase,
    scoredBeaches,
    window,
  );
  if (policy.state === "unavailable" || policy.scoredBeaches.length === 0) {
    return objectiveSafetyPost();
  }
  scoredBeaches = policy.scoredBeaches;

  // Sort the policy-filtered complete pool before applying the display limit.
  scoredBeaches.sort((a, b) => b.score - a.score);

  // Determine overall verdict based on top beaches
  const topBeaches = scoredBeaches.slice(0, 3);
  const bestScore = topBeaches[0]?.score ?? 0;
  const overallVerdict = verdictFromScore(bestScore);

  let templates: string[];
  if (overallVerdict === "go") {
    templates = GO_TEMPLATES;
  } else if (overallVerdict === "maybe") {
    templates = MAYBE_TEMPLATES;
  } else {
    templates = NO_TEMPLATES;
  }

  const { template, index } = await pickTemplate(templates, "go_no", supabase);

  const tomorrowOutlook =
    overallVerdict === "no"
      ? await getTomorrowOutlook(supabase, beachIds, beaches)
      : { text: "promising", authorizationContexts: [] };

  const slots = buildGoNoSlots(
    scoredBeaches.length > 0 ? scoredBeaches : [buildScoredBeach(beaches[0], [])],
    tomorrowOutlook.text,
  );

  const text = resolveTemplate(template, slots);
  const featured = topBeaches.map((b) => b.beach.name);
  const authorizationContexts = uniqueAuthorizationContexts([
    ...authorizationContextsForScoredBeaches(topBeaches, window),
    ...tomorrowOutlook.authorizationContexts,
  ]);

  // go_no posts are text-only per spec
  return {
    text,
    templateIndex: index,
    beachesFeatured: featured,
    imageUrl: null,
    authorizationContexts,
  };
}

async function generateWeekendWavePost(
  supabase: SupabaseClient,
  beaches: BeachRow[],
): Promise<GeneratedForecastPost> {
  const { saturday, sunday } = weekendWindows();
  const beachIds = beaches.map((b) => b.id);

  const [satForecasts, sunForecasts] = await Promise.all([
    getForecastsForWindow(supabase, beachIds, saturday.start, saturday.end),
    getForecastsForWindow(supabase, beachIds, sunday.start, sunday.end),
  ]);

  const beachMap = new Map(beaches.map((b) => [b.id, b]));

  const scoreSingle = (forecasts: ForecastRow[]) => {
    const grouped = groupForecastsByBeach(forecasts);
    const scored: ScoredBeach[] = [];
    for (const [beachId, bf] of grouped) {
      const beach = beachMap.get(beachId);
      if (beach) scored.push(buildScoredBeach(beach, bf));
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  };

  const [satPolicy, sunPolicy] = await Promise.all([
    filterScoredBeachesForMajorEventHold(
      supabase,
      scoreSingle(satForecasts),
      saturday,
    ),
    filterScoredBeachesForMajorEventHold(
      supabase,
      scoreSingle(sunForecasts),
      sunday,
    ),
  ]);
  if (
    satPolicy.state === "unavailable" ||
    sunPolicy.state === "unavailable" ||
    satPolicy.scoredBeaches.length === 0 ||
    sunPolicy.scoredBeaches.length === 0
  ) {
    return objectiveSafetyPost();
  }
  const satScored = satPolicy.scoredBeaches.sort((a, b) => b.score - a.score);
  const sunScored = sunPolicy.scoredBeaches.sort((a, b) => b.score - a.score);

  const satSummary = buildDaySummary(satScored);
  const sunSummary = buildDaySummary(sunScored);

  const { template, index } = await pickTemplate(WEEKEND_WAVE_TEMPLATES, "weekend_wave", supabase);
  const slots = buildWeekendSlots(satSummary, sunSummary);
  const text = resolveTemplate(template, slots);

  const featured = [
    ...satScored.slice(0, 2).map((b) => b.beach.name),
    ...sunScored.slice(0, 2).map((b) => b.beach.name),
  ];
  const uniqueFeatured = [...new Set(featured)];

  const satBest = satScored[0];
  const sunBest = sunScored[0];
  const satSlot = exactForecastSlot(satBest.forecasts);
  const sunSlot = exactForecastSlot(sunBest.forecasts);
  const imageUrl = satSlot && sunSlot
    ? `${APP_BASE_URL}/api/og/weekend-wave-check?sat_beach_id=${encodeURIComponent(satBest.beach.id)}&sat_starts_at=${encodeURIComponent(satSlot.start)}&sat_ends_at=${encodeURIComponent(satSlot.end)}&sun_beach_id=${encodeURIComponent(sunBest.beach.id)}&sun_starts_at=${encodeURIComponent(sunSlot.start)}&sun_ends_at=${encodeURIComponent(sunSlot.end)}`
    : null;

  const authorizationContexts = uniqueAuthorizationContexts([
    ...authorizationContextsForScoredBeaches(satScored.slice(0, 2), saturday),
    ...authorizationContextsForScoredBeaches(sunScored.slice(0, 2), sunday),
  ]);

  return {
    text,
    templateIndex: index,
    beachesFeatured: uniqueFeatured,
    imageUrl,
    authorizationContexts,
  };
}

async function generateLongboardSundayPost(
  supabase: SupabaseClient,
  beaches: BeachRow[],
): Promise<GeneratedForecastPost> {
  const window = todayFullWindow();
  const beachIds = beaches.map((b) => b.id);
  const forecasts = await getForecastsForWindow(supabase, beachIds, window.start, window.end);
  const grouped = groupForecastsByBeach(forecasts);

  const beachMap = new Map(beaches.map((b) => [b.id, b]));
  let scoredBeaches: ScoredBeach[] = [];

  for (const [beachId, beachForecasts] of grouped) {
    const beach = beachMap.get(beachId);
    if (beach) {
      scoredBeaches.push(buildScoredBeach(beach, beachForecasts));
    }
  }

  const policy = await filterScoredBeachesForMajorEventHold(
    supabase,
    scoredBeaches,
    window,
  );
  if (policy.state === "unavailable" || policy.scoredBeaches.length === 0) {
    return objectiveSafetyPost();
  }
  scoredBeaches = policy.scoredBeaches;

  // For longboard Sunday, prefer small/clean waves — favor lower wave heights
  scoredBeaches.sort((a, b) => {
    // Ideal longboard conditions: 1-3ft, low wind
    const aLongboardBonus = a.avgHeight >= 1 && a.avgHeight <= 3 ? 3 : 0;
    const bLongboardBonus = b.avgHeight >= 1 && b.avgHeight <= 3 ? 3 : 0;
    return (b.score + bLongboardBonus) - (a.score + aLongboardBonus);
  });

  const topBeach = scoredBeaches[0];
  if (!topBeach) {
    return objectiveSafetyPost();
  }

  const { template, index } = await pickTemplate(LONGBOARD_SUNDAY_TEMPLATES, "longboard_sunday", supabase);
  const slots = buildLongboardSlots(topBeach);
  const text = resolveTemplate(template, slots);

  // Use existing beach OG image — the beach OG route expects a `slug` param, not `id`
  const imageUrl = topBeach.beach.slug
    ? `${APP_BASE_URL}/api/og/beach?slug=${encodeURIComponent(topBeach.beach.slug)}`
    : null;

  return {
    text,
    templateIndex: index,
    beachesFeatured: [topBeach.beach.name],
    imageUrl,
    authorizationContexts: authorizationContextsForScoredBeaches(
      [topBeach],
      window,
    ),
  };
}

async function applyLastMileMajorEventHoldPolicy(
  supabase: SupabaseClient,
  result: GeneratedForecastPost,
): Promise<GeneratedForecastPost> {
  const configuredMode = Deno.env.get("MAJOR_EVENT_HOLD_MODE") ?? "off";
  const resolution = result.authorizationContexts.length === 0
    ? { state: "unavailable" as const, blockedContextKeys: new Set<string>() }
    : await resolveMajorEventHoldAuthorizationContexts(
      supabase,
      result.authorizationContexts,
      configuredMode,
    );
  return shouldUseObjectiveSafetyPost(configuredMode, resolution)
    ? objectiveSafetyPost()
    : result;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

async function writePostingLog(
  supabase: SupabaseClient,
  entry: PostingLogEntry,
): Promise<void> {
  const { error } = await supabase.from("posting_log").insert(entry);
  if (error) {
    console.error("Failed to write posting_log:", error.message);
  }
}

async function updateLastPostedAt(
  supabase: SupabaseClient,
  postType: PostType,
): Promise<void> {
  const { error } = await supabase
    .from("posting_config")
    .update({ last_posted_at: new Date().toISOString() })
    .eq("post_type", postType);
  if (error) {
    console.error("Failed to update last_posted_at:", error.message);
  }
}

/** Like writePostingLog but returns the inserted row's ID for linking. */
async function writePostingLogReturningId(
  supabase: SupabaseClient,
  entry: PostingLogEntry,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("posting_log")
    .insert(entry)
    .select("id")
    .single();
  if (error) {
    console.error("Failed to write posting_log:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Check if a post_type has already been posted today in Pacific Time. */
function hasPostedTodayPacific(config: PostingConfig): boolean {
  if (!config.last_posted_at) return false;

  const lastPosted = new Date(config.last_posted_at);
  const now = new Date();

  // Convert both to Pacific date strings for comparison
  const ptOffset = isPacificDaylightTime(now) ? 7 : 8;
  const nowPtMs = now.getTime() - ptOffset * 60 * 60 * 1000;
  const lastPtMs = lastPosted.getTime() - ptOffset * 60 * 60 * 1000;

  const nowPtDate = new Date(nowPtMs).toISOString().split("T")[0];
  const lastPtDate = new Date(lastPtMs).toISOString().split("T")[0];

  return nowPtDate === lastPtDate;
}

// ---------------------------------------------------------------------------
// Config check
// ---------------------------------------------------------------------------

async function getPostingConfig(
  supabase: SupabaseClient,
  postType: PostType,
): Promise<PostingConfig | null> {
  const { data, error } = await supabase
    .from("posting_config")
    .select("*")
    .eq("post_type", postType)
    .single();

  if (error || !data) {
    console.error("Failed to read posting_config:", error?.message);
    return null;
  }

  return data as PostingConfig;
}

function shouldPostBasedOnCadence(config: PostingConfig, postType: PostType): boolean {
  // In "daily" phase, always post on schedule
  if (config.cadence_phase === "daily") return true;

  // In "settled" phase, reduce frequency
  if (config.cadence_phase === "settled") {
    if (!config.last_posted_at) return true;

    const lastPosted = new Date(config.last_posted_at);
    const hoursSince = (Date.now() - lastPosted.getTime()) / (1000 * 60 * 60);

    // go_no: every other day in settled
    if (postType === "go_no") return hoursSince >= 44;
    // weekend_wave and longboard_sunday: weekly is fine (they already are)
    return true;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Dev notes handler
// ---------------------------------------------------------------------------

async function handleDevNotesPost(
  supabase: SupabaseClient,
  config: PostingConfig,
): Promise<Response> {
  // Max 1/day cadence check (Pacific Time)
  if (hasPostedTodayPacific(config)) {
    console.log(`[bluesky-auto-post] Skipping dev_notes -- already posted today`);
    return new Response(
      JSON.stringify({ status: "skipped", reason: "already_posted_today" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Find oldest unposted note with polished text ready
  const { data: note, error: noteError } = await supabase
    .from("dev_notes_queue")
    .select("*")
    .eq("posted", false)
    .not("polished_text", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (noteError || !note) {
    console.log(`[bluesky-auto-post] No unposted dev notes found`);
    return new Response(
      JSON.stringify({ status: "skipped", reason: "nothing_to_post" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const devNote = note as DevNoteRow;
  const postText = devNote.polished_text!;

  console.log(`[bluesky-auto-post] Dev note ${devNote.id} ready (${postText.length} chars):\n${postText}`);

  // Dry-run mode: config.enabled = false
  if (!config.enabled) {
    console.log(`[bluesky-auto-post] Dry run -- dev_notes is disabled, logging without posting`);
    await writePostingLog(supabase, {
      post_type: "dev_notes",
      bluesky_uri: null,
      content_text: postText,
      image_url: null,
      template_index: -1,
      beaches_featured: [],
      success: false,
      error_message: "dry_run",
    });
    return new Response(
      JSON.stringify({ status: "dry_run", post_type: "dev_notes", text: postText }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Authenticate with Bluesky
  const session = await createBlueskySession();
  console.log(`[bluesky-auto-post] Bluesky auth successful for DID: ${session.did}`);

  // Post text-only to Bluesky (no image for dev_notes)
  const postUri = await createBlueskyPost(session, postText, null, "");
  console.log(`[bluesky-auto-post] Dev note posted: ${postUri}`);

  // Log success and get the log entry ID
  const logId = await writePostingLogReturningId(supabase, {
    post_type: "dev_notes",
    bluesky_uri: postUri,
    content_text: postText,
    image_url: null,
    template_index: -1,
    beaches_featured: [],
    success: true,
    error_message: null,
  });

  // Update the queue row: mark as posted and link to log entry
  const { error: updateError } = await supabase
    .from("dev_notes_queue")
    .update({
      posted: true,
      posted_at: new Date().toISOString(),
      ...(logId ? { posting_log_id: logId } : {}),
    })
    .eq("id", devNote.id);

  if (updateError) {
    console.error(`[bluesky-auto-post] Failed to update dev_notes_queue: ${updateError.message}`);
  }

  // Update last_posted_at
  await updateLastPostedAt(supabase, "dev_notes");

  return new Response(
    JSON.stringify({
      status: "posted",
      post_type: "dev_notes",
      bluesky_uri: postUri,
      text: postText,
      dev_note_id: devNote.id,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Track post_type outside try for error logging
  let parsedPostType: PostType | null = null;

  try {
    // Parse request
    const body: PostRequest = await req.json();
    const { post_type } = body;

    if (!post_type || !["go_no", "weekend_wave", "longboard_sunday", "dev_notes"].includes(post_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid post_type. Must be go_no, weekend_wave, longboard_sunday, or dev_notes." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    parsedPostType = post_type;
    console.log(`[bluesky-auto-post] Starting ${post_type} post`);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check posting config
    const config = await getPostingConfig(supabase, post_type);
    if (!config) {
      return new Response(
        JSON.stringify({ error: `No posting_config found for ${post_type}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!shouldPostBasedOnCadence(config, post_type)) {
      console.log(`[bluesky-auto-post] Skipping ${post_type} due to cadence`);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "cadence" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Dev notes: self-contained path — no beaches/templates needed
    if (post_type === "dev_notes") {
      return await handleDevNotesPost(supabase, config);
    }

    // Public social posts have no verified surfer skill. The canonical
    // unknown-skill decision is explicit none, so no beach/window
    // recommendation may leave this boundary.
    let result: GeneratedForecastPost;
    result = objectiveSafetyPost();

    result = await applyLastMileMajorEventHoldPolicy(supabase, result);
    console.log(`[bluesky-auto-post] Generated text (${result.text.length} chars):\n${result.text}`);

    // Dry-run mode: config.enabled = false
    if (!config.enabled) {
      console.log(`[bluesky-auto-post] Dry run -- ${post_type} is disabled, logging without posting`);
      await writePostingLog(supabase, {
        post_type,
        bluesky_uri: null,
        content_text: result.text,
        image_url: result.imageUrl,
        template_index: result.templateIndex,
        beaches_featured: result.beachesFeatured,
        success: false,
        error_message: "dry_run",
      });

      return new Response(
        JSON.stringify({
          status: "dry_run",
          post_type,
          text: result.text,
          image_url: result.imageUrl,
          beaches_featured: result.beachesFeatured,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Authenticate with Bluesky
    const session = await createBlueskySession();
    console.log(`[bluesky-auto-post] Bluesky auth successful for DID: ${session.did}`);

    result = await applyLastMileMajorEventHoldPolicy(supabase, result);

    // Handle image upload (if applicable)
    let imageBlob: any = null;
    let altText = "";

    if (result.imageUrl) {
      console.log(`[bluesky-auto-post] Fetching OG image: ${result.imageUrl}`);
      const imageBytes = await fetchOgImage(result.imageUrl);

      if (imageBytes) {
        try {
          imageBlob = await uploadImageBlob(session, imageBytes);
          altText =
            post_type === "weekend_wave"
              ? "Weekend Wave Check forecast card for San Diego showing Saturday and Sunday surf conditions"
              : `Surf forecast card for ${result.beachesFeatured[0] || "San Diego"} showing current conditions`;
          console.log(`[bluesky-auto-post] Image uploaded to Bluesky CDN`);
        } catch (uploadErr) {
          console.warn(`[bluesky-auto-post] Image upload failed, posting text-only:`, uploadErr);
          imageBlob = null;
        }
      } else {
        console.warn(`[bluesky-auto-post] Image fetch failed, posting text-only`);
      }
    }

    result = await applyLastMileMajorEventHoldPolicy(supabase, result);
    if (result.imageUrl === null) {
      imageBlob = null;
      altText = "";
    }

    // Create the Bluesky post
    const postUri = await createBlueskyPost(session, result.text, imageBlob, altText);
    console.log(`[bluesky-auto-post] Post created: ${postUri}`);

    // Log success
    await writePostingLog(supabase, {
      post_type,
      bluesky_uri: postUri,
      content_text: result.text,
      image_url: result.imageUrl,
      template_index: result.templateIndex,
      beaches_featured: result.beachesFeatured,
      success: true,
      error_message: null,
    });

    // Update last_posted_at
    await updateLastPostedAt(supabase, post_type);

    return new Response(
      JSON.stringify({
        status: "posted",
        post_type,
        bluesky_uri: postUri,
        text: result.text,
        image_url: result.imageUrl,
        beaches_featured: result.beachesFeatured,
        has_image: imageBlob !== null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[bluesky-auto-post] Error:`, errorMessage);

    // Attempt to log the failure if we know the post type
    if (parsedPostType) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await writePostingLog(supabase, {
            post_type: parsedPostType,
            bluesky_uri: null,
            content_text: `[ERROR] ${errorMessage}`,
            image_url: null,
            template_index: -1,
            beaches_featured: [],
            success: false,
            error_message: errorMessage,
          });
        }
      } catch (logErr) {
        console.error(`[bluesky-auto-post] Failed to log error:`, logErr);
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
