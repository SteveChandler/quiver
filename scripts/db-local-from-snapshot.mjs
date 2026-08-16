#!/usr/bin/env node
/**
 * Boot local Supabase from the committed schema snapshot instead of replaying
 * all migrations.
 *
 * Full replay does not work: a third of the beach catalog is created by no
 * migration, and several data migrations assert against rows that only exist in
 * production. See .planning/migration-replay-broken-beach-uuids-20260813.md
 *
 * This temporarily disables migration replay in config.toml, loads
 * supabase/snapshots/{schema,catalog}.sql as seed files, then ALWAYS restores
 * config.toml — including on failure or Ctrl-C — so the committed file is never
 * left modified.
 *
 * Usage: yarn db:local
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = resolve(REPO, "supabase/config.toml");
const SCHEMA = resolve(REPO, "supabase/snapshots/schema.sql");
const CATALOG = resolve(REPO, "supabase/snapshots/catalog.sql");
const STORAGE = resolve(REPO, "supabase/snapshots/storage-policies.sql");

for (const [label, p] of [["schema", SCHEMA], ["catalog", CATALOG], ["storage-policies", STORAGE]]) {
  if (!existsSync(p)) {
    console.error(`Missing ${label} snapshot: ${p}\nRegenerate with: yarn db:snapshot`);
    process.exit(1);
  }
}

const original = readFileSync(CONFIG, "utf8");
let restored = false;
const restore = () => {
  if (restored) return;
  restored = true;
  writeFileSync(CONFIG, original);
  console.log("restored supabase/config.toml");
};
process.on("exit", restore);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { restore(); process.exit(130); });
}

const patch = (toml) => {
  let out = toml;
  // disable migration replay
  const mig = /(\[db\.migrations\][\s\S]*?)^enabled\s*=\s*true/m;
  if (!mig.test(out)) throw new Error("could not find [db.migrations] enabled = true in config.toml");
  out = out.replace(mig, "$1enabled = false");
  // point the seed at the snapshots, schema first
  const seed = /(\[db\.seed\][\s\S]*?)^sql_paths\s*=\s*\[[^\]]*\]/m;
  if (!seed.test(out)) throw new Error("could not find [db.seed] sql_paths in config.toml");
  out = out.replace(seed, `$1sql_paths = ["./snapshots/schema.sql", "./snapshots/storage-policies.sql", "./snapshots/catalog.sql"]`);
  return out;
};

const run = (args) =>
  execFileSync("supabase", args, { cwd: REPO, stdio: "inherit", env: { ...process.env, LC_ALL: "C", LANG: "C" } });

try {
  writeFileSync(CONFIG, patch(original));
  console.log("config.toml patched: migrations disabled, snapshots seeded\n");

  try { run(["stop", "--no-backup"]); } catch { /* not running is fine */ }
  run(["start"]);

  restore();
  console.log("\nLocal Supabase is up, built from the snapshot.");
  console.log("Migrations were NOT replayed. To test a new migration, apply it directly:");
  console.log("  psql \"$(supabase status -o json | jq -r .DB_URL)\" -f supabase/migrations/<file>.sql");
} catch (err) {
  restore();
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
}
