// Isolated integration test: all RPC results come from PostgreSQL, never mocks.
// The only network option is a bounded, public historical provider replay.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

// tsx registers the repository's CommonJS TypeScript imports without mocking them.
const require = createRequire(import.meta.url);
const { fetchOpenMeteoSingleRunReceipt, buildOpenMeteoSingleRunRequest } = require("../lib/alerts/swell-watch/single-run-receipt.ts");
const { storePrototypeSingleRunReceipts } = require("../lib/alerts/swell-watch/provider-run-store.ts");
const { evaluateSwellWatchShadow } = require("../lib/alerts/swell-watch/shadow-evaluation.ts");
const { loadAttestedSwellWatchRun } = require("../lib/alerts/swell-watch/attested-run.ts");

const container = process.argv[2];
assert.match(container ?? "", /^swell-watch-study-test-\d+$/);
const database = "study_normalization";
const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = readdirSync(migrationsDirectory).filter((name) => /^\d{14}_normalize_swell_watch_provider_direction\.sql$/.test(name));
assert.equal(migrationNames.length, 1, "Exactly one tracked normalization migration required");
const migration = readFileSync(new URL(migrationNames[0], migrationsDirectory), "utf8");
const rollback = readFileSync(new URL("../docs/operations/swell-watch-direction-normalization-rollback.sql", import.meta.url), "utf8");
const policy = JSON.parse(readFileSync(new URL("../docs/operations/swell-watch-no-send-producer-config-v2-proposed.json", import.meta.url), "utf8")).policy;
assert.equal(policy.policy_values.staleness.maximum_forecast_age_hours, 12);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const j = (value) => `${q(JSON.stringify(value))}::jsonb`;
const command = ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-qAt", "-v", "ON_ERROR_STOP=1"];
function sql(text) {
  const result = spawnSync("docker", command, { input: text, encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error((result.stderr || "isolated PostgreSQL command failed").split("\n")[0].slice(0, 200));
  return result.stdout.trim();
}
function value(text) { return JSON.parse(sql(text)); }
const tableRpcs = new Set(["record_swell_watch_provider_run_receipt", "complete_swell_watch_study_run", "record_swell_watch_shadow_demand"]);
const jsonRpcs = new Set(["read_swell_watch_run_scope", "read_swell_watch_attested_run", "record_swell_watch_study_evaluation"]);
const calls = [];
const client = {
  from() { throw new Error("Unexpected audience/table read in zero-candidate fixture"); },
  async rpc(name, args) {
    assert(tableRpcs.has(name) || jsonRpcs.has(name), `Forbidden RPC: ${name}`);
    calls.push(name);
    const params = Object.entries(args).map(([key, item]) => {
      assert.match(key, /^p_[a-z_]+$/);
      return `${key} => ${typeof item === "object" ? j(item) : q(item)}`;
    }).join(",");
    const expression = `public.${name}(${params})`;
    try {
      return { data: value(`SET ROLE service_role; SELECT ${tableRpcs.has(name) ? `coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM ${expression} r` : expression};`), error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  },
};
const cohort = Array.from({ length: 10 }, (_, i) => ({ sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, regionKey: "normalization-fixture" }));
const inputs = cohort.map(({ sourcePointId }) => ({ sourcePointId, latitude: 32.8, longitude: -117.3,
  beach: { swell_window_center_deg: 180, swell_window_halfwidth_deg: 90, swell_access_factors: null, terrain_enabled: null, deepwater_decay_factor: null, shoaling_factors: null } }));
const scopes = inputs.map((input) => ({ ...input, regionKey: "normalization-fixture" }));
const runUtc = new Date(Math.floor(Date.now() / 21_600_000) * 21_600_000).toISOString().slice(0, 16) + "Z";
const fields = ["swell_wave_height", "swell_wave_period", "swell_wave_direction", "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"];
function body(run = runUtc, normalized = false, unavailable = false) {
  const time = Array.from({ length: 168 }, (_, index) => new Date(Date.parse(run) + index * 3_600_000).toISOString().slice(0, 16));
  const hourly = { time }; const hourly_units = { time: "iso8601" };
  fields.forEach((field, i) => { hourly[field] = Array(168).fill([1.2, 12, 225, 0.6, 9, 170][i]); hourly_units[field] = ["m", "s", "°"][i % 3]; });
  if (normalized) { hourly.swell_wave_direction[146] = 360; hourly.secondary_swell_wave_direction[145] = 360; }
  if (unavailable) fields.slice(3).forEach((field) => { hourly[field][0] = 0; });
  return { latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0, timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0, hourly_units, hourly };
}
async function parsed(payload) {
  const raw = JSON.stringify(payload);
  return fetchOpenMeteoSingleRunReceipt({ latitude: 32.8, longitude: -117.3, runUtc, forecastDays: 7 }, async () => ({ status: 200, text: async () => raw }));
}
const normal = await parsed(body()); const normalized = await parsed(body(runUtc, true));
assert.equal(normalized.observations[146].components[0].directionDeg, 0);
assert.equal(JSON.parse(normalized.rawResponse).hourly.swell_wave_direction[146], 360);
const provenance = { rule: "north_360_to_0.v1", rawDegrees: 360, canonicalDegrees: 0 };
assert.deepEqual(normalized.observations[146].components[0].rawFieldProvenance.directionNormalization, provenance);
const batch = (receipt) => cohort.map(({ sourcePointId }) => ({ sourcePointId, receipt: structuredClone(receipt) }));
const sendCounts = () => value("SELECT jsonb_build_object('authorities',(SELECT count(*) FROM public.swell_watch_production_approval_authority),'bindings',(SELECT count(*) FROM public.swell_watch_notification_event_bindings),'events',(SELECT count(*) FROM public.notification_events));");
const snapshot = () => value("SELECT jsonb_build_object('issuances',(SELECT count(*) FROM public.swell_watch_provider_run_issuances),'revisions',(SELECT count(*) FROM public.swell_watch_provider_run_revisions),'sets',(SELECT count(*) FROM public.swell_watch_provider_run_revision_sets),'components',(SELECT count(*) FROM public.swell_watch_provider_run_revision_components),'raw',(SELECT count(*) FROM public.swell_watch_provider_run_revision_raw_responses));");
const functionHash = () => sql("SELECT encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_provider_run_receipt(jsonb)'::regprocedure),'sha256'),'hex');");
const permissions = () => sql("SELECT proacl::text FROM pg_proc WHERE oid='public.record_swell_watch_provider_run_receipt(jsonb)'::regprocedure;");
sql(rollback);
assert.equal(functionHash(), "26d064b92fb0023f079d399ca062833f7d9a882d53d1f1e9ab55ef1a5726f522");
const acl = permissions();
sql(`INSERT INTO public.beaches(id,lat,lon,swell_window_center_deg,swell_window_halfwidth_deg) VALUES ${cohort.map(({ sourcePointId }) => `(${q(sourcePointId)},32.8,-117.3,180,90)`).join(",")};`);
const storedBefore = await storePrototypeSingleRunReceipts(batch(normal), client);
await assert.rejects(storePrototypeSingleRunReceipts(batch(normalized), client), /component provenance/);
const before = snapshot();
sql(migration); sql(migration);
assert.equal(functionHash(), "0374cd88bf8a6edf727a82dea6d90e6b9d4962dbe9d812c0581651a69d4c8dd4");
assert.equal(permissions(), acl); assert.deepEqual(snapshot(), before);
assert.deepEqual(await storePrototypeSingleRunReceipts(batch(normal), client), storedBefore);

// Bypass TS's convenience validator deliberately: exercise real SQL's trust boundary.
const malicious = [];
const add = (label, mutate) => { const receipt = structuredClone(normalized); mutate(receipt); malicious.push({ label, receipt }); };
const component = (receipt) => receipt.observations[146].components[0];
add("missing normalization", (r) => { delete component(r).rawFieldProvenance.directionNormalization; });
add("wrong normalization version", (r) => { component(r).rawFieldProvenance.directionNormalization.rule = "forged"; });
add("wrong raw provenance", (r) => { component(r).rawFieldProvenance.directionNormalization.rawDegrees = 359; });
add("wrong canonical provenance", (r) => { component(r).rawFieldProvenance.directionNormalization.canonicalDegrees = 1; });
add("extra normalization key", (r) => { component(r).rawFieldProvenance.directionNormalization.extra = true; });
add("canonical 360", (r) => { component(r).directionDeg = 360; });
add("invented canonical direction", (r) => { component(r).directionDeg = 1; });
function rewriteRaw(r, mutate) {
  const raw = JSON.parse(r.rawResponse); mutate(raw);
  r.rawResponse = JSON.stringify(raw); r.rawResponseSha256 = createHash("sha256").update(r.rawResponse).digest("hex");
  delete raw.generationtime_ms; r.canonicalSemanticPayload = JSON.stringify(raw);
  r.revisionHash = createHash("sha256").update(r.canonicalSemanticPayload).digest("hex");
}
for (const direction of [-1, 360.1, 720, "360", null]) add(`raw invalid direction ${String(direction)}`, (r) => rewriteRaw(r, (raw) => { raw.hourly.swell_wave_direction[146] = direction; }));
add("zero raw direction with forged normalization", (r) => rewriteRaw(r, (raw) => { raw.hourly.swell_wave_direction[146] = 0; }));
add("raw 0/0/360 fabricated as unavailable", (r) => {
  Object.assign(component(r), { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
  rewriteRaw(r, (raw) => { raw.hourly.swell_wave_height[146] = 0; raw.hourly.swell_wave_period[146] = 0; });
});
add("tampered raw hash", (r) => { r.rawResponseSha256 = "0".repeat(64); });
for (const { label, receipt } of malicious) {
  const result = await client.rpc("record_swell_watch_provider_run_receipt", { p_scopes: batch(receipt).map((row) => ({ ...row, receipt: { ...row.receipt, hourlyUnits: JSON.parse(row.receipt.rawResponse).hourly_units } })) });
  assert(result.error, `Database accepted ${label}`);
  assert.deepEqual(snapshot(), before, `Partial writes after ${label}`);
}
const stored = await storePrototypeSingleRunReceipts(batch(normalized), client);
const retained = snapshot(); assert.deepEqual(await storePrototypeSingleRunReceipts(batch(normalized), client), stored); assert.deepEqual(snapshot(), retained);
const safetyBefore = sendCounts();
// Synthetic authority exists ONLY inside the disposable database; production policy values are unchanged.
sql(`SELECT set_config('app.swell_watch_internal_write','on',false);
INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'disabled','normalization_fixture');
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'active',${q(policy.value_hash)},${j(policy.policy_values)},'synthetic normalization test',repeat('b',64),${q(runUtc)}::timestamptz-interval '1 hour',clock_timestamp()+interval '1 day');
INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
VALUES(1,'active',${q(policy.value_hash)},${j(cohort)},public.swell_watch_study_scope_inputs(${j(cohort)}),
encode(extensions.digest(jsonb_build_object('policyHash',${q(policy.value_hash)},'cohort',${j(cohort)},'scopeInputs',public.swell_watch_study_scope_inputs(${j(cohort)}),'forecastDays',7,'targetDays',30,'providerContractRef','synthetic normalization test only','evidenceSha256',repeat('b',64))::text,'sha256'),'hex'),30,'synthetic normalization test only',repeat('b',64),'synthetic normalization test',${q(runUtc)}::timestamptz-interval '1 hour',clock_timestamp()+interval '1 day');`);
const authorityBefore = sql("SELECT to_jsonb(a)::text FROM public.swell_watch_study_authorities a;");
async function completeAndEvaluate(receipt) {
  const stored = await storePrototypeSingleRunReceipts(batch(receipt), client);
  const result = await client.rpc("complete_swell_watch_study_run", { p_revision_set_id: stored.revisionSetId, p_policy_hash: policy.value_hash, p_cohort: cohort, p_scope_inputs: inputs });
  assert.equal(result.error, null); assert.equal(result.data.length, 1);
  const completed = result.data[0];
  const run = await loadAttestedSwellWatchRun({ providerBatchId: completed.provider_batch_id, sourcePointId: cohort[0].sourcePointId }, client);
  assert.deepEqual(run.samples[146].components[0].rawFieldProvenance.directionNormalization, provenance);
  const evaluation = await evaluateSwellWatchShadow({ providerBatchId: completed.provider_batch_id, forecastDays: 7, now: new Date().toISOString(), policy, scopes }, client);
  const recorded = await client.rpc("record_swell_watch_study_evaluation", { p_provider_batch_id: completed.provider_batch_id, p_policy_hash: policy.value_hash, p_result: evaluation, p_scope_inputs: inputs });
  assert.equal(recorded.error, null); assert.equal(recorded.data.recorded, true);
  return { stored, completed, evaluation };
}
const success = await completeAndEvaluate(normalized);
assert.equal(success.evaluation.status, "evaluated"); assert.equal(success.evaluation.candidateCount, 0);
assert.equal(success.evaluation.scopeOutcomes.length, 10); assert(success.evaluation.scopeOutcomes.every((s) => s.status === "derived"));
assert.equal(success.evaluation.enqueued, 0);
assert.equal(value("SELECT public.read_swell_watch_study_health();").qualifyingDays, 0);
const missing = await completeAndEvaluate(await parsed(body(runUtc, true, true)));
assert.equal(missing.evaluation.status, "suppressed"); assert.equal(missing.evaluation.reason, "incomplete_partition");
assert(missing.evaluation.scopeOutcomes.every((s) => s.status === "suppressed"));
assert.deepEqual(sendCounts(), safetyBefore); assert.equal(sql("SELECT to_jsonb(a)::text FROM public.swell_watch_study_authorities a;"), authorityBefore);
const finalEvidence = snapshot(); sql(rollback); sql(rollback); assert.deepEqual(snapshot(), finalEvidence);
await assert.rejects(storePrototypeSingleRunReceipts(batch(normalized), client), /component provenance/);
sql(migration); assert.deepEqual(snapshot(), finalEvidence); assert.equal(permissions(), acl);
assert.equal(sql("SELECT count(*) FROM public.swell_watch_provider_run_revision_raw_responses WHERE raw_response_sha256<>encode(extensions.digest(raw_response,'sha256'),'hex');"), "0");
console.log(JSON.stringify({ mode: "synthetic_disposable_postgres_integration", acceptedNormalizationRule: provenance.rule, maliciousReceiptsRejected: malicious.length,
  databaseRpcCalls: calls.length, realEvaluatorStatus: success.evaluation.status, completeScopeCount: success.evaluation.scopeOutcomes.length,
  zeroTupleStatus: missing.evaluation.status, zeroTupleReason: missing.evaluation.reason, qualifyingDays: 0,
  policyFreshnessHours: 12, idempotentMigration: true, evidencePreservingRollback: true, unchangedGrants: true, sends: safetyBefore }, null, 2));

if (process.env.SWELL_WATCH_NORMALIZATION_PROVIDER_PROBE === "true") {
  const sourcePointId = "f11ccd59-b778-4ea1-a8ff-88bffb447cd8";
  const input = { latitude: 18.370386, longitude: -67.25763, runUtc: "2026-09-13T06:00Z", forecastDays: 7 };
  const observedAt = new Date().toISOString();
  const request = buildOpenMeteoSingleRunRequest(input);
  const response = await fetch(request.url, { method: "GET", redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200); assert(response.body);
  const chunks = []; let bytes = 0; const reader = response.body.getReader();
  for (;;) { const { done, value: chunk } = await reader.read(); if (done) break; bytes += chunk.byteLength; if (bytes > 524_288) { await reader.cancel(); throw new Error("Provider response too large"); } chunks.push(chunk); }
  const raw = Buffer.concat(chunks).toString("utf8");
  const receipt = await fetchOpenMeteoSingleRunReceipt(input, async () => ({ status: 200, text: async () => raw }), sourcePointId);
  const normalized = receipt.observations.flatMap((o, i) => o.components.filter((p) => p.rawFieldProvenance.directionNormalization).map((p) => ({ hourlyIndex: i, forecastAtUtc: o.forecastAtUtc, sourceSlot: p.sourceSlot, ...p.rawFieldProvenance.directionNormalization })));
  assert(normalized.length > 0, "Historical counterexample no longer present; needs review, not silent pass");
  // Exercise the actual transport receipt at the SQL boundary, in the disposable DB only.
  // It retains its real source ID and coordinates and receives NO study acceptance.
  const beforeLiveSendCounts = sendCounts();
  sql(`INSERT INTO public.beaches(id,lat,lon) VALUES(${q(sourcePointId)},${input.latitude},${input.longitude}) ON CONFLICT(id) DO NOTHING;`);
  const storedProvider = await storePrototypeSingleRunReceipts([{ sourcePointId, receipt }], client);
  const providerStored = value(`SELECT jsonb_build_object('normalizedComponents',count(*) FILTER (WHERE c.raw_field_provenance ? 'directionNormalization'),
    'badCanonicalDirections',count(*) FILTER (WHERE c.direction_deg<0 OR c.direction_deg>=360))
    FROM public.swell_watch_provider_run_revision_set_members m
    JOIN public.swell_watch_provider_run_revision_components c ON c.revision_id=m.revision_id
    WHERE m.revision_set_id=${q(storedProvider.revisionSetId)}::uuid;`);
  assert.equal(providerStored.normalizedComponents, normalized.length);
  assert.equal(providerStored.badCanonicalDirections, 0);
  assert.equal(sql(`SELECT count(*) FROM public.swell_watch_study_acceptances WHERE revision_set_id=${q(storedProvider.revisionSetId)}::uuid;`), "0");
  assert.deepEqual(sendCounts(), beforeLiveSendCounts);
  const report = { mode: "read_only_historical_provider_replay", observedAt, sourcePointId, requestedRunUtc: input.runUtc, httpStatus: response.status,
    rawResponseSha256: receipt.rawResponseSha256, semanticRevisionHash: receipt.revisionHash, parserOutcome: "accepted_unqualified_receipt", normalizationCount: normalized.length,
    normalized: normalized.slice(0, 5), disposableDatabaseStorage: providerStored, providerRequests: 1, productionDatabaseCalls: 0, enqueued: 0, qualification: "not_evaluated" };
  writeFileSync("/tmp/swell-normalization-artifact/provider-evidence.json", JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
