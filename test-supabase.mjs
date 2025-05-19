import { createClient } from "@supabase/supabase-js";

async function testSupabase() {
  console.log("🔍 Testing Supabase Configuration...");

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables!");
    console.log(
      "Please provide SUPABASE_URL and SUPABASE_KEY environment variables"
    );
    console.log(
      "Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=your-key node test-supabase.mjs"
    );
    return;
  }

  console.log(`✅ Found Supabase URL: ${supabaseUrl}`);

  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized");

    // Test 1: Check beaches table
    console.log("\n🏖️  Testing beaches table...");
    const { data: beaches, error: beachesError } = await supabase
      .from("beaches")
      .select("*")
      .limit(5);

    if (beachesError) {
      console.error("❌ Error accessing beaches table:", beachesError.message);
    } else {
      console.log(
        `✅ Successfully retrieved ${beaches ? beaches.length : 0} beaches`
      );
      if (beaches && beaches.length > 0) {
        console.log(beaches);
      }
    }

    // Test 2: Check boards table
    console.log("\n🏄 Testing boards table...");
    const { data: boards, error: boardsError } = await supabase
      .from("boards")
      .select("*")
      .limit(5);

    if (boardsError) {
      console.error("❌ Error accessing boards table:", boardsError.message);
    } else {
      console.log(
        `✅ Successfully retrieved ${boards ? boards.length : 0} boards`
      );
      if (boards && boards.length > 0) {
        console.log(boards);
      }
    }

    // Test 3: Check sessions table
    console.log("\n📅 Testing sessions table...");
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .limit(5);

    if (sessionsError) {
      console.error(
        "❌ Error accessing sessions table:",
        sessionsError.message
      );
    } else {
      console.log(
        `✅ Successfully retrieved ${sessions ? sessions.length : 0} sessions`
      );
      if (sessions && sessions.length > 0) {
        console.log(sessions);
      }
    }

    // Test 4: Check storage buckets (if using)
    console.log("\n🗄️ Testing storage...");
    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error(
        "❌ Error accessing storage buckets:",
        bucketsError.message
      );
    } else {
      console.log(
        `✅ Successfully retrieved ${
          buckets ? buckets.length : 0
        } storage buckets`
      );
      if (buckets && buckets.length > 0) {
        console.log(buckets);
      }
    }

    // Test 5: Check auth configuration
    console.log("\n🔐 Testing auth configuration...");
    const { data: authSettings, error: authError } =
      await supabase.auth.getSession();

    if (authError) {
      console.error("❌ Error checking auth configuration:", authError.message);
    } else {
      console.log("✅ Auth configuration is working");
      if (authSettings && authSettings.session) {
        console.log(
          "Currently authenticated user:",
          authSettings.session.user.email
        );
      } else {
        console.log("No active session (this is normal for server tests)");
      }
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

testSupabase();
