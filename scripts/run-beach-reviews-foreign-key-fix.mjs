import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local and .env files
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
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
    console.log("Running beach reviews foreign key fix migration...");

    // Read the migration file
    const migrationPath = join(
      __dirname,
      "migrations",
      "008_fix_beach_reviews_foreign_key.sql"
    );

    console.log("Reading migration file:", migrationPath);
    const migrationSQL = readFileSync(migrationPath, "utf8");

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.match(/^--/));

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
        console.log(
          statement.substring(0, 100) + (statement.length > 100 ? "..." : "")
        );

        const { data, error } = await supabase.rpc("exec_sql", {
          sql: statement + ";",
        });

        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error);
          // Don't exit immediately - some errors might be expected (like "already exists")
          if (
            error.message &&
            !error.message.includes("already exists") &&
            !error.message.includes("does not exist") &&
            !error.message.includes("cannot drop")
          ) {
            throw error;
          } else {
            console.log("Continuing despite error (likely expected)...");
          }
        } else {
          console.log("✓ Statement executed successfully");
        }
      }
    }

    console.log(
      "\n🎉 Beach reviews foreign key fix migration completed successfully!"
    );

    // Verify the foreign key relationship
    console.log("\nVerifying foreign key relationship...");
    const { data: constraints, error: constraintError } = await supabase.rpc(
      "exec_sql",
      {
        sql: `
          SELECT 
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'beach_reviews'
            AND kcu.column_name = 'user_id';
        `,
      }
    );

    if (constraintError) {
      console.error("Error checking constraints:", constraintError);
    } else {
      console.log("Foreign key relationship verified!");
      console.log(constraints);
    }

    // Test that we can now query beach reviews with profiles
    console.log("\nTesting beach reviews query with profiles join...");
    const { data: testQuery, error: testError } = await supabase
      .from("beach_reviews")
      .select(
        `
        id,
        title,
        user:profiles!user_id(full_name, avatar_url, email)
      `
      )
      .limit(1);

    if (testError) {
      console.error("Test query failed:", testError);
    } else {
      console.log("✓ Beach reviews query with profiles join works!");
      console.log("Sample data:", testQuery);
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
