/**
 * Morning Surf Intel Script
 * Generates and posts automated daily morning surf intel for Ocean Beach, San Diego
 * Runs daily at 6:00 AM America/Los_Angeles
 */

import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { format, parseISO, addDays } from "date-fns";
import type { Database } from "@/types/database";
import type { Json } from "@/types/database";
import type {
  MorningIntelConfig,
  MorningIntelData,
  ForecastSlice,
  BeachPreferences,
  MorningIntelRecommendationSummary,
} from "@/types/morning-intel";
import {
  deriveSurfRange,
  recommendTideWindow,
  primarySecondarySwell,
  windAt,
  confidenceHeuristic,
} from "@/lib/utils/morning-intel-utils";
import { withFallbackTracking } from "@/lib/monitoring/fallback-helpers";
import {
  scoreConditions,
  calculateOptimalWindow,
  formatTimeRange,
  type ForecastForScoring,
  type BeachWithThresholds,
} from "@/lib/scoring";
import {
  createIntelDedupeHash,
} from "@/lib/utils/intel-dedupe";

const TIMEZONE = "America/Los_Angeles";
const TARGET_HOUR = 6; // 6:00 AM

/**
 * Get configuration from environment variables
 */
function getConfig(): MorningIntelConfig {
  const config: MorningIntelConfig = {
    spotId:
      process.env.MORNING_INTEL_SPOT_ID ||
      process.env.NEXT_PUBLIC_MORNING_INTEL_SPOT_ID ||
      "",
    spotName:
      process.env.MORNING_INTEL_SPOT_NAME ||
      process.env.NEXT_PUBLIC_MORNING_INTEL_SPOT_NAME ||
      "Ocean Beach, San Diego",
    userEmail:
      process.env.MORNING_INTEL_USER_EMAIL || "morning.intel@quiversurf.app",
    userPassword: "", // No longer needed - using service role key
    timezone: TIMEZONE,
    targetHour: TARGET_HOUR,
    enabled: process.env.MORNING_INTEL_ENABLED !== "false",
  };

  return config;
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey);
}

/**
 * Get bot user ID by email from profiles table
 * Using service role key, we don't need password authentication
 */
async function getBotUserId(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string
): Promise<string> {
  // Trim and lowercase for comparison
  const cleanEmail = email.trim().toLowerCase();
  console.log(`🔐 Looking up bot user: ${cleanEmail}...`);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", cleanEmail)
    .limit(1);

  if (error) {
    throw new Error(
      `Database error looking up bot user: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Bot user not found with email: ${cleanEmail}. ` +
      "Run scripts/create-morning-intel-bot.sql to create the user."
    );
  }

  const user = data[0];
  console.log(`✅ Found bot user: ${user.full_name} (${user.id})`);
  return user.id;
}

/**
 * Query Ocean Beach ID from database
 */
async function getOceanBeachId(
  supabase: ReturnType<typeof getSupabaseClient>,
  configSpotId?: string
): Promise<string> {
  if (configSpotId) {
    console.log(`📍 Using configured spot ID: ${configSpotId}`);
    return configSpotId;
  }

  console.log("📍 Querying Ocean Beach, San Diego from database...");

  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, lat, lon")
    .ilike("name", "%Ocean Beach%")
    .gte("lat", 32.74)
    .lte("lat", 32.76)
    .gte("lon", -117.26)
    .lte("lon", -117.24)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to find Ocean Beach, San Diego in database: ${error?.message || "Not found"}`
    );
  }

  console.log(`✅ Found Ocean Beach: ${data.name} (${data.id})`);
  return data.id;
}

/**
 * Fetch beach preferences and metadata
 */
async function fetchBeachData(
  supabase: ReturnType<typeof getSupabaseClient>,
  beachId: string
): Promise<(BeachPreferences & Partial<BeachWithThresholds>) | null> {
  console.log("🏖️  Fetching beach preferences...");

  // Note: max_wind_onshore_mph and max_wind_any_mph are new columns added by migration
  // 20260114180000_add_beach_wind_thresholds.sql. The types will be regenerated after deployment.
  const { data: beach, error } = await supabase
    .from("beaches")
    .select(
      "id, name, lat, lon, swell_window_min_deg, swell_window_max_deg, wind_offshore_deg, wind_offshore_tol_deg, preferred_tide_ft_min, preferred_tide_ft_max, hazards, skill_level, break_type, aspect_deg"
    )
    .eq("id", beachId)
    .single();

  // Fetch wind thresholds separately to work around types not being regenerated yet
  const { data: windThresholds } = await supabase
    .from("beaches")
    .select("max_wind_onshore_mph, max_wind_any_mph" as any)
    .eq("id", beachId)
    .single() as { data: { max_wind_onshore_mph: number | null; max_wind_any_mph: number | null } | null };

  if (error || !beach) {
    console.warn(`⚠️  Could not fetch beach data: ${error?.message || "Not found"}`);
    return null;
  }

  console.log(`✅ Loaded preferences for ${beach.name}`);

  // If wind_offshore_deg seems inverted vs beach aspect, override for more accurate intel.
  // Wind direction is the direction the wind comes FROM. Offshore winds come from land -> sea,
  // which is approximately aspect_deg + 180.
  const aspectDeg: number | null = beach.aspect_deg ?? null;
  const expectedOffshoreDeg =
    aspectDeg == null ? null : (Number(aspectDeg) + 180) % 360;

  const dbWindOffshoreDeg: number | null = beach.wind_offshore_deg ?? null;

  const shortestAngleDiff = (a: number, b: number) => {
    // Returns 0..180
    return Math.abs((((a - b) % 360) + 540) % 360 - 180);
  };

  let windOffshoreDegUsed: number | null = dbWindOffshoreDeg;
  let windOffshoreDegSource: "db" | "computed_from_aspect" | "db_overridden_with_aspect" =
    "db";

  if (dbWindOffshoreDeg == null && expectedOffshoreDeg != null) {
    windOffshoreDegUsed = expectedOffshoreDeg;
    windOffshoreDegSource = "computed_from_aspect";
  } else if (dbWindOffshoreDeg != null && expectedOffshoreDeg != null) {
    const diff = shortestAngleDiff(dbWindOffshoreDeg, expectedOffshoreDeg);
    if (diff > 90) {
      windOffshoreDegUsed = expectedOffshoreDeg;
      windOffshoreDegSource = "db_overridden_with_aspect";
    }
  }

  return {
    // BeachPreferences fields
    name: beach.name,
    swellWindowMin: beach.swell_window_min_deg,
    swellWindowMax: beach.swell_window_max_deg,
    windOffshoreDeg: windOffshoreDegUsed,
    windOffshoreTol: beach.wind_offshore_tol_deg,
    tideMinFt: beach.preferred_tide_ft_min,
    tideMaxFt: beach.preferred_tide_ft_max,
    hazards: beach.hazards,
    skillLevel: beach.skill_level,
    breakType: beach.break_type,
    // Extra fields (ignored by analyzers today, but useful for persisted/debug payload)
    aspectDeg,
    windOffshoreDegSource,
    // BeachWithThresholds fields for unified scoring
    id: beach.id,
    lat: beach.lat,
    lon: beach.lon,
    wind_offshore_deg: windOffshoreDegUsed,
    wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
    preferred_tide_ft_min: beach.preferred_tide_ft_min,
    preferred_tide_ft_max: beach.preferred_tide_ft_max,
    max_wind_onshore_mph: windThresholds?.max_wind_onshore_mph ?? null,
    max_wind_any_mph: windThresholds?.max_wind_any_mph ?? null,
  };
}

/**
 * Parse numeric value from text with units (e.g., "2.5 ft" -> 2.5)
 */
function parseNumericValue(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  
  // Extract first number from string like "2.5 ft", "10.5s", "5 mph"
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse direction from text or number (e.g., "SSW" -> degrees, or numeric pass-through)
 */
function parseDirection(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  
  // Cardinal direction to degrees mapping
  const cardinalMap: Record<string, number> = {
    "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5,
    "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
    "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5,
    "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5,
  };
  
  const direction = String(value).trim().toUpperCase();
  return cardinalMap[direction] ?? parseNumericValue(value);
}

/**
 * Fetch forecast data for the morning window (04:00 - 12:00)
 */
async function fetchForecastData(
  supabase: ReturnType<typeof getSupabaseClient>,
  beachId: string,
  timezone: string
): Promise<ForecastSlice> {
  console.log("📊 Fetching forecast data...");

  const now = new Date();
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const tomorrow = formatInTimeZone(addDays(now, 1), timezone, "yyyy-MM-dd");

  // Fetch enhanced forecasts (04:00 - 12:00 window)
  const { data: forecasts, error: forecastError } = await supabase
    .from("enhanced_forecasts")
    .select(
      "forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction, tide_height, tide_status, next_tide_time, next_tide_type, next_tide_height, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, confidence_score"
    )
    .eq("beach_id", beachId)
    .in("forecast_date", [today, tomorrow])
    .gte("forecast_time", "04:00:00")
    .lte("forecast_time", "12:00:00")
    .order("forecast_date", { ascending: true })
    .order("forecast_time", { ascending: true });

  if (forecastError) {
    console.warn(
      `⚠️  Enhanced forecast query failed: ${forecastError.message}`
    );
  }

  console.log(
    `📈 Fetched ${forecasts?.length || 0} forecast records`
  );

  // Parse text values to numbers (tide data is embedded in forecasts)
  // Map database column names to ForecastSlice type property names
  const parsedForecasts = (forecasts || []).map((f: any) => ({
    forecast_date: f.forecast_date,
    forecast_time: f.forecast_time,
    wave_height: parseNumericValue(f.wave_height),
    wave_period: parseNumericValue(f.wave_period),
    wave_direction: parseDirection(f.wave_direction),
    // Map swell_1_* to swell_* and swell_2_* to secondary_swell_*
    swell_height: parseNumericValue(f.swell_1_height),
    swell_period: parseNumericValue(f.swell_1_period),
    swell_direction: parseDirection(f.swell_1_direction),
    secondary_swell_height: parseNumericValue(f.swell_2_height),
    secondary_swell_period: parseNumericValue(f.swell_2_period),
    secondary_swell_direction: parseDirection(f.swell_2_direction),
    wind_speed: parseNumericValue(f.wind_speed),
    wind_direction: parseDirection(f.wind_direction),
    tide_height: parseNumericValue(f.tide_height),
    tide_status: f.tide_status,
    confidence_score: f.confidence_score,
  }));

  return {
    forecasts: parsedForecasts,
    tides: [], // Not using separate tide table - tide data is in forecasts
  };
}

/**
 * Convert ForecastSlice forecast to ForecastForScoring
 */
function convertToForecastForScoring(
  f: ForecastSlice["forecasts"][0],
  timezone: string
): ForecastForScoring {
  const forecastTime = new Date(`${f.forecast_date}T${f.forecast_time}Z`);
  return {
    forecastTime,
    waveHeight: withFallbackTracking(f.wave_height ?? f.swell_height, 0, { domain: 'morning-intel', field: 'wave_height' }),
    wavePeriod: f.wave_period ?? f.swell_period ?? 0,
    windSpeed: f.wind_speed ?? 0,
    windDirection: f.wind_direction ?? null,
    tideHeight: f.tide_height ?? 0,
    tideStatus: f.tide_status ?? null,
  };
}

/**
 * Generate morning intel data from forecast
 */
function generateIntelData(
  slice: ForecastSlice,
  spotName: string,
  timezone: string,
  beachPrefs: (BeachPreferences & Partial<BeachWithThresholds>) | null
): MorningIntelData {
  console.log("🔍 Analyzing forecast data...");

  const now = new Date();
  const targetTime = "06:00";
  const date = formatInTimeZone(now, timezone, "yyyy-MM-dd");

  // Calculate metrics
  const surf = deriveSurfRange(slice.forecasts);
  const tide = recommendTideWindow(slice.forecasts, beachPrefs);
  const swells = primarySecondarySwell(slice.forecasts);
  const wind = windAt(targetTime, slice.forecasts, timezone);
  const confidence = confidenceHeuristic(slice.forecasts, slice.tides);

  // Convert forecasts for unified scoring
  const forecastsForScoring = slice.forecasts.map((f) =>
    convertToForecastForScoring(f, timezone)
  );

  // Calculate optimal window using unified scoring
  let bestWindow = "Variable conditions; check throughout the morning";
  let conditions = undefined;
  let recommendation: MorningIntelRecommendationSummary = {
    decision: "maybe",
    label: "Maybe",
    reasons: ["check the detailed forecast"],
  };

  if (beachPrefs && forecastsForScoring.length > 0) {
    // Use unified scoring for the representative forecast (6am)
    const representativeForecast = forecastsForScoring.find((f) => {
      const hour = f.forecastTime.getUTCHours();
      return hour >= 12 && hour <= 15; // 4-7am local (UTC is +8 for Pacific)
    }) || forecastsForScoring[0];

    const beachForScoring: BeachWithThresholds = {
      id: beachPrefs.id ?? "unknown",
      name: beachPrefs.name,
      lat: beachPrefs.lat ?? null,
      lon: beachPrefs.lon ?? null,
      is_private: false,
      created_at: new Date().toISOString(),
      wind_offshore_deg: beachPrefs.wind_offshore_deg ?? beachPrefs.windOffshoreDeg ?? null,
      wind_offshore_tol_deg: beachPrefs.wind_offshore_tol_deg ?? beachPrefs.windOffshoreTol ?? null,
      preferred_tide_ft_min: beachPrefs.preferred_tide_ft_min ?? beachPrefs.tideMinFt ?? null,
      preferred_tide_ft_max: beachPrefs.preferred_tide_ft_max ?? beachPrefs.tideMaxFt ?? null,
      max_wind_onshore_mph: beachPrefs.max_wind_onshore_mph ?? null,
      max_wind_any_mph: beachPrefs.max_wind_any_mph ?? null,
    };

    const conditionScore = scoreConditions(representativeForecast, beachForScoring);
    console.log(`📊 Unified Score: ${conditionScore.total}/100 (${conditionScore.matchQuality})`);

    // Map unified score to legacy 0-10 scale for backward compatibility
    const legacyScore = Math.round(conditionScore.total / 10);

    // Build legacy ConditionsAnalysis for backward compatibility
    conditions = {
      score: legacyScore,
      swell: {
        status: conditionScore.subscores.waveHeightFit >= 15 ? "optimal" : conditionScore.subscores.waveHeightFit >= 8 ? "acceptable" : "poor",
        emoji: conditionScore.subscores.waveHeightFit >= 15 ? "✅" : conditionScore.subscores.waveHeightFit >= 8 ? "⚠️" : "❌",
        message: conditionScore.reasons.find((r) => r.toLowerCase().includes("wave") || r.toLowerCase().includes("swell")) || "Swell conditions",
      } as const,
      wind: {
        status: conditionScore.subscores.windAlignment >= 12 ? "optimal" : conditionScore.subscores.windAlignment >= 6 ? "acceptable" : "poor",
        emoji: conditionScore.subscores.windAlignment >= 12 ? "✅" : conditionScore.subscores.windAlignment >= 6 ? "⚠️" : "❌",
        message: conditionScore.reasons.find((r) => r.toLowerCase().includes("wind") || r.toLowerCase().includes("offshore") || r.toLowerCase().includes("glassy")) || "Wind conditions",
      } as const,
      tide: {
        status: conditionScore.subscores.tideFit >= 10 ? "optimal" : conditionScore.subscores.tideFit >= 5 ? "acceptable" : "poor",
        emoji: conditionScore.subscores.tideFit >= 10 ? "✅" : conditionScore.subscores.tideFit >= 5 ? "⚠️" : "❌",
        message: conditionScore.reasons.find((r) => r.toLowerCase().includes("tide")) || "Tide conditions",
      } as const,
    };

    // Map recommendation label from unified scoring
    const decisionMap: Record<string, MorningIntelRecommendationSummary["decision"]> = {
      "Worth it": "worth_it",
      "Maybe": "maybe",
      "Skip": "skip",
    };

    recommendation = {
      decision: decisionMap[conditionScore.recommendationLabel] || "maybe",
      label: conditionScore.recommendationLabel,
      reasons: conditionScore.warnings.length > 0 ? conditionScore.warnings : conditionScore.reasons.slice(0, 2),
    };

    // Calculate optimal window using interpolation
    const optimalWindow = calculateOptimalWindow(forecastsForScoring, beachForScoring, {
      horizonHours: 8, // Morning window (6am-2pm)
      minSessionHours: 1,
    });

    if (optimalWindow) {
      bestWindow = formatTimeRange(optimalWindow.start, optimalWindow.end, timezone);
      if (optimalWindow.message) {
        bestWindow += `; ${optimalWindow.message}`;
      }
    }
  }

  // Generate notes based on conditions
  let notes = "";
  if (conditions) {
    if (recommendation.decision === "worth_it") {
      notes = "Worth it this morning — conditions line up. Still check the cam before you go.";
    } else if (recommendation.decision === "skip") {
      notes =
        recommendation.reasons.length > 0
          ? `Skip it — ${recommendation.reasons.join(" and ")} not ideal.`
          : "Skip it — conditions are not ideal.";
    } else {
      notes =
        recommendation.reasons.length > 0
          ? `Maybe — keep an eye on the ${recommendation.reasons.join(" and ")}.`
          : "Maybe — could be worth a look if you're nearby.";
    }
  } else {
    // Fallback to original notes
    if (surf.max < 2) {
      notes = "Small surf; best for longboards or beginners";
    } else if (surf.max > 6) {
      notes = "Solid swell; experienced surfers only";
    } else if (wind.offshore) {
      notes = "Clean conditions with offshore winds";
    } else {
      notes = "Standard morning conditions";
    }
  }

  // Calculate data completeness
  const totalPossibleFields =
    slice.forecasts.length * 7 + (slice.tides.length > 0 ? 10 : 0);
  let presentFields = slice.tides.length > 0 ? 10 : 0;

  slice.forecasts.forEach((f) => {
    if (f.wave_height) presentFields++;
    if (f.wave_period) presentFields++;
    if (f.wind_speed) presentFields++;
    if (f.wind_direction) presentFields++;
    if (f.swell_height) presentFields++;
    if (f.swell_period) presentFields++;
    if (f.swell_direction) presentFields++;
  });

  const dataCompleteness =
    totalPossibleFields > 0 ? presentFields / totalPossibleFields : 0;

  return {
    spotName,
    date,
    time: targetTime,
    surf,
    tide,
    swells,
    wind,
    bestWindow,
    confidence,
    notes,
    beachPreferences: beachPrefs || undefined,
    conditions,
    payload: {
      kind: "morning_intel_v2",
      generatedAt: new Date().toISOString(),
      date,
      time: targetTime,
      recommendation,
      conditions,
      bestWindow,
      confidence,
      surf,
      tide,
      wind,
      swells,
      dataCompleteness,
      sources: {
        wave: slice.forecasts.some((f) => f.wave_height !== null),
        tide: slice.forecasts.some((f) => f.tide_height !== null),
        wind: slice.forecasts.some((f) => f.wind_speed !== null),
        swell: slice.forecasts.some((f) => f.swell_height !== null),
      },
      beach: beachPrefs
        ? {
            name: beachPrefs.name,
            skillLevel: beachPrefs.skillLevel ?? null,
            hazards: beachPrefs.hazards ?? null,
            breakType: beachPrefs.breakType ?? null,
            aspectDeg: (beachPrefs as any).aspectDeg ?? null,
            windOffshoreDegUsed: beachPrefs.windOffshoreDeg ?? null,
            windOffshoreDegSource: (beachPrefs as any).windOffshoreDegSource ?? "db",
          }
        : undefined,
    },
  };
}

function buildDailyConditionsDescription(intelData: MorningIntelData): string {
  const rec = intelData.payload?.recommendation?.label ?? "Conditions update";
  const score =
    typeof intelData.conditions?.score === "number"
      ? `${intelData.conditions.score}/10`
      : null;

  const parts: string[] = [];
  parts.push(score ? `${rec} (${score})` : rec);
  if (intelData.bestWindow && intelData.bestWindow !== "N/A") {
    parts.push(`Best: ${intelData.bestWindow}`);
  }
  parts.push(`Surf ${intelData.surf.min}–${intelData.surf.max}ft`);
  parts.push(`Wind ${intelData.wind.speed}mph ${intelData.wind.cardinal}`);
  parts.push(`Tide ${intelData.tide.height.toFixed(1)}ft ${intelData.tide.direction}`);

  // Add the short note at the end for context, but keep it short.
  if (intelData.notes) {
    parts.push(intelData.notes);
  }

  return parts.join(" • ");
}

/**
 * Create or update intel post
 */
async function upsertIntelPost(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  beachId: string,
  intelData: MorningIntelData
) {
  console.log("📝 Creating/updating intel post...");

  const title = `Morning Surf Intel (${intelData.time})`;
  const description = buildDailyConditionsDescription(intelData);

  // Check for existing post today
  const { data: existingPost, error: searchError } = await supabase
    .from("intel_posts")
    .select("id")
    .eq("user_id", userId)
    .eq("beach_id", beachId)
    .eq("tag", "conditions")
    .gte("created_at", `${intelData.date}T00:00:00Z`)
    .lte("created_at", `${intelData.date}T23:59:59Z`)
    .maybeSingle();

  if (searchError) {
    console.warn(`⚠️  Error checking for existing post: ${searchError.message}`);
  }

  // Get beach coordinates for the post
  const { data: beach } = await supabase
    .from("beaches")
    .select("lat, lon")
    .eq("id", beachId)
    .single();

  if (!beach || beach.lat === null || beach.lon === null) {
    throw new Error("Failed to fetch beach coordinates");
  }

  const dedupeHash = createIntelDedupeHash({
    userId,
    tag: "conditions",
    beachId,
    title,
    description,
    latitude: beach.lat,
    longitude: beach.lon,
  });

  const expiresAt = new Date();
  expiresAt.setHours(23, 59, 59, 999); // Expires end of day

  if (existingPost) {
    // Update existing post
    console.log(`♻️  Updating existing post: ${existingPost.id}`);

    const { error: updateError } = await supabase
      .from("intel_posts")
      .update({
        title,
        description,
        surf_conditions: intelData.payload as unknown as Json,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        dedupe_hash: dedupeHash,
      })
      .eq("id", existingPost.id);

    if (updateError) {
      throw new Error(`Failed to update intel post: ${updateError.message}`);
    }

    console.log("✅ Intel post updated successfully");
    return existingPost.id;
  } else {
    // Create new post
    console.log("✨ Creating new intel post");

    const { data: newPost, error: createError } = await supabase
      .from("intel_posts")
      .insert({
        user_id: userId,
        beach_id: beachId,
        latitude: beach.lat,
        longitude: beach.lon,
        tag: "conditions",
        title,
        description,
        surf_conditions: intelData.payload as unknown as Json,
        is_active: true,
        expires_at: expiresAt.toISOString(),
        dedupe_hash: dedupeHash,
      })
      .select("id")
      .single();

    if (createError || !newPost) {
      throw new Error(
        `Failed to create intel post: ${createError?.message || "Unknown error"}`
      );
    }

    console.log(`✅ Intel post created successfully: ${newPost.id}`);
    return newPost.id;
  }
}

/**
 * Main execution function
 */
export async function runMorningIntel(): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  try {
    console.log("🌊 Starting Morning Surf Intel generation...");
    console.log(`📅 ${new Date().toISOString()}`);

    // Get configuration
    const config = getConfig();

    if (!config.enabled) {
      console.log("⏸️  Morning Intel is disabled via MORNING_INTEL_ENABLED");
      return { success: true };
    }

    // Initialize Supabase with service role key
    const supabase = getSupabaseClient();

    // Get bot user ID (no password needed with service role key)
    const userId = await getBotUserId(supabase, config.userEmail);

    // Get beach ID
    const beachId = await getOceanBeachId(supabase, config.spotId);

    // Fetch beach preferences
    const beachPrefs = await fetchBeachData(supabase, beachId);

    // Fetch forecast data
    const forecastSlice = await fetchForecastData(
      supabase,
      beachId,
      config.timezone
    );

    // Generate intel data
    const intelData = generateIntelData(
      forecastSlice,
      config.spotName,
      config.timezone,
      beachPrefs
    );

    console.log("📊 Intel Summary:");
    console.log(`  - Surf: ${intelData.surf.min}-${intelData.surf.max} ft`);
    console.log(`  - Tide: ${intelData.tide.height} ft, ${intelData.tide.direction}`);
    console.log(`  - Wind: ${intelData.wind.speed} mph ${intelData.wind.cardinal}`);
    console.log(`  - Confidence: ${intelData.confidence}`);

    // Create/update post
    const postId = await upsertIntelPost(supabase, userId, beachId, intelData);

    console.log("🎉 Morning Surf Intel completed successfully!");

    return { success: true, postId };
  } catch (error) {
    console.error("❌ Morning Intel failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Allow direct execution via node
if (require.main === module) {
  runMorningIntel()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        console.error("Failed:", result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
