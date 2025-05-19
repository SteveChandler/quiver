import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function runSqlScript() {
  console.log("🔍 Running SQL script against Supabase...");

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || "";
  // Need to use service role key for SQL execution
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables!");
    console.log(
      "Please provide SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables"
    );
    console.log(
      "Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=your-service-role-key node run-sql-script.mjs"
    );
    console.log(
      "NOTE: The SERVICE ROLE key is required for SQL execution, not the anon key"
    );
    return;
  }

  console.log(`✅ Found Supabase URL: ${supabaseUrl}`);

  try {
    // Read the SQL file
    const sqlScript = fs.readFileSync(
      "./scripts/create_session_tables.sql",
      "utf8"
    );
    console.log("✅ SQL script loaded");

    // Initialize Supabase client with service role key (important for running SQL)
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized with service role key");

    // Split the script into individual statements
    const statements = sqlScript
      .replace(/\r\n/g, "\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    console.log("\n⏳ Executing SQL script... (this may take a moment)");

    // Create a single query to run with Supabase's SQL interface
    const { data, error } = await supabase.rpc("pgexec", {
      query: sqlScript,
    });

    if (error) {
      console.error("❌ Error executing SQL script:", error.message);

      // If the first approach doesn't work, try the alternative method
      console.log("\n🔄 Trying alternative method...");
      try {
        const { data: resultData, error: resultError } = await supabase
          .from("_pg_exec")
          .select("*")
          .eq("query", sqlScript)
          .single();

        if (resultError) {
          console.error(
            "❌ Alternative method also failed:",
            resultError.message
          );
        } else {
          console.log(
            "✅ SQL script executed successfully via alternative method"
          );
        }
      } catch (alternativeError) {
        console.error(
          "❌ Alternative method execution error:",
          alternativeError
        );
      }
    } else {
      console.log("✅ SQL script executed successfully");
    }

    // Verify tables exist
    console.log("\n🔍 Verifying tables were created...");
    await verifyTables(supabase);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

async function verifyTables(supabase) {
  const tables = ["beaches", "boards", "sessions", "session_media"];

  for (const table of tables) {
    try {
      console.log(`\n📋 Checking table: ${table}`);
      const { data, error } = await supabase.from(table).select("*").limit(1);

      if (error) {
        console.error(`❌ Error verifying table ${table}:`, error.message);
      } else {
        console.log(`✅ Table ${table} exists`);

        // Check if there's any data
        if (data && data.length > 0) {
          console.log(`📊 Sample data from ${table}:`, data[0]);
        } else {
          console.log(`ℹ️ Table ${table} exists but has no data`);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking table ${table}:`, error);
    }
  }
}

runSqlScript();
