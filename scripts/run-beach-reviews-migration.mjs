import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log("Running beach reviews migration...");

    // Read the migration file
    const migrationPath = join(
      __dirname,
      "migrations",
      "007_create_beach_reviews_table.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf8");

    // Execute the migration
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: migrationSQL,
    });

    if (error) {
      console.error("Error running migration:", error);
      process.exit(1);
    }

    console.log("Beach reviews migration completed successfully!");

    // Verify the table was created
    const { data: tableExists, error: checkError } = await supabase
      .from("beach_reviews")
      .select("*")
      .limit(1);

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking table:", checkError);
    } else {
      console.log("Beach reviews table is ready!");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
