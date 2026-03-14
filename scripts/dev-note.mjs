#!/usr/bin/env node

/**
 * Queue a dev note for Bluesky posting.
 *
 * Usage:
 *   yarn dev-note "your polished post text here"
 *
 * The text you pass is the final post — polish it in conversation
 * with Claude Code before running this script.
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function validateEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    console.error("Add them to .env.local and try again.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// CLI arg
// ---------------------------------------------------------------------------

const postText = process.argv[2]?.trim();

if (!postText) {
  console.error('Usage: yarn dev-note "your polished post text here"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------------

async function insertQueue(text) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("dev_notes_queue")
    .insert({ raw_text: text, polished_text: text })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateEnv();

  const charCount = postText.length;
  const label =
    charCount > 300 ? `${charCount} chars — may be long` : `${charCount} chars`;

  console.log(`\n${"─".repeat(50)}`);
  console.log(postText);
  console.log(`${"─".repeat(50)}`);
  console.log(`${label}\n`);
  console.log("Inserting into queue...");

  let id;
  try {
    id = await insertQueue(postText);
  } catch (err) {
    console.error(`Failed to insert: ${err.message}`);
    process.exit(1);
  }

  console.log(`Queued. Row id: ${id}`);
}

main();
