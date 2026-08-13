#!/usr/bin/env node
/**
 * Export reference catalog data from production for the local snapshot.
 *
 * ALLOWLIST ONLY — this file is committed, so tables are opted in explicitly
 * rather than excluding PII tables. A column-name guard refuses to emit
 * anything that looks like user data.
 *
 * Column types are read from supabase/snapshots/schema.sql so array vs jsonb vs
 * scalar literals are emitted with the right cast.
 *
 * Usage: yarn db:snapshot   (dumps schema.sql, then runs this)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = resolve(REPO, "supabase/snapshots/schema.sql");

// Never add a table containing user data.
const TABLES = ["beaches"];

const env = {};
for (const l of readFileSync(resolve(REPO, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Parse `CREATE TABLE public.<t> (...)` out of the schema dump → { col: sqlType }. */
function columnTypes(table) {
  const sql = readFileSync(SCHEMA, "utf8");
  // pg_dump emits: CREATE TABLE IF NOT EXISTS "public"."beaches" (
  const re = new RegExp(
    `CREATE TABLE (?:IF NOT EXISTS )?(?:ONLY )?"?public"?\\."?${table}"?\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i"
  );
  const m = sql.match(re);
  if (!m) throw new Error(`could not find CREATE TABLE public.${table} in schema.sql`);
  const types = {};
  const generated = new Set();
  for (const raw of m[1].split("\n")) {
    const line = raw.trim().replace(/,$/, "");
    if (!line || /^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)\b/i.test(line)) continue;
    const cm = line.match(/^"?([a-z0-9_]+)"?\s+(.+)$/i);
    if (!cm) continue;
    // GENERATED ... STORED columns reject explicit values on INSERT
    if (/GENERATED\s+ALWAYS\s+AS/i.test(cm[2])) generated.add(cm[1]);
    types[cm[1]] = cm[2].replace(/\s+(NOT NULL|DEFAULT[\s\S]*|GENERATED[\s\S]*)$/i, "").trim().toLowerCase();
  }
  return { types, generated };
}

const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;

function literal(value, sqlType) {
  if (value === null || value === undefined) return "NULL";
  const t = (sqlType ?? "").toLowerCase();

  if (/\[\]$/.test(t) || t.startsWith("array")) {
    const el = t.replace(/\[\]$/, "") || "text";
    if (!Array.isArray(value)) return `ARRAY[${esc(value)}]::${el}[]`;
    if (!value.length) return `'{}'::${el}[]`;
    return `ARRAY[${value.map((v) => (v === null ? "NULL" : esc(v))).join(", ")}]::${el}[]`;
  }
  if (t.includes("json")) return `${esc(JSON.stringify(value))}::${t.includes("jsonb") ? "jsonb" : "json"}`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "object") return `${esc(JSON.stringify(value))}::jsonb`;
  return esc(value);
}

let out = `-- Reference catalog snapshot for LOCAL DEVELOPMENT ONLY.
-- Generated from production by scripts/db-snapshot-catalog.mjs. Contains no user data.
-- Allowlisted tables: ${TABLES.join(", ")}
-- Regenerate with: yarn db:snapshot

SET session_replication_role = replica;  -- defer FK/trigger work while loading

`;

for (const table of TABLES) {
  const { types, generated } = columnTypes(table);
  const { data, error } = await sb.from(table).select("*").limit(5000);
  if (error) { console.error(`${table}: ${error.message}`); process.exit(1); }
  if (!data.length) { console.log(`${table}: 0 rows, skipped`); continue; }

  const cols = Object.keys(data[0]).filter((c) => !generated.has(c));
  if (generated.size) console.log(`  skipping generated column(s): ${[...generated].join(", ")}`);
  const risky = cols.filter((c) => /email|phone|password|token|secret|apple|stripe|ip_address|^user_id$|device/i.test(c));
  if (risky.length) {
    console.error(`REFUSING ${table}: columns look like user data -> ${risky.join(", ")}`);
    process.exit(1);
  }
  const unknown = cols.filter((c) => !types[c]);
  if (unknown.length) console.warn(`  warn: no type found for ${unknown.join(", ")} — emitting as text`);

  out += `\n-- ${table}: ${data.length} rows\n`;
  for (const row of data) {
    const vals = cols.map((c) => literal(row[c], types[c])).join(", ");
    out += `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  console.log(`${table}: ${data.length} rows, ${cols.length} columns`);
}

// Storage buckets are configuration, not user data, and a schema-only dump
// carries no rows — without these the local stack has nowhere to upload.
{
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) { console.error(`storage.buckets: ${error.message}`); process.exit(1); }
  out += `\n-- storage.buckets: ${buckets.length} buckets (configuration only)\n`;
  for (const b of buckets) {
    const mimes = b.allowed_mime_types?.length
      ? `ARRAY[${b.allowed_mime_types.map(esc).join(", ")}]::text[]`
      : "NULL";
    out += `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (${esc(b.id)}, ${esc(b.name)}, ${b.public}, ${b.file_size_limit ?? "NULL"}, ${mimes}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  console.log(`storage.buckets: ${buckets.length} buckets`);
}

out += `\nSET session_replication_role = DEFAULT;\n`;
writeFileSync(resolve(REPO, "supabase/snapshots/catalog.sql"), out);
console.log("wrote supabase/snapshots/catalog.sql");

// ── storage RLS policies ──────────────────────────────────────────────────
// `supabase db dump` covers the public schema only, so storage.objects policies
// are absent from schema.sql. Without them RLS denies every upload — which
// looks exactly like a broken storage path. Extract the policies only; the
// storage tables themselves are created by the local storage image.
{
  const raw = resolve(REPO, "supabase/snapshots/.storage-raw.sql");
  execFileSync("supabase", ["db", "dump", "--linked", "-s", "storage", "-f", raw], { cwd: REPO, stdio: "pipe" });
  const sql = readFileSync(raw, "utf8");
  rmSync(raw, { force: true });

  const policies = [...sql.matchAll(/CREATE POLICY[\s\S]*?;\s*$/gm)].map((m) => m[0].trim());
  const names = policies.map((p) => p.match(/CREATE POLICY "([^"]+)"/)?.[1]).filter(Boolean);

  const body = `-- storage.objects RLS policies, extracted from production.
-- schema.sql covers the public schema only; without these RLS denies every
-- upload locally, which is indistinguishable from a bad storage path.
-- Tables are omitted deliberately — the local storage image creates them.
-- Regenerate with: yarn db:snapshot

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

${names.map((n) => `DROP POLICY IF EXISTS "${n}" ON storage.objects;`).join("\n")}

${policies.join("\n\n")}
`;
  writeFileSync(resolve(REPO, "supabase/snapshots/storage-policies.sql"), body);
  console.log(`storage policies: ${policies.length} extracted`);
  console.log("wrote supabase/snapshots/storage-policies.sql");
}
