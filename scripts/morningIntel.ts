/**
 * Morning Surf Intel Script
 * Generates and posts automated daily morning surf intel for Ocean Beach, San Diego
 * Runs daily at 6:00 AM America/Los_Angeles
 */

import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";
import { format, parseISO, addDays } from "date-fns";
import type { Database } from "@/types/database";
import type {
  MorningIntelConfig,
  MorningIntelData,
  ForecastSlice,
  BeachPreferences,
} from "@/types/morning-intel";
import {
  deriveSurfRange,
  tideAt,
  primarySecondarySwell,
  windAt,
  bestWindowHeuristic,
  confidenceHeuristic,
  renderIntelMarkdown,
  analyzeConditions,
} from "@/lib/utils/morning-intel-utils";

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
    .select("id, name, latitude, longitude")
    .ilike("name", "%Ocean Beach%")
    .gte("latitude", 32.74)
    .lte("latitude", 32.76)
    .gte("longitude", -117.26)
    .lte("longitude", -117.24)
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
): Promise<BeachPreferences | null> {
  console.log("🏖️  Fetching beach preferences...");

  const { data: beach, error } = await supabase
    .from("beaches")
    .select(
      "name, swell_window_min_deg, swell_window_max_deg, wind_offshore_deg, wind_offshore_tol_deg, tide_min_ft, tide_max_ft, hazards, skill_level, break_type"
    )
    .eq("id", beachId)
    .single();

  if (error || !beach) {
    console.warn(`⚠️  Could not fetch beach data: ${error?.message || "Not found"}`);
    return null;
  }

  console.log(`✅ Loaded preferences for ${beach.name}`);

  return {
    name: beach.name,
    swellWindowMin: beach.swell_window_min_deg,
    swellWindowMax: beach.swell_window_max_deg,
    windOffshoreDeg: beach.wind_offshore_deg,
    windOffshoreTol: beach.wind_offshore_tol_deg,
    tideMinFt: beach.tide_min_ft,
    tideMaxFt: beach.tide_max_ft,
    hazards: beach.hazards,
    skillLevel: beach.skill_level,
    breakType: beach.break_type,
  };
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
      "forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction, tide_height, tide_status, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, confidence_score"
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

  // Fetch tide data for the day
  const { data: tides, error: tideError } = await supabase
    .from("tide_forecasts")
    .select("ts, tide_height_m, tide_phase")
    .eq("beach_id", beachId)
    .gte("ts", `${today}T00:00:00Z`)
    .lte("ts", `${tomorrow}T23:59:59Z`)
    .order("ts", { ascending: true });

  if (tideError) {
    console.warn(`⚠️  Tide forecast query failed: ${tideError.message}`);
  }

  console.log(
    `📈 Fetched ${forecasts?.length || 0} forecast records, ${tides?.length || 0} tide records`
  );

  return {
    forecasts: forecasts || [],
    tides: tides || [],
  };
}

/**
 * Generate morning intel data from forecast
 */
function generateIntelData(
  slice: ForecastSlice,
  spotName: string,
  timezone: string,
  beachPrefs: BeachPreferences | null
): MorningIntelData {
  console.log("🔍 Analyzing forecast data...");

  const now = new Date();
  const targetTime = "06:00";
  const date = formatInTimeZone(now, timezone, "yyyy-MM-dd");

  // Calculate metrics
  const surf = deriveSurfRange(slice.forecasts);
  const tide = tideAt(targetTime, slice.tides, timezone);
  const swells = primarySecondarySwell(slice.forecasts);
  const wind = windAt(targetTime, slice.forecasts, timezone);
  const bestWindow = bestWindowHeuristic(
    slice.forecasts,
    slice.tides,
    timezone
  );
  const confidence = confidenceHeuristic(slice.forecasts, slice.tides);

  // Analyze conditions against beach preferences
  let conditions = undefined;
  if (beachPrefs) {
    conditions = analyzeConditions(
      {
        swellDirection: swells.primary?.direction,
        wind,
        tide,
      },
      beachPrefs
    );
    console.log(`📊 Conditions Score: ${conditions.score}/10`);
  }

  // Generate notes based on conditions
  let notes = "";
  if (conditions) {
    // Enhanced notes based on condition analysis
    const issues = [];
    if (conditions.swell.status === "poor") issues.push("swell direction");
    if (conditions.wind.status === "poor") issues.push("wind");
    if (conditions.tide.status === "poor") issues.push("tide");

    if (issues.length === 0) {
      notes = "Excellent conditions - all factors optimal!";
    } else if (issues.length === 1) {
      notes = `Good conditions overall, but watch the ${issues[0]}`;
    } else {
      notes = `Challenging conditions: ${issues.join(", ")} not ideal`;
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
    if (f.swell_1_height) presentFields++;
    if (f.swell_1_period) presentFields++;
    if (f.swell_1_direction) presentFields++;
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
      generatedAt: new Date().toISOString(),
      dataCompleteness,
      sources: {
        wave: slice.forecasts.some((f) => f.wave_height !== null),
        tide: slice.tides.length > 0,
        wind: slice.forecasts.some((f) => f.wind_speed !== null),
        swell: slice.forecasts.some((f) => f.swell_1_height !== null),
      },
    },
  };
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
  const body = renderIntelMarkdown(intelData);

  // Check for existing post today
  const { data: existingPost, error: searchError } = await supabase
    .from("intel_posts")
    .select("id")
    .eq("user_id", userId)
    .eq("beach_id", beachId)
    .eq("tag", "conditions")
    .gte("created_at", `${intelData.date}T00:00:00Z`)
    .lte("created_at", `${intelData.date}T23:59:59Z`)
    .single();

  if (searchError && searchError.code !== "PGRST116") {
    console.warn(`⚠️  Error checking for existing post: ${searchError.message}`);
  }

  // Get beach coordinates for the post
  const { data: beach } = await supabase
    .from("beaches")
    .select("latitude, longitude")
    .eq("id", beachId)
    .single();

  if (!beach) {
    throw new Error("Failed to fetch beach coordinates");
  }

  const expiresAt = new Date();
  expiresAt.setHours(23, 59, 59, 999); // Expires end of day

  if (existingPost) {
    // Update existing post
    console.log(`♻️  Updating existing post: ${existingPost.id}`);

    const { error: updateError } = await supabase
      .from("intel_posts")
      .update({
        title,
        description: body,
        surf_conditions: intelData.payload,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
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
        latitude: beach.latitude,
        longitude: beach.longitude,
        tag: "conditions",
        title,
        description: body,
        surf_conditions: intelData.payload,
        is_active: true,
        expires_at: expiresAt.toISOString(),
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
