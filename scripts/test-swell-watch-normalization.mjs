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
const { recoverSwellWatchStudyRuns } = require("../lib/alerts/swell-watch/study.ts");
const { loadAttestedSwellWatchRun } = require("../lib/alerts/swell-watch/attested-run.ts");

const container = process.argv[2];
assert.match(container ?? "", /^swell-watch-study-test-\d+$/);
let database = "study_normalization";
const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = readdirSync(migrationsDirectory).filter((name) => /^\d{14}_normalize_swell_watch_provider_direction\.sql$/.test(name));
assert.equal(migrationNames.length, 1, "Exactly one tracked normalization migration required");
const migration = readFileSync(new URL(migrationNames[0], migrationsDirectory), "utf8");
const rollback = readFileSync(new URL("../docs/operations/swell-watch-direction-normalization-rollback.sql", import.meta.url), "utf8");
const config = JSON.parse(readFileSync(new URL("../docs/operations/swell-watch-no-send-producer-config-v2-proposed.json", import.meta.url), "utf8"));
const policy = config.policy;
assert.equal(policy.policy_values.staleness.maximum_forecast_age_hours, 12);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const j = (value) => `${q(JSON.stringify(value))}::jsonb`;
const command = ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"];
function sql(text) {
  const result = spawnSync("docker", [...command, "-d", database], { input: text, encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error((result.stderr || "isolated PostgreSQL command failed").split("\n")[0].slice(0, 200));
  return result.stdout.trim();
}
function value(text) { return JSON.parse(sql(text)); }
const completeRule = "complete_partitions.v1";
const partialRule = "primary_partition_with_retained_unavailable_secondary.v1";
const coverageMigration = readFileSync(new URL("../supabase/migrations/20260914050000_amend_swell_watch_study_partition_coverage.sql", import.meta.url), "utf8");
const coverageRollback = readFileSync(new URL("../docs/operations/swell-watch-study-partition-coverage-rollback.sql", import.meta.url), "utf8");
const modelPartitionCountMigration = readFileSync(new URL("../supabase/migrations/20260914190000_amend_swell_watch_study_model_partition_count.sql", import.meta.url), "utf8");
const modelPartitionCountRollback = readFileSync(new URL("../docs/operations/swell-watch-study-model-partition-count-rollback.sql", import.meta.url), "utf8");
const amendment = readFileSync(new URL("../docs/operations/swell-watch-study-amend-partition-coverage.sql", import.meta.url), "utf8");
const revokeAmendment = readFileSync(new URL("../docs/operations/swell-watch-study-revoke-partition-coverage.sql", import.meta.url), "utf8");
const functionHashes = {
  "guard_swell_watch_study_authority()": {
    "pre": "8480f4860778224e8ec6ba308e165ad0990fa0cab0b8aafc7d51cdd722e66614",
    "post": "0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8"
  },
  "read_swell_watch_study_health()": {
    "pre": "5c7183ca088c2ed6f41c8340584ecb8ff015f578368d892b25530816a0ec8c2e",
    "post": "b2789dfdb0637335290be5883ef57f19e2889cfa071d1ecbadd6ad9b72b30c01"
  },
  "record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)": {
    "pre": "ead27c82c4e7b7cb3d52ac05b57e7eeb7e5b550f05a07a66de19b725abd77223",
    "post": "e0e0e7f5d09ce8e3d2b668dd4c022ed429ff38d57473ae803ee093620c9f5521"
  }
};
const studyDefinitions = () => value(`SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc
  WHERE pronamespace='public'::regnamespace AND proname IN ('guard_swell_watch_study_authority','read_swell_watch_study_health','record_swell_watch_study_evaluation');`);
const studyPermissions = () => sql(`SELECT jsonb_object_agg(oid::regprocedure::text,proacl::text) FROM pg_proc
  WHERE pronamespace='public'::regnamespace AND proname IN ('guard_swell_watch_study_authority','read_swell_watch_study_health','record_swell_watch_study_evaluation');`);
const postDefinitions = studyDefinitions(); const studyAcl = studyPermissions();
for (const [name, hashes] of Object.entries(functionHashes)) assert.equal(createHash("sha256").update(postDefinitions[name]).digest("hex"), hashes.post);
sql(coverageMigration); sql(coverageMigration);
assert.deepEqual(studyDefinitions(), postDefinitions); assert.equal(studyPermissions(), studyAcl);
sql(coverageRollback); sql(coverageRollback);
const preDefinitions = studyDefinitions();
for (const [name, hashes] of Object.entries(functionHashes)) assert.equal(createHash("sha256").update(preDefinitions[name]).digest("hex"), hashes.pre);
assert.equal(studyPermissions(), studyAcl);
sql(coverageMigration); assert.deepEqual(studyDefinitions(), postDefinitions); assert.equal(studyPermissions(), studyAcl);
assert.throws(() => sql(`SET ROLE service_role; ${coverageMigration}`), /production owner required/);
assert.deepEqual(studyDefinitions(), postDefinitions);
const epochThreeStudyEvaluationHash = "e0e0e7f5d09ce8e3d2b668dd4c022ed429ff38d57473ae803ee093620c9f5521";
const modelPartitionCountStudyEvaluationHash = "d6ce951daa3bb58b6b5228732ce7fcd9263c0cb894863362258d923ad53dc817";
const studyEvaluationHash = () => sql("SELECT encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex');");
sql(modelPartitionCountMigration);
assert.equal(studyEvaluationHash(), modelPartitionCountStudyEvaluationHash);
sql(modelPartitionCountRollback);
assert.equal(studyEvaluationHash(), epochThreeStudyEvaluationHash);
sql(modelPartitionCountMigration);
assert.equal(studyEvaluationHash(), modelPartitionCountStudyEvaluationHash);

const tableRpcs = new Set(["record_swell_watch_provider_run_receipt", "complete_swell_watch_study_run", "record_swell_watch_shadow_demand"]);
const jsonRpcs = new Set(["read_swell_watch_run_scope", "read_swell_watch_attested_run", "record_swell_watch_study_evaluation", "read_swell_watch_study_pending_runs"]);
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
const cohort = [...config.cohort].sort((a, b) => a.sourcePointId.localeCompare(b.sourcePointId));
const inputs = cohort.map(({ sourcePointId }) => ({ sourcePointId, latitude: 32.8, longitude: -117.3,
  beach: { swell_window_center_deg: 180, swell_window_halfwidth_deg: 90, swell_access_factors: null, terrain_enabled: null, deepwater_decay_factor: null, shoaling_factors: null } }));
const scopes = inputs.map((input, index) => ({ ...input, regionKey: cohort[index].regionKey }));
const runUtc = new Date(Math.floor(Date.now() / 21_600_000) * 21_600_000).toISOString().slice(0, 16) + "Z";
const fields = ["swell_wave_height", "swell_wave_period", "swell_wave_direction", "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"];
function body(run = runUtc, normalized = false, unavailable = false) {
  const time = Array.from({ length: 168 }, (_, index) => new Date(Date.parse(run) + index * 3_600_000).toISOString().slice(0, 16));
  const hourly = { time }; const hourly_units = { time: "iso8601" };
  fields.forEach((field, i) => { hourly[field] = Array(168).fill([1.2, 12, 225, 0.6, 9, 170][i]); hourly_units[field] = ["m", "s", "°"][i % 3]; });
  if (normalized) for (const field of ["swell_wave_direction", "secondary_swell_wave_direction"]) {
    // Canonical north on native brackets, with coherent interpolated directions between them.
    const initial = hourly[field][141];
    hourly[field][144] = 360; hourly[field][147] = 360;
    for (const [a, b] of [[141, 144], [144, 147], [147, 150]]) {
      const left = hourly[field][a]; const right = hourly[field][b];
      const arc = ((right - left + 540) % 360) - 180;
      for (let i = a + 1; i < b; i++) hourly[field][i] = ((left + arc * (i - a) / (b - a)) % 360 + 360) % 360 || 360;
    }
    assert.equal(hourly[field][150], initial);
  }
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
  const evaluation = await evaluateSwellWatchShadow({ qualificationRule: "complete_partitions.v1", providerBatchId: completed.provider_batch_id, forecastDays: 7, now: new Date().toISOString(), policy, scopes }, client);
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

// Synthetic time-shifted retained Waikiki values + nine flat sources. The clock below
// belongs ONLY to a disposable database: exercise four issuances without relaxing 12h freshness.
sql("CREATE DATABASE study_native_sampling TEMPLATE postgres;");
database = "study_native_sampling";
const waikiki = JSON.parse(readFileSync(new URL("../__tests__/fixtures/swell-watch-retained-20260913/waikiki-20260913T1200Z.json", import.meta.url), "utf8"));
const hatteras = JSON.parse(readFileSync(new URL("../__tests__/fixtures/swell-watch-retained-20260913/hatteras-20260913T1200Z.json", import.meta.url), "utf8"));
const waikikiIndex = cohort.findIndex((scope) => scope.sourcePointId === waikiki.sourcePointId);
const hatterasIndex = cohort.findIndex((scope) => scope.sourcePointId === hatteras.sourcePointId);
assert(waikikiIndex >= 0 && hatterasIndex >= 0);
const nativeInputs = inputs.map((input, i) => ({ ...input, beach: i === waikikiIndex ? waikiki.beach : i === hatterasIndex ? hatteras.beach : input.beach }));
const nativeScopes = nativeInputs.map((input, index) => ({ ...input, regionKey: cohort[index].regionKey }));
const utcDay = runUtc.slice(0, 10);
const issuances = [0, 6, 12, 18].map((hour) => `${utcDay}T${String(hour).padStart(2, "0")}:00:00.000Z`);
const productionBodies = sql("SELECT jsonb_object_agg(oid::regprocedure::text,md5(prosrc)) FROM pg_proc WHERE pronamespace='public'::regnamespace;");
sql(`CREATE TABLE public.native_sampling_test_clock(instant timestamptz NOT NULL);
INSERT INTO public.native_sampling_test_clock VALUES(${q(issuances[0])}::timestamptz+interval '8 hours');
CREATE FUNCTION public.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog AS 'SELECT instant FROM public.native_sampling_test_clock';
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname<>'clock_timestamp' LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path=public,extensions,pg_catalog,pg_temp',f);
  END LOOP;
END $$;`);
const setClock = (issuance, hours = 8) => {
  const now = new Date(Date.parse(issuance) + hours * 3_600_000).toISOString();
  sql(`UPDATE public.native_sampling_test_clock SET instant=${q(now)};`);
  assert.equal(sql("SELECT public.clock_timestamp()=instant FROM public.native_sampling_test_clock;"), "t");
  return now;
};
try {
  sql(`INSERT INTO public.beaches(id,lat,lon,swell_window_center_deg,swell_window_halfwidth_deg,terrain_enabled,deepwater_decay_factor,swell_access_factors,shoaling_factors)
  SELECT (s->>'sourcePointId')::uuid,(s->>'latitude')::float8,(s->>'longitude')::float8,
    (s#>>'{beach,swell_window_center_deg}')::float8,(s#>>'{beach,swell_window_halfwidth_deg}')::float8,
    (s#>>'{beach,terrain_enabled}')::boolean,(s#>>'{beach,deepwater_decay_factor}')::float8,
    CASE WHEN jsonb_typeof(s#>'{beach,swell_access_factors}')='array' THEN ARRAY(SELECT jsonb_array_elements_text(s#>'{beach,swell_access_factors}'))::float8[] END,
    nullif(s#>'{beach,shoaling_factors}','null'::jsonb) FROM jsonb_array_elements(${j(nativeInputs)}) s;
  SELECT set_config('app.swell_watch_internal_write','on',false);
  INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'disabled','native_sampling_fixture');
  INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
  VALUES(1,'active',${q(policy.value_hash)},${j(policy.policy_values)},'synthetic time-shifted native sampling test',repeat('c',64),${q(issuances[0])}::timestamptz-interval '1 hour',${q(issuances[0])}::timestamptz+interval '3 days');
  INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
  SELECT 1,'active',${q(policy.value_hash)},${j(cohort)},public.swell_watch_study_scope_inputs(${j(cohort)}),
    encode(extensions.digest(jsonb_build_object('policyHash',${q(policy.value_hash)},'cohort',${j(cohort)},'scopeInputs',public.swell_watch_study_scope_inputs(${j(cohort)}),'forecastDays',7,'targetDays',30,'providerContractRef','synthetic time-shifted retained values','evidenceSha256',repeat('c',64))::text,'sha256'),'hex'),
    30,'synthetic time-shifted retained values',repeat('c',64),'synthetic native sampling test',${q(issuances[0])}::timestamptz-interval '1 hour',${q(issuances[0])}::timestamptz+interval '3 days';`);
  const nativeAuthority = sql("SELECT to_jsonb(a)::text FROM public.swell_watch_study_authorities a;");
  const nativeSafety = sendCounts();
  tableRpcs.add("ingest_swell_watch_cohort"); tableRpcs.add("read_swell_watch_attested_components");
  // Minimal PostgREST transport adapter. Every row/count still comes from real SQL.
  const nativeClient = { ...client, from(table) {
    const filters = []; let columns; let offset = 0; let limit = 1001;
    const history = table === "swell_watch_event_impacts";
    assert(history || ["profiles", "favorite_beaches", "alert_rules", "user_devices", "beaches"].includes(table));
    const builder = {
      select(selected) { columns = selected; return builder; },
      eq(key, item) {
        if (key === "swell_watch_regional_events.last_suppression.state") assert.equal(item, "suppressed");
        else filters.push(`${key === "swell_watch_regional_events.region_key" ? "e.region_key" : `a.${key}`}=${q(item)}`);
        return builder;
      },
      in(key, items) { filters.push(`a.${key} IN (${items.map(q).join(",")})`); return builder; },
      is(key, item) { assert.equal(item, null); filters.push(`a.${key} IS NULL`); return builder; },
      order() { return builder; },
      limit(count, options) { if (!options?.referencedTable) limit = count; return builder; },
      range(from, to) { offset = from; limit = to - from + 1; return builder; },
      then(resolve, reject) {
        try {
          const query = history ? `SELECT a.*, jsonb_build_object('region_key',e.region_key,
            'latest_state',(SELECT coalesce(jsonb_agg(t),'[]') FROM (SELECT state,version,created_at FROM public.swell_watch_event_state_transitions WHERE regional_event_id=e.id ORDER BY version DESC LIMIT 1) t),
            'last_suppression',(SELECT coalesce(jsonb_agg(t),'[]') FROM (SELECT state,version,created_at FROM public.swell_watch_event_state_transitions WHERE regional_event_id=e.id AND state='suppressed' ORDER BY created_at DESC LIMIT 1) t)) AS swell_watch_regional_events,
            jsonb_build_object('policy_hash',b.policy_hash,'swell_watch_observations',to_jsonb(o)) AS swell_watch_beach_impacts
            FROM public.swell_watch_event_impacts a JOIN public.swell_watch_regional_events e ON e.id=a.regional_event_id
            JOIN public.swell_watch_beach_impacts b ON b.id=a.beach_impact_id JOIN public.swell_watch_observations o ON o.id=b.observation_id`
            : `SELECT ${columns} FROM public.${table} a`;
          const rows = value(`SELECT coalesce(jsonb_agg(r),'[]') FROM (${query}${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""}
            ${history ? "ORDER BY a.evaluated_at,a.id" : ""}) r;`);
          return Promise.resolve({ data: rows.slice(offset, offset + limit), count: rows.length, error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return builder;
  } };
  async function nativeRun(issuance, missing = false, qualificationRule = completeRule, options = {}) {
    const now = setClock(issuance);
    const receipts = await Promise.all(cohort.map(async ({ sourcePointId }, i) => {
      const payload = body(issuance);
      if ((!options.flat && i === waikikiIndex) || (missing && i === hatterasIndex)) {
        const retained = missing && i === hatterasIndex ? hatteras : waikiki;
        for (const field of fields) payload.hourly[field] = [...retained.semanticPayload.hourly[field]];
        assert.deepEqual(fields.map((field) => payload.hourly[field]), fields.map((field) => retained.semanticPayload.hourly[field]), "Retained values unchanged; timestamps and synthetic location only are shifted");
      }
      if (options.syntheticGap && i === hatterasIndex) {
        fields.slice(3).forEach((field) => { for (let hour = 4; hour <= 14; hour++) payload.hourly[field][hour] = 0; });
      }
      const raw = JSON.stringify(payload);
      const receipt = await fetchOpenMeteoSingleRunReceipt({ latitude: 32.8, longitude: -117.3, runUtc: issuance.slice(0, 16) + "Z", forecastDays: 7 },
        async () => ({ status: 200, text: async () => raw }));
      return { sourcePointId, receipt };
    }));
    const stored = await storePrototypeSingleRunReceipts(receipts, nativeClient);
    if (issuance === issuances[0]) {
      setClock(issuance, 13);
      const stale = await nativeClient.rpc("complete_swell_watch_study_run", { p_revision_set_id: stored.revisionSetId,
        p_policy_hash: policy.value_hash, p_cohort: cohort, p_scope_inputs: nativeInputs });
      assert.match(stale.error?.message ?? "", /study run is stale/, "Clock injection still enforces unchanged 12h freshness");
      assert.equal(sql("SELECT count(*) FROM public.swell_watch_study_acceptances;"), "0");
      setClock(issuance);
    }
    const result = await nativeClient.rpc("complete_swell_watch_study_run", { p_revision_set_id: stored.revisionSetId,
      p_policy_hash: policy.value_hash, p_cohort: cohort, p_scope_inputs: nativeInputs });
    assert.equal(result.error, null); assert.equal(result.data.length, 1);
    const completed = result.data[0];
    if (options.acceptOnly) return { receipts, stored, completed };
    const evaluation = await evaluateSwellWatchShadow({ qualificationRule, providerBatchId: completed.provider_batch_id, forecastDays: 7, now, policy, scopes: nativeScopes }, nativeClient);
    const recordArgs = { p_provider_batch_id: completed.provider_batch_id, p_policy_hash: policy.value_hash, p_result: evaluation, p_scope_inputs: nativeInputs };
    if (options.beforeRecord) await options.beforeRecord(evaluation, recordArgs);
    const extraScopeKey = structuredClone(evaluation);
    extraScopeKey.scopeOutcomes[0].nativeFrames = 136;
    const rejected = await nativeClient.rpc("record_swell_watch_study_evaluation", { ...recordArgs, p_result: extraScopeKey });
    assert.match(rejected.error?.message ?? "", /invalid study scope outcomes/, "Scope outcomes still reject extra keys");
    const recorded = await nativeClient.rpc("record_swell_watch_study_evaluation", recordArgs);
    assert.equal(recorded.error, null); assert.equal(recorded.data.recorded, true);
    assert.equal(evaluation.derivation.version, "swell-watch-horizon-derivation.v2");
    assert.equal(evaluation.derivation.scopes.length, missing ? 9 : 10);
    assert(evaluation.derivation.scopes.every((scope) => scope.nativeFrames === 136 && scope.interpolatedFrames === 32));
    const persisted = value(`SELECT result FROM public.swell_watch_study_evaluations WHERE provider_batch_id=${q(completed.provider_batch_id)};`);
    assert.deepEqual(persisted, evaluation, "SQL accepts and retains top-level derivation metadata");
    assert(evaluation.scopeOutcomes.every((scope) => Object.keys(scope).sort().join(",") === "reason,sourcePointId,status"));
    return { receipts, stored, completed, evaluation, recordArgs };
  }
  sql("CREATE DATABASE study_partition_coverage TEMPLATE study_native_sampling;");
  const nativeFirst = await nativeRun(issuances[0]);
  assert.equal(nativeFirst.evaluation.status, "evaluated"); assert.equal(nativeFirst.evaluation.candidateCount, 1);
  for (const table of ["swell_watch_beach_impacts", "swell_watch_event_impacts", "swell_watch_regional_events", "swell_watch_shadow_demand_runs"]) {
    assert.equal(sql(`SELECT count(*) FROM public.${table};`), "1", `${table}: first native candidate persisted`);
  }
  const persistedScopes = value(`SELECT result->'derivation'->'scopes' FROM public.swell_watch_study_evaluations
    WHERE provider_batch_id=${q(nativeFirst.completed.provider_batch_id)};`);
  const shifted = (at) => new Date(Date.parse(at) + Date.parse(issuances[0]) - Date.parse(waikiki.issuedAt)).toISOString();
  assert.deepEqual(persistedScopes.find((scope) => scope.sourcePointId === cohort[waikikiIndex].sourcePointId), {
    sourcePointId: cohort[waikikiIndex].sourcePointId, nativeFrames: 136, interpolatedFrames: 32, partitionCoverage: { s1: { observed: 168, unavailable: 0, absent: 0 }, s2: { observed: 168, unavailable: 0, absent: 0, unavailableNativeFrames: [], absentNativeFrames: [] } },
    events: [{ sourceSlot: "s1", arrivalAt: shifted("2026-09-18T18:00:00.000Z"),
      arrivalWindow: { earliestAt: shifted("2026-09-18T15:00:00.000Z"), latestAt: shifted("2026-09-18T18:00:00.000Z") },
      peakAt: shifted("2026-09-18T18:00:00.000Z"),
      peakWindow: { earliestAt: shifted("2026-09-18T18:00:00.000Z"), latestAt: shifted("2026-09-18T21:00:00.000Z") },
      closureWindow: { earliestAt: shifted("2026-09-20T00:00:00.000Z"), latestAt: shifted("2026-09-20T03:00:00.000Z") },
      regionalEventId: sql("SELECT id FROM public.swell_watch_regional_events;") }],
  });
  assert.equal(value("SELECT public.read_swell_watch_study_health();").evaluatedRuns, 1);
  assert.equal(value("SELECT public.read_swell_watch_study_health();").qualifyingDays, 0);
  for (const issuance of issuances.slice(1)) {
    const next = await nativeRun(issuance);
    assert.equal(next.evaluation.status, "evaluated"); assert.equal(next.evaluation.candidateCount, 1);
  }
  const qualified = value("SELECT public.read_swell_watch_study_health();");
  assert.equal(qualified.evaluatedRuns, 4); assert.equal(qualified.qualifyingDays, 1); assert.deepEqual(qualified.qualifyingDates, [utcDay]);
  assert.deepEqual(await storePrototypeSingleRunReceipts(nativeFirst.receipts, nativeClient), nativeFirst.stored);
  const retry = await nativeClient.rpc("complete_swell_watch_study_run", { p_revision_set_id: nativeFirst.stored.revisionSetId,
    p_policy_hash: policy.value_hash, p_cohort: cohort, p_scope_inputs: nativeInputs });
  assert.equal(retry.error, null); assert.equal(retry.data[0].already_evaluated, true);
  const retryRecord = await nativeClient.rpc("record_swell_watch_study_evaluation", nativeFirst.recordArgs);
  assert.equal(retryRecord.error, null); assert.equal(retryRecord.data.recorded, true);
  assert.deepEqual(value("SELECT public.read_swell_watch_study_health();"), qualified);
  const fifth = await nativeRun(new Date(Date.parse(issuances[0]) + 24 * 3_600_000).toISOString(), true);
  assert.equal(fifth.evaluation.status, "suppressed"); assert.equal(fifth.evaluation.reason, "incomplete_partition");
  const afterSuppressed = value("SELECT public.read_swell_watch_study_health();");
  assert.equal(afterSuppressed.evaluatedRuns, 4); assert.equal(afterSuppressed.qualifyingDays, 1); assert.deepEqual(afterSuppressed.qualifyingDates, [utcDay]);
  assert.equal(afterSuppressed.suppressedAttempts, 1);
  assert.equal(sql("SELECT count(*) FROM public.swell_watch_event_impacts;"), "4");
  assert.equal(sql("SELECT count(*) FROM public.swell_watch_shadow_demand_runs;"), "4");
  assert.deepEqual(sendCounts(), nativeSafety); assert.equal(sql("SELECT to_jsonb(a)::text FROM public.swell_watch_study_authorities a;"), nativeAuthority);
  assert.deepEqual(value("SELECT policy_values FROM public.swell_watch_evaluation_policies;"), policy.policy_values);
  console.log(JSON.stringify({ mode: "synthetic_time_shifted_retained_native_sampling", retainedIssuedAt: waikiki.issuedAt,
    syntheticIssuances: issuances, evaluationClock: "disposable database only: issuance + 8h", flatSources: 9, retainedValueSources: 1,
    firstCandidateCount: 1, evaluatedRuns: 4, qualifyingDays: 1, qualifyingDates: [utcDay], equivalentRetryAddsDay: false,
    suppressedFifthAddsDay: false, policyFreshnessHours: 12, derivation: nativeFirst.evaluation.derivation, sends: nativeSafety }, null, 2));
  database = "study_partition_coverage";
  // New fixture epoch 2 has the reviewed production fields, with fixture scope inputs/hash.
  const contract = "automated-study.v1: pinned Open-Meteo Single Runs requests; validated raw and semantic receipts; response does not echo issuance; no-send study only";
  const epoch2Evidence = "d2733c02f8903601e140a51a7a7e0d5a89c3f6d54b63988960c35420bb2d216b";
  const expiry = "2026-10-25T02:45:47.591003Z";
  sql(`INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
    SELECT 2,'active',policy_hash,policy_values,reviewer,evidence_hash,not_before,${q(expiry)} FROM public.swell_watch_evaluation_policies WHERE epoch=1;`);
  assert.throws(() => sql(amendment), /exact reviewed epoch 2 study authority required/);
  assert.equal(sql("SELECT max(epoch) FROM public.swell_watch_study_authorities;"), "1");
  sql(`INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
    SELECT 2,'active',policy_hash,cohort,scope_inputs,
      encode(extensions.digest(jsonb_build_object('policyHash',policy_hash,'cohort',cohort,'scopeInputs',scope_inputs,
        'forecastDays',7,'targetDays',target_days,'providerContractRef',${q(contract)},'evidenceSha256',${q(epoch2Evidence)})::text,'sha256'),'hex'),
      target_days,${q(contract)},${q(epoch2Evidence)},'automated-study.v1 under Steven Chandler standing authorization',not_before,${q(expiry)}
    FROM public.swell_watch_study_authorities WHERE epoch=1;`);
  assert.equal(value("SELECT public.read_swell_watch_study_health();").qualificationRule, completeRule);
  const authorityRows = () => value("SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a;");
  const oldEpochs = authorityRows();
  const policyRows = value("SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch) FROM public.swell_watch_evaluation_policies p;");
  assert.throws(() => sql(amendment), /exact reviewed epoch 2 study authority required/);
  assert.deepEqual(authorityRows(), oldEpochs);
  const epoch2Hash = oldEpochs[1].config_hash;
  // Mirror the exact production INSERT/guards using ONLY the fixture's independently computed hash.
  // The production SQL file retains its literal reviewed pin and has just refused this fixture.
  const fixtureAuthorityScript = (script) => {
    const pin = "7390521c13f45cb5a1ce9a0cbe7a53d092a2e05ff187e5f2b773b75df74b3d7e";
    assert.equal(script.split(pin).length, 2);
    return script.replace(pin, epoch2Hash);
  };
  const fixtureAmendment = fixtureAuthorityScript(amendment);
  const fixtureRevocation = fixtureAuthorityScript(revokeAmendment);
  // Keep a real epoch-2 acceptance without a result, simulating recovery queued before amendment.
  const pendingIssuance = new Date(Date.parse(issuances[0]) + 30 * 3_600_000).toISOString();
  const pendingRun = await nativeRun(pendingIssuance, false, completeRule, { acceptOnly: true, flat: true });
  const queued = await nativeClient.rpc("read_swell_watch_study_pending_runs", { p_policy_hash: policy.value_hash });
  assert.equal(queued.error, null);
  assert(queued.data.some((run) => run.revision_set_id === pendingRun.stored.revisionSetId));
  const acceptedBefore = value(`SELECT to_jsonb(a) FROM public.swell_watch_study_acceptances a WHERE revision_set_id=${q(pendingRun.stored.revisionSetId)};`);
  // Same complete-rule authority must reject a forged partial-coverage success before writing.
  const writes = () => sql("SELECT count(*) FROM public.swell_watch_study_evaluations;");
  const expectRejected = async (recordArgs, forged, pattern) => {
    const before = writes();
    const rejected = await nativeClient.rpc("record_swell_watch_study_evaluation", { ...recordArgs, p_result: forged });
    assert.match(rejected.error?.message ?? "", pattern); assert.equal(writes(), before);
  };
  const pendingEvaluation = await evaluateSwellWatchShadow({ qualificationRule: completeRule,
    providerBatchId: pendingRun.completed.provider_batch_id, forecastDays: 7, now: setClock(pendingIssuance), policy, scopes: nativeScopes }, nativeClient);
  const pendingArgs = { p_provider_batch_id: pendingRun.completed.provider_batch_id, p_policy_hash: policy.value_hash, p_result: pendingEvaluation, p_scope_inputs: nativeInputs };
  const partialClaim = structuredClone(pendingEvaluation);
  Object.assign(partialClaim.derivation.scopes[0].partitionCoverage.s2, { observed: 167, unavailable: 1 });
  await expectRejected(pendingArgs, partialClaim, /study result claims partial partition coverage under complete-partition rule/);
  sql(fixtureAmendment);
  const amendedAuthority = authorityRows();
  sql(fixtureAmendment); assert.deepEqual(authorityRows(), amendedAuthority, "Exact fixture amendment retry is a no-op");
  assert.deepEqual(amendedAuthority.slice(0, 2), oldEpochs);
  assert.equal(amendedAuthority[2].qualification_rule, partialRule);
  assert.notEqual(amendedAuthority[2].config_hash, epoch2Hash);
  assert.equal(sql(`SELECT a.config_hash=encode(extensions.digest(jsonb_build_object('policyHash',a.policy_hash,'cohort',a.cohort,
    'scopeInputs',a.scope_inputs,'forecastDays',7,'targetDays',a.target_days,'providerContractRef',a.provider_contract_ref,
    'evidenceSha256',a.evidence_sha256,'qualificationRule',a.qualification_rule)::text,'sha256'),'hex')
    FROM public.swell_watch_study_authorities a WHERE epoch=3;`), "t");
  assert.throws(() => sql(`INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
    SELECT 4,'active',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,
      'complete_partitions.v1' FROM public.swell_watch_study_authorities WHERE epoch=3;`), /study config hash or cohort ordering mismatch/);
  assert.deepEqual(authorityRows(), amendedAuthority);
  const completeAcrossEpoch = await nativeClient.rpc("complete_swell_watch_study_run", {
    p_revision_set_id: pendingRun.stored.revisionSetId, p_policy_hash: policy.value_hash, p_cohort: cohort, p_scope_inputs: nativeInputs });
  assert.match(completeAcrossEpoch.error?.message ?? "", /study acceptance belongs to a different authority epoch/);
  const recovery = await recoverSwellWatchStudyRuns({ policy, cohort }, { ...nativeClient, rpc: async (name, args) =>
    name === "read_swell_watch_study_pending_runs" ? queued : nativeClient.rpc(name, args) }, partialRule);
  assert.deepEqual(recovery, { processed: 0, failed: 1 }, "Queued pre-amendment recovery fails without moving acceptance");
  assert.deepEqual(value(`SELECT to_jsonb(a) FROM public.swell_watch_study_acceptances a WHERE revision_set_id=${q(pendingRun.stored.revisionSetId)};`), acceptedBefore);
  const currentQueue = await nativeClient.rpc("read_swell_watch_study_pending_runs", { p_policy_hash: policy.value_hash });
  assert.equal(currentQueue.error, null); assert(!currentQueue.data.some((run) => run.revision_set_id === pendingRun.stored.revisionSetId));
  const retainedIssuance = new Date(Date.parse(issuances[0]) + 42 * 3_600_000).toISOString();
  const retainedAmended = await nativeRun(retainedIssuance, true, partialRule);
  assert.equal(retainedAmended.evaluation.status, "suppressed");
  assert.equal(retainedAmended.evaluation.reason, "arrival_window_crosses_actionability");
  assert.deepEqual(retainedAmended.evaluation.scopeOutcomes[hatterasIndex], { sourcePointId: cohort[hatterasIndex].sourcePointId, status: "suppressed", reason: "arrival_window_crosses_actionability" });
  assert.equal(retainedAmended.evaluation.derivation.qualificationRule, partialRule);
  assert.equal(sql(`SELECT count(*) FROM public.swell_watch_provider_run_completed_batches b
    JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
    JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id
    JOIN public.swell_watch_provider_run_revision_components c ON c.revision_id=m.revision_id
    WHERE b.id=${q(retainedAmended.completed.provider_batch_id)} AND s.source_point_id=${q(cohort[hatterasIndex].sourcePointId)}
      AND c.source_slot='s2' AND c.unavailable_reason='provider_zero_tuple';`), "48");
  const qualifiedIssuances = issuances.map((issuance) => new Date(Date.parse(issuance) + 48 * 3_600_000).toISOString());
  for (const [index, issuance] of qualifiedIssuances.entries()) {
    const result = await nativeRun(issuance, false, partialRule, { syntheticGap: true, beforeRecord: async (evaluation, args) => {
      if (index) return;
      const wrongRule = structuredClone(evaluation); wrongRule.derivation.qualificationRule = completeRule;
      await expectRejected(args, wrongRule, /study qualification rule differs from authority/);
      const wrongCount = structuredClone(evaluation); Object.assign(wrongCount.derivation.scopes[hatterasIndex].partitionCoverage.s2, { observed: 158, unavailable: 10 });
      await expectRejected(args, wrongCount, /study partition coverage differs from retained components/);
      for (const malformed of [null, [], "invalid", {}, { qualificationRule: partialRule, scopes: [] }]) {
        await expectRejected(args, { ...evaluation, derivation: malformed }, /study (derivation|required|qualification)|invalid study derivation|evaluated study derivation/);
      }
      const absent = structuredClone(evaluation); delete absent.derivation;
      await expectRejected(args, absent, /evaluated study derivation required/);
      for (const unavailable of [null, "11", -1, 0.5, 169]) {
        const invalid = structuredClone(evaluation); invalid.derivation.scopes[hatterasIndex].partitionCoverage.s2.unavailable = unavailable;
        await expectRejected(args, invalid, /invalid study partition coverage/);
      }
    } });
    assert.equal(result.evaluation.status, "evaluated");
    assert.equal(result.evaluation.candidateCount, 1, "Retained Waikiki's completely observed event persists");
    assert.deepEqual(result.evaluation.derivation.scopes[hatterasIndex].partitionCoverage, {
      s1: { observed: 168, unavailable: 0, absent: 0 }, s2: { observed: 157, unavailable: 11, absent: 0, unavailableNativeFrames: Array.from({ length: 11 }, (_, i) => i + 4), absentNativeFrames: [] },
    });
    assert.equal(result.evaluation.derivation.qualificationRule, partialRule);
    assert.equal(value("SELECT public.read_swell_watch_study_health();").qualifyingDays, index === 3 ? 1 : 0);
  }
  const partialHealth = value("SELECT public.read_swell_watch_study_health();");
  assert.equal(partialHealth.qualificationRule, partialRule); assert.equal(partialHealth.authorityEpoch, 3);
  assert.equal(partialHealth.evaluatedRuns, 4); assert.equal(partialHealth.suppressedAttempts, 1);
  assert.deepEqual(partialHealth.qualifyingDates, [qualifiedIssuances[0].slice(0, 10)]);
  assert.deepEqual(authorityRows(), amendedAuthority);
  assert.deepEqual(value("SELECT jsonb_agg(to_jsonb(p) ORDER BY epoch) FROM public.swell_watch_evaluation_policies p;"), policyRows);
  assert.deepEqual(sendCounts(), nativeSafety);
  for (const field of ["not_before", "expires_at"]) {
    assert.throws(() => sql(`BEGIN;
      INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
        provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
      SELECT 4,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,
        not_before+interval '${field === "not_before" ? 1 : 0} second',expires_at+interval '${field === "expires_at" ? 1 : 0} second',qualification_rule
        FROM public.swell_watch_study_authorities WHERE epoch=3;
      ${fixtureRevocation.replace("BEGIN;", "")}`), /unexpected study authority; exact amendment revocation retry only/);
    assert.deepEqual(authorityRows(), amendedAuthority);
  }
  sql(fixtureRevocation); const revokedAuthority = authorityRows(); sql(fixtureRevocation);
  assert.deepEqual(authorityRows(), revokedAuthority); assert.equal(revokedAuthority[3].state, "revoked");
  assert.equal(revokedAuthority[3].qualification_rule, partialRule);
  assert.equal(value("SELECT public.read_swell_watch_study_health();").status, "blocked");
  assert.throws(() => sql(fixtureAmendment), /unexpected study authority; exact amendment retry only/);
  sql(`INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,
    provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule)
    SELECT 5,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,qualification_rule
    FROM public.swell_watch_study_authorities WHERE epoch=4;`);
  assert.throws(() => sql(fixtureRevocation), /unexpected study authority; exact amendment revocation retry only/);
  assert.deepEqual(authorityRows().slice(0, 2), oldEpochs); assert.deepEqual(sendCounts(), nativeSafety);
  console.log(JSON.stringify({ mode: "partition_coverage_epoch_3", retainedHatteras: retainedAmended.evaluation.reason,
    retainedUnavailableSecondaryHours: 48, syntheticGapUnavailableSecondaryHours: 11,
    evaluatedRuns: partialHealth.evaluatedRuns, qualifyingDays: partialHealth.qualifyingDays,
    staleEpochRecovery: recovery, healthRule: partialHealth.qualificationRule, sends: nativeSafety }, null, 2));
} finally {
  assert.equal(sql("SELECT jsonb_object_agg(oid::regprocedure::text,md5(prosrc)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname<>'clock_timestamp';"), productionBodies, "Production SQL bodies unchanged by disposable clock injection");
  database = "study_normalization";
}
