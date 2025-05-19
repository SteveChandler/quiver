import fs from "fs";

// Read the SQL file
const sqlScript = fs.readFileSync(
  "./scripts/create_session_tables.sql",
  "utf8"
);
console.log("SQL Script to run in Supabase SQL Editor:");
console.log("\n" + sqlScript);

// Also save to a file for easy copy-paste
fs.writeFileSync("./sql-to-execute.sql", sqlScript);
console.log("\nSQL saved to sql-to-execute.sql for easy copy-paste");
console.log("\nInstructions:");
console.log("1. Go to https://supabase.com/dashboard and select your project");
console.log("2. Navigate to the SQL Editor");
console.log("3. Create a new query");
console.log("4. Paste the entire SQL script");
console.log("5. Click 'Run' to execute the script");
console.log("6. Verify the tables were created in the Table Editor");
