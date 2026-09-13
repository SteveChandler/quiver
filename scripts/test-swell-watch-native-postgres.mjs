// Synthetic boundary test only. All data/RPC responses come from actual local
// PostgREST/PostgreSQL. Only public provider transport is explicitly simulated.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PostgrestClient } = require("@supabase/postgrest-js");
const { acquireSwellWatchCohort } = require("../lib/alerts/swell-watch/acquisition.ts");
const { completeSwellWatchStudyRun, recoverSwellWatchStudyRuns } = require("../lib/alerts/swell-watch/study.ts");
const { deriveSwellWatchHorizon } = require("../lib/alerts/swell-watch/horizon-derivation.ts");
const db = process.argv[2];
assert.match(db ?? "", /^swell-watch-native-test-\d+-db$/);
const url = new URL(process.env.SWELL_NATIVE_TEST_URL ?? "");
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.protocol, "http:");
const secret = process.env.SWELL_NATIVE_TEST_SECRET;
assert.match(secret ?? "", /^[a-f0-9]{64}$/);
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const signing = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", exp: Math.floor(Date.now()/1000)+900 })}`;
const token = `${signing}.${createHmac("sha256", secret).update(signing).digest("base64url")}`;
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
function sql(text) {
  const r = spawnSync("docker", ["exec", "-i", db, "psql", "-X", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { input: text, encoding: "utf8", timeout: 30_000, maxBuffer: 8*1024*1024 });
  if (r.status !== 0) throw new Error((r.stderr || "isolated database failed").split("\n")[0]);
  return r.stdout.trim();
}
const value = (text) => JSON.parse(sql(text));
const policy = JSON.parse(readFileSync(new URL("../docs/operations/swell-watch-no-send-producer-config-v2-proposed.json", import.meta.url))).policy;
assert.equal(policy.policy_values.staleness.maximum_forecast_age_hours, 12);
const cohort = Array.from({ length: 10 }, (_, i) => ({ sourcePointId: `10000000-0000-4000-8000-${String(i).padStart(12,"0")}`, regionKey: "synthetic-native" }));
const config = { cohort, policy };
// Choose an aligned issuance 3-9h old, leaving robust freshness and onset margins.
const now = Date.now(); const boundary = Math.floor(now/21_600_000)*21_600_000;
const issued = now-boundary < 10_800_000 ? boundary-21_600_000 : boundary;
const runUtc = new Date(issued).toISOString().slice(0,16)+"Z";
const at = (h) => new Date(issued+h*3_600_000).toISOString().slice(0,16);
let missing = false; let pointRequest = 0; let simulatedProviderRequests = 0; let databaseRequests = 0;
const realFetch = globalThis.fetch;
const fields = ["swell_wave_height","swell_wave_period","swell_wave_direction","secondary_swell_wave_height","secondary_swell_wave_period","secondary_swell_wave_direction"];
function providerBody(unavailable = false) {
  const hourly = { time: Array.from({length:168},(_,i)=>at(i)) };
  const units = { time: "iso8601" };
  for (const [i, field] of fields.entries()) { hourly[field]=Array(168); units[field]=["m","s","°"][i%3]; }
  for(let h=0;h<168;h++) {
    const long=[h>=123 && h<=149?1.4:0.3,13,200]; const short=[0.2,6,130];
    let parts=h>=141?[short,long]:[long,short];
    if(h===139) parts=[[1,10.65,177],[0.6,8.35,153]];
    if(h===140) parts=[[0.6,8.35,153],[1,10.65,177]];
    fields.forEach((field,i)=>{hourly[field][h]=parts[Math.floor(i/3)][i%3]});
  }
  if(unavailable) fields.slice(3).forEach((field)=>{hourly[field][4]=0});
  return { latitude:32.8,longitude:-117.3,generationtime_ms:1,utc_offset_seconds:0,timezone:"GMT",timezone_abbreviation:"GMT",elevation:0,hourly_units:units,hourly };
}
const response = (body) => new Response(JSON.stringify(body),{status:200,headers:{"content-type":"application/json"}});
globalThis.fetch = async (resource, init) => {
  const target = new URL(typeof resource === "string" ? resource : resource instanceof URL ? resource.href : resource.url);
  if(target.origin===url.origin) { databaseRequests++; return realFetch(resource,init); }
  if(target.href==="https://marine-api.open-meteo.com/data/ncep_gfswave016/static/meta.json") {
    simulatedProviderRequests++; return response({last_run_initialisation_time:issued/1000,last_run_modification_time:issued/1000+60,
      last_run_availability_time:issued/1000+120,update_interval_seconds:21600,temporal_resolution_seconds:3600});
  }
  if(target.origin==="https://single-runs-api.open-meteo.com" && target.pathname==="/v1/forecast") {
    assert.equal(target.searchParams.get("run"),runUtc.slice(0,-1));
    simulatedProviderRequests++; return response(providerBody(missing && pointRequest++ % 10 === 0));
  }
  throw new Error("Unexpected network destination in isolated native integration");
};
const client = new PostgrestClient(url.href.replace(/\/$/,""), {headers:{Authorization:`Bearer ${token}`},fetch:globalThis.fetch});
sql(`INSERT INTO public.beaches(id,lat,lon,swell_window_center_deg,swell_window_halfwidth_deg) VALUES ${cohort.map(s=>`(${q(s.sourcePointId)},32.8,-117.3,200,65)`).join(",")};
SELECT set_config('app.swell_watch_internal_write','on',false);
INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'disabled','synthetic_native');
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'active',${q(policy.value_hash)},${j(policy.policy_values)},'synthetic native integration',repeat('b',64),${q(runUtc)}::timestamptz-interval '1 hour',clock_timestamp()+interval '1 day');
INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at)
VALUES(1,'active',${q(policy.value_hash)},${j(cohort)},public.swell_watch_study_scope_inputs(${j(cohort)}),
encode(extensions.digest(jsonb_build_object('policyHash',${q(policy.value_hash)},'cohort',${j(cohort)},'scopeInputs',public.swell_watch_study_scope_inputs(${j(cohort)}),'forecastDays',7,'targetDays',30,'providerContractRef','synthetic native contract only','evidenceSha256',repeat('b',64))::text,'sha256'),'hex'),
30,'synthetic native contract only',repeat('b',64),'synthetic native integration',${q(runUtc)}::timestamptz-interval '1 hour',clock_timestamp()+interval '1 day');`);
const body = providerBody();
const series = body.hourly.time.map((t,i)=>[0,1].map(slot=>({provider:"open_meteo",evaluationId:"genuine_completed:fixture",completeness:"complete",sourceSlot:slot?"s2":"s1",forecastAt:t+"Z",
 heightM:body.hourly[fields[slot*3]][i],periodS:body.hourly[fields[slot*3+1]][i],directionDeg:body.hourly[fields[slot*3+2]][i]})));
assert.throws(()=>deriveSwellWatchHorizon({series,now:new Date().toISOString(),policy,beach:{swell_window_center_deg:200,swell_window_halfwidth_deg:65}}),/unclosed_episode/);
const stages=[];
const stored = await acquireSwellWatchCohort(cohort,client,(stage)=>stages.push(stage));
assert(!("skipped" in stored));
assert(stages.includes("collection_lease")&&stages.includes("receipt_storage"));
assert.equal(sql("SELECT count(*) FROM public.swell_watch_collection_lease;"),"0");
const result=await completeSwellWatchStudyRun(stored.revisionSetId,config,client);
assert.equal(result.status,"evaluated"); assert.equal(result.candidateCount,10);
assert.equal(result.scopeOutcomes.length,10); assert(result.scopeOutcomes.every(s=>s.status==="derived"));
assert.equal(result.nativeDerivation.length,10);
for(const d of result.nativeDerivation) { assert.equal(d.eventWindows.length,1); assert.deepEqual(d.eventWindows[0],[120,123,123,147,150,"s1"]); assert.equal(d.sampling.trackingFrames,136); }
const persisted=value("SELECT result FROM public.swell_watch_study_evaluations WHERE status='evaluated';");
assert.deepEqual(persisted,result);
const counts=value("SELECT jsonb_build_object('observations',(SELECT count(*) FROM public.swell_watch_observations),'impacts',(SELECT count(*) FROM public.swell_watch_event_impacts),'demand',(SELECT count(*) FROM public.swell_watch_shadow_demand_runs),'acceptances',(SELECT count(*) FROM public.swell_watch_study_acceptances),'outcomes',(SELECT count(*) FROM public.swell_watch_study_evaluations));");
assert.equal(counts.observations,10); assert.equal(counts.impacts,10); assert.equal(counts.demand,1);
assert.equal(counts.acceptances,1); assert.equal(counts.outcomes,1);
assert.equal(sql("SELECT count(*) FROM public.swell_watch_event_impacts WHERE peak_at<>arrival_at;"),"0");
const retry=await completeSwellWatchStudyRun(stored.revisionSetId,config,client);
assert.equal(retry.reason,"already_evaluated");
assert.equal(sql("SELECT count(*) FROM public.swell_watch_study_evaluations;"),"1");
// An unavailable component remains a real failed evaluation, even after a successful
// synthetic predecessor. No manual result or health writes are made by this test.
missing=true;
const bad=await acquireSwellWatchCohort(cohort,client);
const suppressed=await completeSwellWatchStudyRun(bad.revisionSetId,config,client);
assert.equal(suppressed.status,"suppressed"); assert.equal(suppressed.reason,"incomplete_partition");
assert.equal(suppressed.scopeOutcomes.filter(s=>s.status==="suppressed").length,1);
assert.equal(suppressed.scopeOutcomes.filter(s=>s.status==="derived").length,9);
assert.equal(suppressed.nativeDerivation.length,9);
assert.equal(sql("SELECT count(*) FROM public.swell_watch_observations;"),"10");
assert.deepEqual(value("SELECT result FROM public.swell_watch_study_evaluations WHERE status='suppressed';"),suppressed);
assert.equal(suppressed.candidateCount,null);
assert.deepEqual(await recoverSwellWatchStudyRuns(config,client),{processed:1,failed:0});
assert.equal(sql("SELECT count(*) FROM public.swell_watch_study_evaluations;"),"2");
const safety=value("SELECT jsonb_build_object('notifications',(SELECT count(*) FROM public.notification_events),'authorities',(SELECT count(*) FROM public.swell_watch_production_approval_authority),'bindings',(SELECT count(*) FROM public.swell_watch_notification_event_bindings),'badRawHashes',(SELECT count(*) FROM public.swell_watch_provider_run_revision_raw_responses WHERE raw_response_sha256<>encode(extensions.digest(raw_response,'sha256'),'hex')),'qualifyingDays',public.read_swell_watch_study_health()->'qualifyingDays');");
assert.deepEqual(safety,{notifications:0,authorities:0,bindings:0,badRawHashes:0,qualifyingDays:0});
console.log(JSON.stringify({mode:"synthetic_real_postgrest_native_integration",actualDatabaseRequests:databaseRequests,simulatedProviderRequests,
  acquisitionStages:stages,candidateCount:result.candidateCount,scopeCount:result.scopeOutcomes.length,persisted:counts,
  retainedEventWindow:result.nativeDerivation[0].eventWindows[0],timingEvidenceSurvivedRoundTrip:true,unchangedMissingness:suppressed.reason,
  realStudyOrchestration:true,realLease:true,productionDatabaseCalls:0,externalProviderRequests:0,safety},null,2));
