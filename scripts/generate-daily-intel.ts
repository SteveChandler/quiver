/**
 * Generate Beach Intel for Top Beaches
 * Run 3x daily: 6am, 10am, 2pm PT via GitHub Actions
 * 
 * Usage:
 *   npm run generate-daily-intel
 */

import { config } from "dotenv";
import { IntelGenerationService } from "../lib/services/intel-generation-service";
import { formatInTimeZone } from "date-fns-tz";

config();

// Phase 1: Manually curated top 10 San Diego beaches
const TOP_BEACHES_MANUAL = [
  '65d177de-e75a-4ad8-aa0d-48a67c0851b0', // 1. Ocean Beach Pier - Intermediate, iconic
  '91df193c-f2c8-4e6c-984e-b859bd741061', // 2. Tourmaline Surf Park - Beginner, very popular
  'cc7c0837-257c-42c3-9d98-634911e73a6a', // 3. Crystal Pier (Pacific Beach) - Beginner
  'cdcf733b-a704-45ef-affc-d8152ffde1e4', // 4. Mission Beach (Central) - Beginner
  '13ef0aa1-c857-4d82-a40d-a83612110943', // 5. PB Point - Intermediate, iconic point break
  '4b0cf129-c706-4e24-8210-2219defc5ea7', // 6. Scripps (La Jolla) - Intermediate
  '15c7337e-5258-4339-9dc3-c435c666926b', // 7. Ocean Beach (general) - Intermediate
  'ca2b1d6f-2428-4273-ab02-7555eeec4323', // 8. Birdrock (La Jolla) - Advanced, reef
  'd305ba0d-47cd-4494-b790-f924dac7bf1f', // 9. Sunset Cliffs (Garbage) - Advanced, iconic
  '30e68b00-c27d-4d22-ba57-2d92156964c6', // 10. Horseshoe (La Jolla) - Advanced, reef
];

/**
 * Get current generation time based on hour
 */
function getCurrentGenerationTime(): string {
  const now = new Date();
  const hour = parseInt(formatInTimeZone(now, "America/Los_Angeles", "HH"));
  
  if (hour >= 6 && hour < 10) return "06:00";
  if (hour >= 10 && hour < 14) return "10:00";
  return "14:00";
}

/**
 * Main generation function
 */
async function generateDailyIntel() {
  const startTime = Date.now();
  const generationTime = getCurrentGenerationTime();
  const now = new Date();
  const ptTime = formatInTimeZone(now, "America/Los_Angeles", "yyyy-MM-dd HH:mm:ss zzz");
  
  console.log("🌊 Beach Intel Generation");
  console.log(`📅 ${now.toISOString()}`);
  console.log(`🕐 PT Time: ${ptTime}`);
  console.log(`⏰ Generation window: ${generationTime}`);
  console.log("─".repeat(60));
  
  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing required environment variables:");
    console.error("   SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
    console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗");
    process.exit(1);
  }

  // Get list of beaches to process
  const beachIds = [...TOP_BEACHES_MANUAL];
  
  console.log(`\n📊 Generating intel for ${beachIds.length} beaches...\n`);

  // Create service
  const service = new IntelGenerationService(supabaseUrl, supabaseKey);

  // Track results
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  const errors: Array<{beachId: string; error: string}> = [];

  // Process each beach
  for (let i = 0; i < beachIds.length; i++) {
    const beachId = beachIds[i];
    const beachNum = i + 1;
    
    try {
      // Check if beach can generate intel
      const canGenerate = await service.canGenerateIntel(beachId);
      if (!canGenerate) {
        skippedCount++;
        console.log(`⏭️  [${beachNum}/${beachIds.length}] ${beachId} - Missing preferences, skipped`);
        continue;
      }

      // Generate intel
      const intel = await service.generateIntel(beachId, generationTime);

      // Save to database
      await service.saveIntel(beachId, intel, generationTime);

      successCount++;
      console.log(`✅ [${beachNum}/${beachIds.length}] ${beachId} - Success (${intel.spotName})`);
    } catch (error) {
      failCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ beachId, error: errorMsg });
      console.error(`❌ [${beachNum}/${beachIds.length}] ${beachId} - ${errorMsg}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Print summary
  console.log("\n" + "─".repeat(60));
  console.log("📊 Generation Summary");
  console.log("─".repeat(60));
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📈 Total: ${beachIds.length}`);
  
  // Print errors if any
  if (errors.length > 0) {
    console.log("\n" + "─".repeat(60));
    console.log("❌ Errors:");
    console.log("─".repeat(60));
    errors.forEach(({ beachId, error }) => {
      console.log(`   ${beachId}: ${error}`);
    });
  }
  
  console.log("\n" + "─".repeat(60));
  
  // Exit with error code if any failures
  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} beach(es) failed to generate intel`);
    process.exit(1);
  } else {
    console.log("\n🎉 All beaches processed successfully!");
  }
}

// Run if called directly
if (require.main === module) {
  generateDailyIntel()
    .then(() => {
      console.log("\n✅ Intel generation complete!\n");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Fatal error:", error);
      console.error(error.stack);
      process.exit(1);
    });
}

export { generateDailyIntel };

