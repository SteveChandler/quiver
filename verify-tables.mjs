import { createClient } from "@supabase/supabase-js";

async function verifyTables() {
  console.log("🔍 Verifying Supabase tables...");

  // Get environment variables - can use either anon or service key
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables!");
    console.log(
      "Please provide SUPABASE_URL and SUPABASE_KEY environment variables"
    );
    console.log("You can use your anon key for verification");
    return;
  }

  console.log(`✅ Found Supabase URL: ${supabaseUrl}`);

  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized");

    // Check if tables exist
    const tables = ["beaches", "boards", "sessions", "session_media"];
    const results = {};

    for (const table of tables) {
      try {
        console.log(`\n📋 Checking table: ${table}`);
        const { data, error } = await supabase.from(table).select("*").limit(1);

        if (error) {
          console.error(`❌ Error verifying table ${table}:`, error.message);
          results[table] = false;
        } else {
          console.log(`✅ Table ${table} exists`);
          results[table] = true;

          // Check if there's any data
          if (data && data.length > 0) {
            console.log(`📊 Sample data from ${table}:`, data[0]);
          } else {
            console.log(`ℹ️ Table ${table} exists but has no data`);
          }
        }
      } catch (error) {
        console.error(`❌ Error checking table ${table}:`, error);
        results[table] = false;
      }
    }

    // Summary
    console.log("\n📝 Verification Summary:");
    Object.entries(results).forEach(([table, exists]) => {
      console.log(`${exists ? "✅" : "❌"} ${table}`);
    });

    const allTablesExist = Object.values(results).every((v) => v);
    if (allTablesExist) {
      console.log("\n🎉 Success! All tables exist in your Supabase database.");
      console.log(
        "Your database schema is correctly set up according to create_session_tables.sql"
      );
    } else {
      console.log(
        "\n⚠️ Some tables are missing. You need to run the SQL script."
      );
      console.log("Follow these steps to create the missing tables:");
      console.log(
        "1. Go to https://supabase.com/dashboard and select your project"
      );
      console.log("2. Navigate to the SQL Editor");
      console.log("3. Create a new query");
      console.log("4. Paste the entire SQL script from sql-to-execute.sql");
      console.log("5. Click 'Run' to execute the script");
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

verifyTables();
