/**
 * Morning Surf Intel Script
 * Generates and posts automated daily morning surf intel for Ocean Beach, San Diego
 * Runs daily at 6:00 AM America/Los_Angeles
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  MorningIntelConfig,
  MorningIntelData,
} from "@/types/morning-intel";
import { IntelGenerationService } from "@/lib/services/intel-generation-service";
import { createIntelDedupeHash } from "@/lib/utils/intel-dedupe";

const TIMEZONE = "America/Los_Angeles";
const TARGET_HOUR = 6;

interface SupabaseConfig {
  url: string;
  key: string;
}

function getConfig(): MorningIntelConfig {
  return {
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
    userPassword: "",
    timezone: TIMEZONE,
    targetHour: TARGET_HOUR,
    enabled: process.env.MORNING_INTEL_ENABLED !== "false",
  };
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return { url, key };
}

function getSupabaseClient(config: SupabaseConfig) {
  return createClient<Database>(config.url, config.key);
}

async function getBotUserId(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  console.log(`🔐 Looking up bot user: ${cleanEmail}...`);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", cleanEmail)
    .limit(1);

  if (error) {
    throw new Error(`Database error looking up bot user: ${error.message}`);
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
      `Failed to find Ocean Beach, San Diego in database: ${
        error?.message || "Not found"
      }`
    );
  }

  console.log(`✅ Found Ocean Beach: ${data.name} (${data.id})`);
  return data.id;
}

function buildDailyConditionsDescription(intelData: MorningIntelData): string {
  const rec = intelData.payload?.recommendation?.label ?? "Conditions update";
  const score =
    typeof intelData.conditions?.score === "number"
      ? `${intelData.conditions.score}/10`
      : null;
  const parts: string[] = [score ? `${rec} (${score})` : rec];

  if (intelData.bestWindow && intelData.bestWindow !== "N/A") {
    parts.push(`Best: ${intelData.bestWindow}`);
  }
  parts.push(`Surf ${intelData.surf.min}–${intelData.surf.max}ft`);
  parts.push(`Wind ${intelData.wind.speed}mph ${intelData.wind.cardinal}`);
  parts.push(
    `Tide ${intelData.tide.height.toFixed(1)}ft ${intelData.tide.direction}`
  );
  if (intelData.notes) parts.push(intelData.notes);

  return parts.join(" • ");
}

async function upsertIntelPost(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  beachId: string,
  intelData: MorningIntelData
): Promise<string> {
  console.log("📝 Creating/updating intel post...");

  const title = `Morning Surf Intel (${intelData.time})`;
  const description = buildDailyConditionsDescription(intelData);
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
  expiresAt.setHours(23, 59, 59, 999);

  if (existingPost) {
    console.log(`♻️  Updating existing post: ${existingPost.id}`);
    const { error } = await supabase
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

    if (error) throw new Error(`Failed to update intel post: ${error.message}`);

    console.log("✅ Intel post updated successfully");
    return existingPost.id;
  }

  console.log("✨ Creating new intel post");
  const { data: newPost, error } = await supabase
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

  if (error || !newPost) {
    throw new Error(
      `Failed to create intel post: ${error?.message || "Unknown error"}`
    );
  }

  console.log(`✅ Intel post created successfully: ${newPost.id}`);
  return newPost.id;
}

export async function runMorningIntel(): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  try {
    console.log("🌊 Starting Morning Surf Intel generation...");
    console.log(`📅 ${new Date().toISOString()}`);

    const config = getConfig();
    if (!config.enabled) {
      console.log("⏸️  Morning Intel is disabled via MORNING_INTEL_ENABLED");
      return { success: true };
    }

    const supabaseConfig = getSupabaseConfig();
    const supabase = getSupabaseClient(supabaseConfig);
    const userId = await getBotUserId(supabase, config.userEmail);
    const beachId = await getOceanBeachId(supabase, config.spotId);
    const generator = new IntelGenerationService(
      supabaseConfig.url,
      supabaseConfig.key
    );
    const intelData = await generator.generateIntel(
      beachId,
      `${String(config.targetHour).padStart(2, "0")}:00`,
      config.timezone
    );

    console.log("📊 Intel Summary:");
    console.log(`  - Surf: ${intelData.surf.min}-${intelData.surf.max} ft`);
    console.log(
      `  - Tide: ${intelData.tide.height} ft, ${intelData.tide.direction}`
    );
    console.log(
      `  - Wind: ${intelData.wind.speed} mph ${intelData.wind.cardinal}`
    );
    console.log(`  - Confidence: ${intelData.confidence}`);

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

if (require.main === module) {
  runMorningIntel()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      }
      console.error("Failed:", result.error);
      process.exit(1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
