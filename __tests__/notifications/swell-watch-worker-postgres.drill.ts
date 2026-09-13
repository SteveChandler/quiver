/** @jest-environment node */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile, execFileSync, spawn } from "node:child_process";
import { PostgrestClient } from "@supabase/postgrest-js";
import { fetch as httpFetch } from "undici";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";
import { processPendingEvents } from "@/lib/notifications/worker";
import fixture from "@/__tests__/fixtures/swell-watch-v2.json";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { acquireProviderRunReceipts, completeAttestedProviderRun, loadAttestedProviderRunScope, loadSwellWatchAcquisitionScope } from "@/lib/alerts/swell-watch/provider-run-store";
import { ingestAttestedSwellWatchCohort, ingestAttestedSwellWatchImpact, ingestAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import { calculateSwellWatchPolicyHash, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { enqueueAttestedSwellWatchCohort, enqueueSwellWatchCandidates, loadSwellWatchDeliveryHealth } from "@/lib/alerts/swell-watch/enqueue-candidates";
import { loadMatchedSwellWatchHistory, loadSwellWatchHistory } from "@/lib/alerts/swell-watch/persisted-history";
import { createSwellWatchObservability } from "@/lib/alerts/swell-watch/observability";
import { matchRegionalSwellEvent } from "@/lib/alerts/swell-watch/event-matcher";
import { deriveSwellWatchFixture } from "@/scripts/derive-swell-watch-fixture";
import { deriveAttestedSwellWatchRun, loadAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";
import { POST as evaluateShadowCallback } from "@/app/api/cron/swell-watch-evaluate/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

jest.mock("@/lib/services/firebase-admin", () => ({ getFirebaseAdminMessaging: () => { throw new Error("Real Firebase is prohibited in this drill"); } }));
jest.mock("@/lib/posthog-server", () => ({ capturePostHogEvent: jest.fn() }));
jest.mock("@/lib/cron/observability", () => ({ withObservedCron: (_path: string, handler: unknown) => handler }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));

if (typeof Response.json !== "function") {
  Response.json = (data: unknown, init?: ResponseInit): Response => new Response(JSON.stringify(data), init);
}

describe("local PostgreSQL Swell Watch worker drill", () => {
  it("serializes collectors, fences expired receipt writes and rejects stale release tokens", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Isolated database required");
    const args = ["exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"];
    const query = (sql: string): string => execFileSync("docker", [...args, "-c", sql], { encoding: "utf8", timeout: 10_000, stdio: "pipe" }).trim();
    const owners = [randomUUID(), randomUUID()];
    const results = await Promise.all(owners.map((owner) => new Promise<string>((resolve, reject) => {
      execFile("docker", [...args, "-c", `SET ROLE service_role; SELECT public.try_acquire_swell_watch_collection_lease('${owner}')`],
        { encoding: "utf8", timeout: 10_000 }, (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
    })));
    expect([...results].sort()).toEqual(["f", "t"]);
    const winner = owners[results.indexOf("t")];
    const loser = owners[results.indexOf("f")];
    expect(query(`SET ROLE service_role; SELECT public.release_swell_watch_collection_lease('${loser}')`)).toBe("f");
    expect(query(`SELECT owner_token FROM public.swell_watch_collection_lease`)).toBe(winner);
    for (const role of ["anon", "authenticated"]) {
      expect(() => query(`SET ROLE ${role}; SELECT public.try_acquire_swell_watch_collection_lease('${loser}')`)).toThrow("permission denied");
    }
    expect(() => query("SET ROLE service_role; UPDATE public.swell_watch_collection_lease SET expires_at=now()"))
      .toThrow("permission denied");
    const beach = randomUUID();
    query(`INSERT INTO public.beaches(id,name,lat,lon) VALUES('${beach}','Lease fixture',21,-157)`);
    const scopes = `public.fixture_provider_run_scopes(p_run=>'2026-08-01T00:00Z',p_height=>1,p_source_points=>ARRAY['${beach}'::uuid])`;
    expect(() => query(`SET ROLE service_role; SELECT * FROM public.record_leased_swell_watch_provider_run_receipt('${loser}',${scopes})`))
      .toThrow("collection lease unavailable");
    expect(query(`SET ROLE service_role; SELECT count(*) FROM public.record_leased_swell_watch_provider_run_receipt('${winner}',${scopes})`)).toBe("1");
    const before = query("SELECT count(*) FROM public.swell_watch_provider_run_revision_sets");
    query("UPDATE public.swell_watch_collection_lease SET expires_at=clock_timestamp()-interval '1 second'");
    expect(() => query(`SET ROLE service_role; SELECT * FROM public.record_leased_swell_watch_provider_run_receipt('${winner}',${scopes})`))
      .toThrow("collection lease unavailable");
    expect(query(`SET ROLE service_role; SELECT public.try_acquire_swell_watch_collection_lease('${loser}')`)).toBe("t");
    expect(query(`SET ROLE service_role; SELECT public.release_swell_watch_collection_lease('${winner}')`)).toBe("f");
    expect(query("SELECT count(*) FROM public.swell_watch_provider_run_revision_sets")).toBe(before);
    expect(query(`SET ROLE service_role; SELECT public.release_swell_watch_collection_lease('${loser}')`)).toBe("t");
    expect(query("SELECT count(*) FROM public.swell_watch_collection_lease")).toBe("0");
  }, 30_000);

  it("aborts contended queue DDL without partial objects, then applies after the lock clears", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const base = ["exec", "-i", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"];
    execFileSync("docker", [...base, "-c", "CREATE DATABASE phase26_ddl_timeout"], { stdio: "pipe" });
    const args = [...base, "-d", "phase26_ddl_timeout"];
    const query = (sql: string): string => execFileSync("docker", [...args, "-c", sql], { encoding: "utf8", stdio: "pipe" }).trim();
    query("CREATE TABLE public.notification_events(type text, payload jsonb, recipient_user_id uuid)");
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260904120001_add_swell_watch_v2_enqueue_dedupe.sql"), "utf8");
    const holder = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"], timeout: 12_000 });
    const closed = new Promise<number | null>((resolve, reject) => {
      holder.once("error", reject);
      holder.once("close", resolve);
    });
    const ready = new Promise<void>((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Queue lock did not become ready")), 5_000);
      holder.once("close", () => { clearTimeout(timer); reject(new Error("Queue lock holder exited before readiness")); });
      holder.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes("queue_lock_ready")) { clearTimeout(timer); resolve(); }
      });
    });
    const objectCount = (): string => query(`SELECT
      (SELECT count(*) FROM pg_constraint WHERE conrelid='public.notification_events'::regclass
        AND conname='notification_events_swell_watch_v2_regional_event_id_check') +
      (SELECT count(*) FROM pg_class WHERE oid=to_regclass('public.notification_events_swell_watch_v2_recipient_event_dedupe'))`);
    try {
      holder.stdin.write("BEGIN; LOCK TABLE public.notification_events IN ACCESS SHARE MODE; SELECT 'queue_lock_ready';\n");
      await ready;
      expect(() => execFileSync("docker", [...args, "-f", "-"], {
        input: sql, encoding: "utf8", stdio: "pipe", timeout: 8_000,
      })).toThrow("canceling statement due to lock timeout");
      expect(objectCount()).toBe("0");
    } finally {
      holder.stdin.end("ROLLBACK;\n");
      expect(await closed).toBe(0);
    }
    execFileSync("docker", [...args, "-f", "-"], { input: sql, stdio: "pipe", timeout: 8_000 });
    expect(objectCount()).toBe("2");
  });

  it("stores captured seven-day runs and unavailable slots without creating completed evidence", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const client = new PostgrestClient("http://127.0.0.1:55433", { fetch: (async (url: string, init: Parameters<typeof httpFetch>[1]) => {
      if (new URL(url).origin !== "http://127.0.0.1:55433") throw new Error("Nonlocal request prohibited");
      return httpFetch(url, init);
    }) as unknown as typeof fetch });
    const rpc = jest.fn(async (name: string, args: object) => await client.rpc(name, args));
    const query = (sql: string): string => execFileSync("docker", ["exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const sourcePointId = randomUUID();
    expect(query(`SELECT count(*) || ':' || bool_or(has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('swell_watch_observations','swell_watch_beach_impacts',
        'swell_watch_regional_events','swell_watch_event_evaluations','swell_watch_event_impacts',
        'swell_watch_event_state_transitions','swell_watch_event_aliases','swell_watch_recipient_announcements',
        'swell_watch_automation_control')`)).toBe("9:false");
    expect(query(`SELECT has_function_privilege('anon','public.read_swell_watch_attested_run(uuid,uuid)','EXECUTE')::text || ':' ||
      has_function_privilege('authenticated','public.read_swell_watch_attested_run(uuid,uuid)','EXECUTE')::text || ':' ||
      has_function_privilege('service_role','public.read_swell_watch_attested_run(uuid,uuid)','EXECUTE')::text`)).toBe("false:false:true");
    query(`INSERT INTO public.beaches(id,name,lat,lon) VALUES('${sourcePointId}','Captured transport replay',32.8,-117.3)`);
    const stored = [];
    const rawBodies: string[] = [];
    for (const name of ["06z-first", "06z-repeat", "12z"]) {
      const capture = JSON.parse(readFileSync(join(process.cwd(), `docs/runbooks/evidence/open-meteo-seven-day-20260905-${name}.json`), "utf8"));
      rawBodies.push(capture.rawResponse);
      stored.push(await acquireProviderRunReceipts({ runUtc: capture.input.runUtc, forecastDays: 7,
        scopes: [{ sourcePointId, latitude: capture.input.latitude, longitude: capture.input.longitude }] },
      async () => ({ status: capture.status, text: async () => capture.rawResponse }), { rpc }));
    }
    expect(stored[1]).toEqual(stored[0]);
    expect(stored[2].issuanceId).not.toBe(stored[0].issuanceId);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(Array(3).fill("record_swell_watch_provider_run_receipt"));
    const counts = JSON.parse(query(`SELECT json_build_object(
      'components',count(*),'unavailable',count(*) FILTER (WHERE component.unavailable_reason='provider_zero_tuple'),
      'revisions',count(DISTINCT component.revision_id))
      FROM public.swell_watch_provider_run_revision_components component
      JOIN public.swell_watch_provider_run_revisions revision ON revision.id=component.revision_id
      JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id=revision.scope_id
      WHERE scope.source_point_id='${sourcePointId}'`));
    expect(counts).toEqual({ components: 672, unavailable: 16, revisions: 2 });
    const retained = JSON.parse(query(`SELECT json_agg(raw.raw_response ORDER BY raw.raw_response_sha256)
      FROM public.swell_watch_provider_run_revision_raw_responses raw
      JOIN public.swell_watch_provider_run_revisions revision ON revision.id=raw.revision_id
      JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id=revision.scope_id
      WHERE scope.source_point_id='${sourcePointId}'`));
    expect(retained).toHaveLength(3);
    expect(retained).toEqual(expect.arrayContaining(rawBodies));
    const sets = stored.map((item) => `'${item.revisionSetId}'`).join(",");
    expect(query(`SELECT count(*) FROM public.swell_watch_provider_run_attestations WHERE revision_set_id IN (${sets})`)).toBe("0");
    expect(query(`SELECT count(*) FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id IN (${sets})`)).toBe("0");
    expect(query(`SELECT count(*) FROM public.swell_watch_observations WHERE source_point_id='${sourcePointId}'`)).toBe("0");
    await expect(loadAttestedSwellWatchRun({ providerBatchId: stored[0].runBatchId, sourcePointId }, { rpc }))
      .rejects.toThrow("completed provider run is required");
  }, 30_000);

  it("keeps release evidence beach-specific across missing, delayed and discontinuous impacts", () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const values = { ...fixturePolicy.policy_values, volume_caps: { ...fixturePolicy.policy_values.volume_caps,
      maximum_projected_sends_per_window: 100, projected_send_window_hours: 24 } };
    const output = execFileSync("docker", ["exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", `
      BEGIN;
      DO $$ DECLARE
        beaches uuid[] := ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
        recipients uuid[] := ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
        notifications uuid[] := ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
        event_id uuid := gen_random_uuid(); revision_id uuid; batch_id uuid; second_batch uuid;
        epoch integer; reason text; run_at timestamptz := date_trunc('day',now()) + make_interval(hours=>floor(extract(hour FROM now())/6)::integer*6);
        arrival timestamptz := now()+interval '3 days'; peak timestamptz := now()+interval '3 days 6 hours';
        idx integer; run_idx integer; slot_idx integer; missing_scopes jsonb;
      BEGIN
        PERFORM set_config('app.swell_watch_internal_write','on',true);
        INSERT INTO public.swell_watch_production_approval_authority
          (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        VALUES (gen_random_uuid(),gen_random_uuid(),1,'active',repeat('a',64),'production_approved',
          '${JSON.stringify(values)}','multi-beach-fixture',repeat('c',64),'swell_watch_push','fixture-only',now()-interval '1 hour',now()+interval '1 hour');
        SELECT control.epoch INTO epoch FROM public.swell_watch_get_automation_control() control;
        PERFORM * FROM public.transition_swell_watch_automation_control('hold',epoch,'fixture',gen_random_uuid()::text,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL);
        PERFORM * FROM public.transition_swell_watch_automation_control('reset_shadow',epoch+1,'fixture',gen_random_uuid()::text,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL);
        PERFORM * FROM public.transition_swell_watch_automation_control('arm',epoch+2,'fixture',gen_random_uuid()::text,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL);
        FOR idx IN 1..3 LOOP
          INSERT INTO public.beaches(id,name,lat,lon) VALUES(beaches[idx],'multi-'||beaches[idx],21,-157);
          INSERT INTO auth.users(id) VALUES(recipients[idx]);
          INSERT INTO public.profiles(id,display_name,notif_push_enabled,notif_forecast_alerts) VALUES(recipients[idx],'multi-'||recipients[idx],true,true);
          INSERT INTO public.user_devices(user_id,platform,device_token) VALUES(recipients[idx],'ios','fixture-'||recipients[idx]);
          INSERT INTO public.favorite_beaches(user_id,beach_id,alerts_enabled) VALUES(recipients[idx],beaches[idx],true);
          INSERT INTO public.notification_events(id,type,recipient_user_id,payload)
          VALUES(notifications[idx],'swell_watch',recipients[idx],jsonb_build_object(
            'schema_version','swell-watch-notification.v2','regional_event_id',event_id,'beach_id',beaches[idx],'forecast_at',run_at,'arrival_at',arrival,'peak_at',peak));
        END LOOP;
        FOR run_idx IN 0..1 LOOP
          SELECT receipt.revision_set_id INTO revision_id FROM public.record_swell_watch_provider_run_receipt(
            public.fixture_provider_run_scopes(to_char(run_at+make_interval(hours=>run_idx*6),'YYYY-MM-DD"T"HH24:MI"Z"'),1,1,beaches)) receipt;
          PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),revision_id,'accepted','fixture-owner',repeat('a',64),'fixture-only');
          SELECT completed.provider_batch_id INTO batch_id FROM public.complete_swell_watch_provider_run_receipt(revision_id) completed;
          IF run_idx=1 THEN second_batch:=batch_id; END IF;
          FOR idx IN 1..3 LOOP
            IF run_idx=1 AND idx=2 THEN CONTINUE; END IF;
            PERFORM public.ingest_verified_swell_watch_evaluation(batch_id,gen_random_uuid(),gen_random_uuid(),event_id,beaches[idx],event_id::text,event_id::text,
              run_at+interval '6 hours','s1',1,12,170,2,'fixture',repeat('a',64),repeat('b',64),
              arrival+make_interval(hours=>CASE WHEN idx=3 AND run_idx=1 THEN 24 ELSE idx END),
              peak+make_interval(hours=>CASE WHEN idx=3 AND run_idx=1 THEN 24 ELSE idx END));
          END LOOP;
          IF run_idx=0 AND EXISTS(SELECT 1 FROM public.swell_watch_event_state_transitions WHERE regional_event_id=event_id AND state='stable') THEN
            RAISE EXCEPTION 'three beaches counted as independent runs';
          END IF;
        END LOOP;
        IF (SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id=event_id)<>2
          OR (SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id=event_id)<>5 THEN
          RAISE EXCEPTION 'multi-beach associations missing or duplicate confirmations';
        END IF;
        FOR idx IN 1..3 LOOP
          SELECT release.reason_code INTO reason FROM public.swell_watch_validate_notification_release(event_id,beaches[idx],recipients[idx],run_at,notifications[idx]) release;
          IF reason IS DISTINCT FROM (ARRAY['allowed','provider_evidence_unavailable','event_not_releasable'])[idx] THEN
            RAISE EXCEPTION 'beach % unexpected release: %',idx,reason;
          END IF;
        END LOOP;
        PERFORM public.ingest_verified_swell_watch_evaluation(second_batch,gen_random_uuid(),gen_random_uuid(),event_id,beaches[2],event_id::text,event_id::text,
          run_at+interval '6 hours','s1',1,12,170,2,'fixture',repeat('a',64),repeat('b',64),arrival+interval '2 hours',peak+interval '2 hours');
        SELECT release.reason_code INTO reason FROM public.swell_watch_validate_notification_release(event_id,beaches[2],recipients[2],run_at,notifications[2]) release;
        IF reason IS DISTINCT FROM 'allowed' THEN RAISE EXCEPTION 'second beach own evidence did not release: %',reason; END IF;
        IF (SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id=event_id)<>2
          OR (SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id=event_id)<>6 THEN
          RAISE EXCEPTION 'delayed second-beach evidence changed regional confirmation count';
        END IF;
        missing_scopes := public.fixture_provider_run_scopes(to_char(run_at+interval '12 hours','YYYY-MM-DD"T"HH24:MI"Z"'),1,1,beaches,
          p_secondary_height=>0,p_secondary_period=>0,p_secondary_direction=>0);
        FOR idx IN 0..2 LOOP
          FOR slot_idx IN 0..23 LOOP
            missing_scopes := jsonb_set(missing_scopes,ARRAY[idx::text,'receipt','observations',slot_idx::text,'components','1','unavailableReason'],'"provider_zero_tuple"');
          END LOOP;
        END LOOP;
        SELECT receipt.revision_set_id INTO revision_id FROM public.record_swell_watch_provider_run_receipt(missing_scopes) receipt;
        PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),revision_id,'accepted','fixture-owner',repeat('d',64),'fixture-only');
        SELECT completed.provider_batch_id INTO batch_id FROM public.complete_swell_watch_provider_run_receipt(revision_id) completed;
        IF public.read_swell_watch_attested_run(batch_id,beaches[1]) #>> '{samples,0,components,1,unavailableReason}' IS DISTINCT FROM 'provider_zero_tuple' THEN
          RAISE EXCEPTION 'whole-run read erased unavailable component';
        END IF;
        SELECT release.reason_code INTO reason FROM public.swell_watch_validate_notification_release(event_id,beaches[1],recipients[1],run_at,notifications[1]) release;
        IF reason IS DISTINCT FROM 'provider_evidence_unavailable' THEN
          RAISE EXCEPTION 'newer missing-data run left old alert eligible: %',reason;
        END IF;
        FOR run_idx IN 3..4 LOOP
          SELECT receipt.revision_set_id INTO revision_id FROM public.record_swell_watch_provider_run_receipt(
            public.fixture_provider_run_scopes(to_char(run_at+make_interval(hours=>run_idx*6),'YYYY-MM-DD"T"HH24:MI"Z"'),1,1,beaches)) receipt;
          PERFORM public.attest_swell_watch_provider_run(gen_random_uuid(),revision_id,'accepted','fixture-owner',repeat('e',64),'fixture-only');
          SELECT completed.provider_batch_id INTO batch_id FROM public.complete_swell_watch_provider_run_receipt(revision_id) completed;
          PERFORM public.ingest_verified_swell_watch_evaluation(batch_id,gen_random_uuid(),gen_random_uuid(),event_id,beaches[1],event_id::text,event_id::text,
            run_at+make_interval(hours=>run_idx*6),'s1',1,12,170,2,'fixture',repeat('a',64),repeat('b',64),arrival+interval '1 hour',peak+interval '1 hour');
          SELECT release.reason_code INTO reason FROM public.swell_watch_validate_notification_release(event_id,beaches[1],recipients[1],run_at,notifications[1]) release;
          IF reason IS DISTINCT FROM (CASE WHEN run_idx=3 THEN 'provider_evidence_unavailable' ELSE 'allowed' END) THEN
            RAISE EXCEPTION 'missing-run recovery accepted nonconsecutive support or failed to recover: %',reason;
          END IF;
        END LOOP;
      END $$;
      ROLLBACK;
      SELECT 'multi-beach-release-pass';
    `], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    expect(output.trim()).toBe("multi-beach-release-pass");
  });

  it("acquires, attests, completes and ingests through real RPCs without self-attestation or duplicate evaluations", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const client = new PostgrestClient("http://127.0.0.1:55433", { fetch: (async (url: string, init: Parameters<typeof httpFetch>[1]) => {
      if (new URL(url).origin !== "http://127.0.0.1:55433") throw new Error("Nonlocal request prohibited");
      return httpFetch(url, init);
    }) as unknown as typeof fetch });
    const rpc = async (name: string, args: object) => await client.rpc(name, args);
    const ingestionClient = { rpc, from: client.from.bind(client) as never };
    const ownerQuery = (sql: string): string => String(execFileSync("docker", ["exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).trim();
    expect(ownerQuery("SELECT has_function_privilege('anon','public.ingest_swell_watch_run(jsonb)','EXECUTE'),has_function_privilege('authenticated','public.ingest_swell_watch_run(jsonb)','EXECUTE'),has_function_privilege('service_role','public.ingest_swell_watch_run(jsonb)','EXECUTE')")).toBe("f|f|t");
    const beachId = randomUUID();
    const neighborId = randomUUID();
    let eventId: string = randomUUID();
    const regionKey = randomUUID();
    ownerQuery(`BEGIN; SELECT set_config('app.swell_watch_internal_write','on',true);
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      VALUES (gen_random_uuid(),gen_random_uuid(),1,'active','${fixturePolicy.value_hash}','production_approved',
        '${JSON.stringify(fixturePolicy.policy_values)}','identity-fixture',repeat('c',64),'swell_watch_push','fixture-only',now()-interval '1 hour',now()+interval '1 hour'); COMMIT;`);
    const attestationId = randomUUID();
    expect((await client.from("beaches").insert({ id: beachId, name: "Producer fixture", lat: 32.8, lon: -117.3 })).error).toBeNull();
    expect((await client.from("beaches").insert({ id: neighborId, name: "Neighbor fixture", lat: 32.8, lon: -117.3 })).error).toBeNull();
    const runUtc = "2010-01-01T00:00Z";
    const time = Array.from({ length: 24 }, (_, index) => new Date(Date.parse(runUtc) + index * 3600000).toISOString().slice(0,16));
    const fields = { swell_wave_height: 1, swell_wave_period: 9, swell_wave_direction: 270, secondary_swell_wave_height: 1.8, secondary_swell_wave_period: 13, secondary_swell_wave_direction: 170 };
    const raw = JSON.stringify({ latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0, timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0,
      hourly_units: { time: "iso8601", ...Object.fromEntries(Object.keys(fields).map((field) => [field,field.endsWith("height") ? "m" : field.endsWith("period") ? "s" : "°"])) },
      hourly: { time, ...Object.fromEntries(Object.entries(fields).map(([field,value]) => [field,time.map(() => value)])) } });
    const issuedSeconds = Date.parse(runUtc) / 1000;
    const metadata = JSON.stringify({ last_run_initialisation_time: issuedSeconds,
      last_run_modification_time: issuedSeconds + 3600, last_run_availability_time: issuedSeconds + 3700,
      temporal_resolution_seconds: 3600, update_interval_seconds: 21600 });
    const fetcher = jest.fn(async (url: string) => ({ status: 200,
      text: async () => url.endsWith("/static/meta.json") ? metadata : raw }));
    const acquisition = { runUtc, forecastDays: 1, scopes: [beachId, neighborId].map((sourcePointId) => ({ sourcePointId, latitude: 32.8, longitude: -117.3 })) };
    const stored = await acquireProviderRunReceipts({ forecastDays: 1, scopes: acquisition.scopes,
      latestAvailableAt: new Date((issuedSeconds + 4300) * 1000) }, fetcher, { rpc });
    expect(fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get("run")))
      .toEqual([null, "2010-01-01T00:00", "2010-01-01T00:00"]);
    expect(await acquireProviderRunReceipts(acquisition, fetcher, { rpc })).toEqual(stored);
    await expect(completeAttestedProviderRun(stored, { rpc })).rejects.toThrow("attestation");
    const selfAttestation = await client.rpc("attest_swell_watch_provider_run", { p_attestation_id: attestationId, p_revision_set_id: stored.revisionSetId, p_state: "accepted", p_reviewer: "fixture", p_evidence_sha256: "a".repeat(64), p_provider_contract_ref: "fixture-only" });
    expect(selfAttestation.error).not.toBeNull();
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_provider_run_attestations WHERE revision_set_id='${stored.revisionSetId}'`)).toBe("0");
    expect(ownerQuery(`SELECT public.attest_swell_watch_provider_run('${attestationId}','${stored.revisionSetId}','accepted','fixture-owner',repeat('a',64),'fixture-only-contract')`)).toBe(attestationId);
    const completed = await completeAttestedProviderRun(stored, { rpc });
    expect(await completeAttestedProviderRun(stored, { rpc })).toEqual(completed);
    const input: Parameters<typeof ingestAttestedSwellWatchImpact>[0] = {
      providerBatchId: completed.providerBatchId, sourcePointId: beachId, observationId: randomUUID(), impactId: randomUUID(), regionalEventId: eventId,
      forecastAt: "2010-01-01T00:00:00.000Z", sourceSlot: "s2", regionKey, physicalKey: eventId, peakAt: "2010-01-01T06:00:00.000Z",
      impact: { baselineHeightFt: 1, baselineEnergy: 8, arrivalAt: "2010-01-01T00:00:00.000Z", now: new Date("2009-12-29T00:00:00.000Z"),
        beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 }, policy: fixturePolicy as SwellWatchPolicy, seamContinuous: true, sourceCoherent: true },
    };
    const first = await ingestAttestedSwellWatchImpact(input, ingestionClient);
    expect(first).toMatchObject({ kind: "candidate", eventState: "candidate", partition: { sourceSlot: "s2", heightM: 1.8, periodS: 13, directionDeg: 170 } });
    if (first.kind !== "candidate") throw new Error("Fixture impact suppressed");
    expect(first.regionalEventId).not.toBe(eventId);
    eventId = first.regionalEventId;
    const proposedRetryId = randomUUID();
    expect(await ingestAttestedSwellWatchImpact({ ...input, regionalEventId: proposedRetryId, observationId: randomUUID(), impactId: randomUUID() }, ingestionClient))
      .toMatchObject({ kind: "candidate", regionalEventId: eventId });
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_regional_events WHERE id='${proposedRetryId}'`)).toBe("0");
    const persisted = JSON.parse(ownerQuery(`SELECT json_build_object('observations',(SELECT count(*) FROM public.swell_watch_observations WHERE evaluation_id='${completed.evaluationId}'),'evaluations',(SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id='${eventId}'),'slot',(SELECT source_slot FROM public.swell_watch_observations WHERE id='${input.observationId}'),'period',(SELECT period_s FROM public.swell_watch_observations WHERE id='${input.observationId}'),'batch',(SELECT provider_batch_id FROM public.swell_watch_observations WHERE id='${input.observationId}'))`));
    expect(persisted).toEqual({ observations: 1, evaluations: 1, slot: "s2", period: 13, batch: completed.providerBatchId });
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_event_state_transitions WHERE regional_event_id='${eventId}'`)).toBe("0");
    const neighborInput = { ...input, regionalEventId: randomUUID(), sourcePointId: neighborId, observationId: randomUUID(), impactId: randomUUID(),
      peakAt: "2010-01-01T08:00:00.000Z", impact: { ...input.impact, arrivalAt: "2010-01-01T02:00:00.000Z" } };
    const neighbors = await Promise.all([neighborInput, { ...neighborInput, observationId: randomUUID(), impactId: randomUUID() }]
      .map((candidate) => ingestAttestedSwellWatchImpact(candidate, ingestionClient)));
    expect(neighbors.map((candidate) => candidate.kind)).toEqual(["candidate", "candidate"]);
    const neighborRetryId = randomUUID();
    expect(await ingestAttestedSwellWatchImpact({ ...neighborInput, regionalEventId: neighborRetryId }, ingestionClient))
      .toMatchObject({ regionalEventId: eventId });
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_regional_events WHERE id='${neighborRetryId}'`)).toBe("0");
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id='${eventId}'`)).toBe("1");
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id='${eventId}'`)).toBe("2");
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_event_state_transitions WHERE regional_event_id='${eventId}'`)).toBe("0");
    const associations = await client.from("swell_watch_event_impacts").select("beach_id,arrival_at,peak_at").eq("regional_event_id", eventId);
    expect(associations.error).toBeNull();
    expect(associations.data).toEqual(expect.arrayContaining([
      { beach_id: beachId, arrival_at: "2010-01-01T00:00:00+00:00", peak_at: "2010-01-01T06:00:00+00:00" },
      { beach_id: neighborId, arrival_at: "2010-01-01T02:00:00+00:00", peak_at: "2010-01-01T08:00:00+00:00" },
    ]));
    expect(associations.data).toHaveLength(2);
    expect((await client.from("swell_watch_event_impacts").insert({ id: randomUUID() })).error?.code).toBe("42501");
    const conflictingComponent = await rpc("ingest_verified_swell_watch_evaluation", {
      p_provider_batch_id: completed.providerBatchId, p_observation_id: randomUUID(), p_impact_id: randomUUID(),
      p_regional_event_id: eventId, p_source_point_id: neighborId, p_region_key: regionKey, p_physical_key: eventId,
      p_forecast_at: input.forecastAt, p_source_slot: "s1", p_height_m: 1, p_period_s: 9, p_direction_deg: 270,
      p_projected_face_height_ft: 2, p_policy_id: "fixture-policy", p_policy_hash: "a".repeat(64), p_impact_hash: "c".repeat(64),
      p_arrival_at: neighborInput.impact.arrivalAt, p_peak_at: neighborInput.peakAt,
    });
    expect(conflictingComponent.error?.message).toBe("conflicting event evaluation retry");
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_observations WHERE evaluation_id='${completed.evaluationId}'`)).toBe("2");
    await expect(ingestAttestedSwellWatchImpact({ ...neighborInput, peakAt: "2010-01-01T09:00:00.000Z" }, ingestionClient)).rejects.toThrow("conflicting impact retry");
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id='${eventId}'`)).toBe("2");

    const secondRunUtc = "2010-01-01T06:00Z";
    const secondEnvelope = JSON.parse(raw);
    secondEnvelope.hourly.time = time.map((instant) => new Date(Date.parse(`${instant}Z`) + 6 * 3600000).toISOString().slice(0, 16));
    const secondStored = await acquireProviderRunReceipts({ ...acquisition, runUtc: secondRunUtc }, async () => ({ status: 200, text: async () => JSON.stringify(secondEnvelope) }), { rpc });
    const secondAttestationId = randomUUID();
    expect(ownerQuery(`SELECT public.attest_swell_watch_provider_run('${secondAttestationId}','${secondStored.revisionSetId}','accepted','fixture-owner',repeat('a',64),'fixture-only-contract')`)).toBe(secondAttestationId);
    const secondCompleted = await completeAttestedProviderRun(secondStored, { rpc });
    expect(secondCompleted.evaluationId).not.toBe(completed.evaluationId);
    const secondInput = { ...input, providerBatchId: secondCompleted.providerBatchId, forecastAt: "2010-01-01T06:00:00.000Z", observationId: randomUUID(), impactId: randomUUID() };
    expect(await ingestAttestedSwellWatchImpact(secondInput, ingestionClient)).toMatchObject({ kind: "candidate", regionalEventId: eventId });
    await ingestAttestedSwellWatchImpact({ ...secondInput, observationId: randomUUID(), impactId: randomUUID() }, ingestionClient);
    await ingestAttestedSwellWatchImpact({ ...neighborInput, providerBatchId: secondCompleted.providerBatchId,
      forecastAt: secondInput.forecastAt, observationId: randomUUID(), impactId: randomUUID() }, ingestionClient);
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id='${eventId}'`)).toBe("4");
    const eventEvaluations = await client.from("swell_watch_event_evaluations").select("evaluation_id").eq("regional_event_id", eventId);
    expect(eventEvaluations.error).toBeNull();
    expect(eventEvaluations.data?.map((row) => row.evaluation_id).sort()).toEqual([completed.evaluationId, secondCompleted.evaluationId].sort());
    const eventStates = await client.from("swell_watch_event_state_transitions").select("state,version,trigger_evaluation_id").eq("regional_event_id", eventId);
    expect(eventStates.error).toBeNull();
    expect(eventStates.data).toEqual([{ state: "stable", version: 1, trigger_evaluation_id: secondCompleted.evaluationId }]);
    expect(await ingestAttestedSwellWatchImpact({ ...input, observationId: randomUUID(), impactId: randomUUID() }, ingestionClient))
      .toMatchObject({ regionalEventId: eventId, eventState: "stable" });
    const history = await loadSwellWatchHistory({ regionKey, beachId: neighborId }, ingestionClient);
    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.identity.id)).toEqual([completed.evaluationId, secondCompleted.evaluationId]);
    expect(history.every((entry) => entry.eventState === "stable" && entry.impact.kind === "candidate" && entry.impact.arrivalAt === "2010-01-01T02:00:00+00:00")).toBe(true);
    expect(matchRegionalSwellEvent(history, fixturePolicy as SwellWatchPolicy, { persistedEvents: history.map((reference) => ({
      regionalEventId: eventId, regionKey, aliases: [], reference,
    })) })).toMatchObject({ regionalEventId: eventId, status: "stable" });
    const revokeAfterRead = async (name: string, args: object) => {
      const result = await rpc(name,args);
      if (name === "read_swell_watch_attested_components") {
        if (result.error) throw new Error("Attested read failed before revocation");
        ownerQuery(`SELECT public.attest_swell_watch_provider_run('${randomUUID()}','${stored.revisionSetId}','revoked','fixture-owner',repeat('b',64),'fixture-only-contract','${attestationId}')`);
      }
      return result;
    };
    await expect(ingestAttestedSwellWatchImpact({ ...input, forecastAt: "2010-01-01T01:00:00.000Z", observationId: randomUUID(), impactId: randomUUID() }, { ...ingestionClient, rpc: revokeAfterRead })).rejects.toThrow("Attested impact ingestion failed");
    await expect(loadSwellWatchHistory({ regionKey, beachId: neighborId }, ingestionClient)).rejects.toThrow("history attestation failed");
    await expect(loadAttestedSwellWatchRun({ providerBatchId: completed.providerBatchId, sourcePointId: beachId }, { rpc }))
      .rejects.toThrow("current provider attestation is required");
    for (const [index, state] of ["suppressed", "candidate"].entries()) {
      const transition = await client.rpc("append_swell_watch_state_transition", { p_transition_id: randomUUID(),
        p_regional_event_id: eventId, p_expected_version: index + 1, p_state: state, p_evaluation_id: secondCompleted.evaluationId });
      expect(transition.error).toBeNull();
    }
    expect(await loadSwellWatchHistory({ regionKey, beachId: neighborId }, ingestionClient)).toEqual([]);
    expect(ownerQuery(`SELECT count(*) FROM public.swell_watch_observations WHERE evaluation_id='${completed.evaluationId}'`)).toBe("2");
    expect(ownerQuery(`SELECT count(*) FROM public.notification_events WHERE payload->>'regional_event_id'='${eventId}'`)).toBe("0");
  });

  it("persists kill/hold/reset suppression and delivers only a fresh armed event", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const client = new PostgrestClient("http://127.0.0.1:55433", { fetch: (async (url: string, init: Parameters<typeof httpFetch>[1]) => {
      if (new URL(url).origin !== "http://127.0.0.1:55433") throw new Error("Nonlocal request prohibited");
      return httpFetch(url, init);
    }) as unknown as typeof fetch });
    const id = randomUUID();
    const entry = NOTIFICATION_REGISTRY.swell_watch;
    const channels = entry.channels;
    const flag = process.env.SWELL_WATCH_PUSH_ENABLED;
    const fcm = { sendEach: jest.fn(async () => ({ successCount: 1, failureCount: 0, responses: [{ success: true }] })) };
    try {
      const options = { now: new Date("2026-09-04T12:00:00Z"), fcm: fcm as never, resolveMajorEventHold: async () => ({ status: "allowed" as const, candidate: null }) };
      entry.channels = [];
      process.env.SWELL_WATCH_PUSH_ENABLED = "true";
      const surfaceDisabledId = randomUUID();
      expect((await client.from("notification_events").insert({
        id: surfaceDisabledId, type: "swell_watch", recipient_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { ...fixture, regional_event_id: randomUUID() },
      })).error).toBeNull();
      expect((await processPendingEvents(client as never, options)).fetched).toBe(1);
      const surfaceDisabled = await client.from("notification_events").select("status,attempt_count,skip_reason").eq("id", surfaceDisabledId).single();
      expect(surfaceDisabled.error).toBeNull();
      expect(surfaceDisabled.data).toEqual({ status: "processed", attempt_count: 1, skip_reason: "surface_disabled" });
      const surfaceAttempts = await client.from("notification_delivery_attempts").select("status").eq("notification_event_id", surfaceDisabledId);
      expect(surfaceAttempts.error).toBeNull();
      expect(surfaceAttempts.data).toEqual([]);
      expect(fcm.sendEach).not.toHaveBeenCalled();
      entry.channels = ["push"] as never;
      expect((await processPendingEvents(client as never, options)).fetched).toBe(0);
      expect(fcm.sendEach).not.toHaveBeenCalled();
      delete process.env.SWELL_WATCH_PUSH_ENABLED;
      const inserted = await client.from("notification_events").insert({
        id, type: "swell_watch", recipient_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { ...fixture, regional_event_id: randomUUID() },
      });
      expect(inserted.error).toBeNull();
      const result = await processPendingEvents(client as never, options);
      expect(result.by_status.skipped_disabled).toBe(1);
      const event = await client.from("notification_events").select("status,attempt_count").eq("id", id).single();
      expect(event.error).toBeNull();
      expect(event.data).toEqual({ status: "processed", attempt_count: 1 });
      const attempts = await client.from("notification_delivery_attempts").select("status,provider_response").eq("notification_event_id", id);
      expect(attempts.error).toBeNull();
      expect(attempts.data).toEqual([{ status: "skipped_disabled", provider_response: { audit_code: "swell_watch_release", reason_code: "static_disabled" } }]);
      const retry = await processPendingEvents(client as never, options);
      expect(retry.fetched).toBe(0);
      expect(fcm.sendEach).not.toHaveBeenCalled();

      // Synthetic authority exists only in the disposable database, never as shadow evidence.
      const releasePolicy: SwellWatchPolicy = { ...fixturePolicy as SwellWatchPolicy, schema_version: "swell-watch-policy.v2", provenance: "production_approved",
        policy_values: { ...fixturePolicy.policy_values, volume_caps: { ...fixturePolicy.policy_values.volume_caps, maximum_projected_sends_per_window: 1, projected_send_window_hours: 24 }, staleness: { maximum_forecast_age_hours: 1 } },
        approval_evidence: { approval_id: "synthetic-worker-drill", evidence_hash: "c".repeat(64), reviewer: "fixture-only", reviewed_at: new Date().toISOString() } };
      releasePolicy.value_hash = calculateSwellWatchPolicyHash(releasePolicy);
      execFileSync("docker", ["exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qc", `
        SELECT set_config('app.swell_watch_internal_write', 'on', false);
        INSERT INTO public.swell_watch_production_approval_authority
          (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        VALUES (gen_random_uuid(),gen_random_uuid(),2,'active','${releasePolicy.value_hash}','production_approved',
          '${JSON.stringify(releasePolicy.policy_values)}',
          'synthetic-worker-drill',repeat('c',64),'swell_watch_push','fixture-only',now()-interval '1 hour',now()+interval '1 hour');
      `], { stdio: "pipe" });
      const beach = await client.from("beaches").insert({ id: fixture.beach_id, name: "Fixture beach", lat: 21, lon: -157 });
      expect(beach.error).toBeNull();
      const favorite = await client.from("favorite_beaches").insert({ user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", beach_id: fixture.beach_id, alerts_enabled: true });
      expect(favorite.error).toBeNull();
      const transition = async (operation: string, epoch: number, state: string): Promise<void> => {
        const response = await client.rpc("transition_swell_watch_automation_control", {
          p_operation: operation, p_expected_epoch: epoch, p_reason_code: "fixture_drill",
          p_idempotency_key: randomUUID(), p_actor_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        });
        expect(response.error).toBeNull();
        expect(response.data).toEqual([{ state, epoch: epoch + 1, reason_code: "fixture_drill" }]);
      };
      const databaseQuery = (sql: string): string => String(execFileSync("docker", [
        "exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres",
        "-Atq", "-v", "ON_ERROR_STOP=1", "-c", sql,
      ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).trim().split(/\s+/).at(-1) ?? "";
      const fixtureRun = (() => {
        const now = new Date();
        // Legacy safety fixtures reserve tomorrow; full-horizon integration owns today's latest run.
        const hour = Math.floor(now.getUTCHours() / 6) * 6 + 30;
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour)).toISOString().slice(0, 16) + "Z";
      })();
      const completedFixtureBatches = new Map<string, string>();
      const completeLocalFixtureBatch = (run: string, height: number, beachId = fixture.beach_id): string => {
        const key = JSON.stringify([run, height, beachId]);
        const existing = completedFixtureBatches.get(key);
        if (existing) return existing;
        const revisionSetId = databaseQuery(`SET ROLE service_role; SELECT revision_set_id FROM public.record_swell_watch_provider_run_receipt(public.fixture_provider_run_scopes(p_run=>'${run}',p_height=>${height},p_generationtime=>1,p_source_points=>ARRAY['${beachId}'::uuid],p_primary_period=>9,p_secondary_height=>1.8,p_secondary_period=>13,p_secondary_direction=>170))`);
        databaseQuery(`SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_provider_run_attestations (revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref) VALUES ('${revisionSetId}','accepted','local-worker-fixture',repeat('d',64),'local-fixture-contract')`);
        const batch = databaseQuery(`SET ROLE service_role; SELECT provider_batch_id FROM public.complete_swell_watch_provider_run_receipt('${revisionSetId}')`);
        completedFixtureBatches.set(key, batch);
        return batch;
      };
      const queueSynthetic = async (): Promise<string> => {
        const regionalId = randomUUID();
        const forecastAt = new Date().toISOString();
        const arrivalAt = new Date(Date.now() + 3 * 86400000).toISOString();
        const peakAt = new Date(Date.now() + 3.25 * 86400000).toISOString();
        for (let index = 0; index < 2; index += 1) {
          const evaluation = await client.rpc("ingest_swell_watch_evaluation", {
            p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_regional_event_id: regionalId,
            p_evaluation_id: `synthetic_fixture:${randomUUID()}`, p_source_point_id: fixture.beach_id,
            p_region_key: regionalId, p_physical_key: regionalId, p_provider: "noaa", p_forecast_at: forecastAt,
            p_source_slot: "s2", p_height_m: 1.8, p_period_s: 13, p_direction_deg: 170,
            p_projected_face_height_ft: 5.9, p_policy_id: "fixture-policy", p_policy_hash: releasePolicy.value_hash,
            p_impact_hash: "b".repeat(64), p_identity_kind: "synthetic_fixture", p_arrival_at: arrivalAt, p_peak_at: peakAt,
          });
          expect(evaluation.error).toBeNull();
        }
        const queuedId = randomUUID();
        const queued = await client.from("notification_events").insert({
          id: queuedId, type: "swell_watch", recipient_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          payload: { ...fixture, regional_event_id: regionalId, forecast_at: forecastAt, arrival_at: arrivalAt, peak_at: peakAt },
        });
        expect(queued.error).toBeNull();
        return queuedId;
      };
      const queueVerified = async (discontinuity?: "period" | "timing" | "reverse" | "producer", runOffsetHours = 0, beachId = fixture.beach_id): Promise<string> => {
        let regionalId: string = randomUUID();
        const producerRegion = regionalId;
        const secondRun = new Date(Date.parse(fixtureRun) + runOffsetHours * 3600000).toISOString().slice(0, 16) + "Z";
        const firstRun = new Date(new Date(secondRun).getTime() - 6 * 3600000).toISOString().slice(0, 16) + "Z";
        const firstBatch = completeLocalFixtureBatch(firstRun, 1, beachId);
        const secondBatch = completeLocalFixtureBatch(secondRun, 1.1, beachId);
        const arrivalAt = new Date(Date.now() + 3 * 86400000).toISOString();
        const peakAt = new Date(Date.now() + 3.25 * 86400000).toISOString();
        const batches = discontinuity === "reverse" ? [secondBatch, firstBatch] : [firstBatch, secondBatch];
        // Keep computed impact hashes separate from the earlier hand-authored safety fixtures.
        const producerForecastAt = new Date(Date.parse(secondRun) + 3600000).toISOString();
        for (const providerBatchId of batches) {
          if (discontinuity === "producer") {
            const impact = await ingestAttestedSwellWatchImpact({ providerBatchId, sourcePointId: beachId,
              observationId: randomUUID(), impactId: randomUUID(), regionalEventId: regionalId,
              regionKey: producerRegion, physicalKey: producerRegion, forecastAt: producerForecastAt, sourceSlot: "s2", peakAt,
              impact: { baselineHeightFt: 1, baselineEnergy: 8, arrivalAt, now: new Date(),
                beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 }, policy: releasePolicy,
                seamContinuous: true, sourceCoherent: true },
            }, { from: client.from.bind(client) as never, rpc: async (name, args) => await client.rpc(name, args) });
            if (impact.kind !== "candidate" || impact.policyHash !== releasePolicy.value_hash) {
              throw new Error("Producer fixture did not persist its evaluated impact under the active policy");
            }
            regionalId = impact.regionalEventId;
            continue;
          }
          const usePrimary = discontinuity === "period" && providerBatchId === firstBatch;
          const shiftTiming = discontinuity === "timing" && providerBatchId === firstBatch;
          const evaluation = await client.rpc("ingest_verified_swell_watch_evaluation", {
            p_provider_batch_id: providerBatchId, p_observation_id: randomUUID(), p_impact_id: randomUUID(),
            p_regional_event_id: regionalId, p_source_point_id: beachId, p_region_key: regionalId,
            p_physical_key: regionalId, p_forecast_at: secondRun, p_source_slot: usePrimary ? "s1" : "s2", p_height_m: usePrimary ? 1 : 1.8,
            p_period_s: usePrimary ? 9 : 13, p_direction_deg: 170, p_projected_face_height_ft: 5.9, p_policy_id: "fixture-policy",
            p_policy_hash: releasePolicy.value_hash, p_impact_hash: "b".repeat(64),
            p_arrival_at: shiftTiming ? new Date(Date.parse(arrivalAt) + 86400000).toISOString() : arrivalAt,
            p_peak_at: shiftTiming ? new Date(Date.parse(peakAt) + 86400000).toISOString() : peakAt,
          });
          expect(evaluation.error).toBeNull();
        }
        if (discontinuity === "producer") return enqueueProducer(regionalId, producerRegion, producerForecastAt, arrivalAt, peakAt);
        const queuedId = randomUUID();
        const queued = await client.from("notification_events").insert({
          id: queuedId, type: "swell_watch", recipient_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          payload: { ...fixture, beach_id: beachId, regional_event_id: regionalId, forecast_at: secondRun, arrival_at: arrivalAt, peak_at: peakAt },
        });
        expect(queued.error).toBeNull();
        return queuedId;
      };
      const enqueueProducer = async (regionalId: string, producerRegion: string, secondRun: string, arrivalAt: string, peakAt: string): Promise<string> => {
          const history = await loadSwellWatchHistory({ regionKey: producerRegion, beachId: fixture.beach_id }, {
            from: client.from.bind(client) as never, rpc: async (name, args) => await client.rpc(name, args),
          });
          const regionalEvent = matchRegionalSwellEvent(history, releasePolicy, { persistedEvents: history.map((reference) => ({
            regionalEventId: regionalId, regionKey: producerRegion, aliases: [], reference,
          })) });
          expect(history).toHaveLength(2);
          expect(regionalEvent).toMatchObject({ regionalEventId: regionalId, status: "stable" });
          expect(regionalEvent.evaluationIds).toHaveLength(2);
          const producerInput: Parameters<typeof enqueueSwellWatchCandidates>[0] = { policy: releasePolicy,
            candidates: [{ beachId: fixture.beach_id, regionalEvent,
              projectedImpact: 5.9, confidence: 0.75, payload: { ...fixture, regional_event_id: regionalId, forecast_at: secondRun, arrival_at: arrivalAt, peak_at: peakAt } }],
            signals: { hasDiscontinuousData: false, hasMaterialDisagreement: false, stale: false, providerFailures: { samples: 0, failures: 0 }, priorProjectedSendsInWindow: 0 } };
          expect(await enqueueSwellWatchCandidates(producerInput, client as never)).toEqual({ enqueued: 1, duplicates: 0, stoppedReason: null });
          expect(await enqueueSwellWatchCandidates(producerInput, client as never)).toEqual({ enqueued: 0, duplicates: 1, stoppedReason: null });
          const queued = await client.from("notification_events").select("id,next_attempt_at").eq("payload->>regional_event_id", regionalId).single();
          expect(queued.error).toBeNull();
          expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${queued.data!.id}'`)).toBe("0");
          expect(queued.data!.next_attempt_at).toBeNull();
          return queued.data!.id;
      };
      const queueMixed = async (): Promise<string> => {
        const regionalId = randomUUID();
        const secondRun = fixtureRun;
        const firstRun = new Date(new Date(secondRun).getTime() - 6 * 3600000).toISOString().slice(0, 16) + "Z";
        const providerBatchId = completeLocalFixtureBatch(firstRun, 1);
        const arrivalAt = new Date(Date.now() + 3 * 86400000).toISOString();
        const peakAt = new Date(Date.now() + 3.25 * 86400000).toISOString();
        const synthetic = await client.rpc("ingest_swell_watch_evaluation", {
          p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_regional_event_id: regionalId,
          p_evaluation_id: `synthetic_fixture:${randomUUID()}`, p_source_point_id: fixture.beach_id,
          p_region_key: regionalId, p_physical_key: regionalId, p_provider: "noaa", p_forecast_at: secondRun,
          p_source_slot: "s1", p_height_m: 1, p_period_s: 9, p_direction_deg: 170,
          p_projected_face_height_ft: 5.9, p_policy_id: "fixture-policy", p_policy_hash: releasePolicy.value_hash,
          p_impact_hash: "b".repeat(64), p_identity_kind: "synthetic_fixture", p_arrival_at: arrivalAt, p_peak_at: peakAt,
        });
        expect(synthetic.error).toBeNull();
        const verified = await client.rpc("ingest_verified_swell_watch_evaluation", {
          p_provider_batch_id: providerBatchId, p_observation_id: randomUUID(), p_impact_id: randomUUID(),
          p_regional_event_id: regionalId, p_source_point_id: fixture.beach_id, p_region_key: regionalId,
          p_physical_key: regionalId, p_forecast_at: secondRun, p_source_slot: "s2", p_height_m: 1.8,
          p_period_s: 13, p_direction_deg: 170, p_projected_face_height_ft: 5.9, p_policy_id: "fixture-policy",
          p_policy_hash: releasePolicy.value_hash, p_impact_hash: "b".repeat(64), p_arrival_at: arrivalAt, p_peak_at: peakAt,
        });
        expect(verified.error).toBeNull();
        const queuedId = randomUUID();
        const queued = await client.from("notification_events").insert({
          id: queuedId, type: "swell_watch", recipient_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          payload: { ...fixture, regional_event_id: regionalId, forecast_at: secondRun, arrival_at: arrivalAt, peak_at: peakAt },
        });
        expect(queued.error).toBeNull();
        return queuedId;
      };
      const suppressed = async (queuedId: string, reason: string): Promise<void> => {
        const summary = await processPendingEvents(client as never, options);
        expect(summary.by_status.skipped_disabled).toBe(1);
        const persisted = await client.from("notification_delivery_attempts").select("status,provider_response").eq("notification_event_id", queuedId);
        expect(persisted.error).toBeNull();
        expect(persisted.data).toEqual([{ status: "skipped_disabled", provider_response: { audit_code: "swell_watch_release", reason_code: reason } }]);
        const terminal = await client.from("notification_events").select("status,attempt_count").eq("id", queuedId).single();
        expect(terminal.error).toBeNull();
        expect(terminal.data).toEqual({ status: "processed", attempt_count: 1 });
        expect(databaseQuery(`SELECT
          (SELECT count(*) FROM public.swell_watch_provider_delivery_outcomes WHERE notification_event_id='${queuedId}') || ':' ||
          (SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${queuedId}')`)).toBe("0:0");
        expect((await processPendingEvents(client as never, options)).fetched).toBe(0);
        expect(fcm.sendEach).not.toHaveBeenCalled();
      };
      process.env.SWELL_WATCH_PUSH_ENABLED = "true";
      await transition("hold", 0, "held");
      await transition("reset_shadow", 1, "shadow");
      await transition("arm", 2, "armed");
      await suppressed(await queueSynthetic(), "provider_evidence_unavailable");
      await suppressed(await queueMixed(), "provider_evidence_unavailable");
      const setFixtureMinimum = (minimum: 2 | 3 | null): void => {
        const values = minimum === null ? "policy_values - 'stability'" : `policy_values || '{"stability":{"minimum_genuine_evaluations":${minimum}}}'::jsonb`;
        databaseQuery(`SELECT set_config('app.swell_watch_internal_write','on',false);
          INSERT INTO public.swell_watch_production_approval_authority
            (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
          SELECT gen_random_uuid(),gen_random_uuid(),authority_epoch+1,'active',policy_hash,policy_provenance,${values},approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at
          FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1`);
      };
      setFixtureMinimum(null);
      await suppressed(await queueVerified(), "authority_unavailable");
      setFixtureMinimum(3);
      await suppressed(await queueVerified(), "event_not_releasable");
      setFixtureMinimum(2);
      for (const discontinuity of ["period", "timing", "reverse"] as const) {
        await suppressed(await queueVerified(discontinuity), "event_not_releasable");
      }
      const heldId = await queueVerified();
      await transition("hold", 3, "held");
      await suppressed(heldId, "control_not_armed");
      await transition("reset_shadow", 4, "shadow");
      await suppressed(await queueVerified(), "control_not_armed");
      await transition("arm", 5, "armed");
      const staleId = await queueVerified();
      await transition("hold", 6, "held");
      await transition("reset_shadow", 7, "shadow");
      await transition("arm", 8, "armed");
      await suppressed(staleId, "notification_binding_mismatch");
      const freshId = await queueVerified("producer");
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_notification_event_bindings WHERE notification_event_id='${freshId}'`)).toBe("1");
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${freshId}'`)).toBe("0");
      const releaseSql = `SELECT release.reason_code FROM public.notification_events notification
        CROSS JOIN LATERAL public.swell_watch_validate_notification_release(
          (notification.payload->>'regional_event_id')::uuid,(notification.payload->>'beach_id')::uuid,
          notification.recipient_user_id,(notification.payload->>'forecast_at')::timestamptz,notification.id) release
        WHERE notification.id='${freshId}'`;
      expect(databaseQuery(releaseSql)).toBe("allowed");
      const completionOwner = spawn("docker", ["exec", "-i", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"],
        { stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 });
      const completionClosed = new Promise<number | null>((resolve, reject) => {
        completionOwner.once("error", reject); completionOwner.once("close", resolve);
      });
      const completionReady = new Promise<void>((resolve, reject) => {
        let output = "";
        const timeout = setTimeout(() => reject(new Error("Completion lock did not become ready")), 10_000);
        completionOwner.once("close", () => { clearTimeout(timeout); reject(new Error("Completion transaction closed before readiness")); });
        completionOwner.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes("completion_ready")) { clearTimeout(timeout); resolve(); }
        });
      });
      try {
        completionOwner.stdin.write("BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('swell-watch-completed-provider-frontier',0)); SELECT 'completion_ready';\n");
        await completionReady;
        expect(databaseQuery(releaseSql)).toBe("provider_evidence_unavailable");
      } finally {
        completionOwner.stdin.end("ROLLBACK;\n");
        expect(await completionClosed).toBe(0);
      }
      expect(databaseQuery(releaseSql)).toBe("allowed");
      const delivered = await processPendingEvents(client as never, options);
      expect(delivered.by_status.sent).toBe(1);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      expect(fcm.sendEach).toHaveBeenCalledWith([expect.objectContaining({
        token: "fixture-only-token", data: expect.objectContaining({ target_partition: JSON.stringify(fixture.target_partition) }),
      })]);
      const sent = await client.from("notification_delivery_attempts").select("status").eq("notification_event_id", freshId);
      expect(sent.error).toBeNull();
      expect(sent.data).toEqual([{ status: "sent" }]);
      expect(databaseQuery(`SELECT attempt_number || ':' || sample_count || ':' || failure_count FROM public.swell_watch_provider_delivery_outcomes WHERE notification_event_id='${freshId}'`)).toBe("1:1:0");
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${freshId}'`)).toBe("1");
      const terminal = await client.from("notification_events").select("status,attempt_count").eq("id", freshId).single();
      expect(terminal.error).toBeNull();
      expect(terminal.data).toEqual({ status: "processed", attempt_count: 1 });
      expect((await processPendingEvents(client as never, options)).fetched).toBe(0);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      const retryEvent = await client.from("notification_events").select("payload,recipient_user_id").eq("id", freshId).single();
      expect(retryEvent.error).toBeNull();
      const retryArgs = {
        p_regional_event_id: retryEvent.data!.payload.regional_event_id, p_beach_id: fixture.beach_id,
        p_recipient_id: retryEvent.data!.recipient_user_id, p_forecast_at: retryEvent.data!.payload.forecast_at,
        p_notification_event_id: freshId,
      };
      const retries = await Promise.all([client.rpc("swell_watch_validate_notification_release", retryArgs), client.rpc("swell_watch_validate_notification_release", retryArgs)]);
      expect(retries.map((retry) => retry.error)).toEqual([null, null]);
      expect(retries.map((retry) => retry.data)).toEqual([
        [{ allowed: true, reason_code: "allowed", control_epoch: 9 }],
        [{ allowed: true, reason_code: "allowed", control_epoch: 9 }],
      ]);
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements`)).toBe("1");
      expect((await client.rpc("swell_watch_get_automation_control")).data).toEqual([{ state: "armed", epoch: 9, reason_code: "fixture_drill" }]);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      databaseQuery(`SELECT set_config('app.swell_watch_internal_write','on',false);
        INSERT INTO public.swell_watch_production_approval_authority
          (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        SELECT gen_random_uuid(),gen_random_uuid(),authority_epoch+1,'active',policy_hash,policy_provenance,jsonb_set(jsonb_set(policy_values,'{volume_caps,maximum_recipients_per_event}','2'::jsonb),'{volume_caps,maximum_projected_sends_per_window}','1000'::jsonb),approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at
        FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1`);
      const cappedSource = await client.from("notification_events").select("payload").eq("id", freshId).single();
      expect(cappedSource.error).toBeNull();
      const cappedPayload = cappedSource.data!.payload;
      const cappedRecipients = [randomUUID(), randomUUID()];
      for (const recipient of cappedRecipients) databaseQuery(`INSERT INTO auth.users(id,email) VALUES ('${recipient}','${recipient}@example.invalid')`);
      expect((await client.from("profiles").upsert(cappedRecipients.map((id, index) => ({ id, display_name: `Cap fixture ${index}`, home_beach_id: fixture.beach_id, notif_push_enabled: true, notif_forecast_alerts: true })))).error).toBeNull();
      expect((await client.from("user_devices").insert(cappedRecipients.map((user_id) => ({ user_id, platform: "ios", device_token: `fixture-${user_id}` })))).error).toBeNull();
      const cappedEvents = cappedRecipients.map((recipient_user_id) => ({ id: randomUUID(), recipient_user_id, type: "swell_watch", payload: cappedPayload }));
      expect((await client.from("notification_events").insert(cappedEvents)).error).toBeNull();
      const claims = await Promise.all(cappedEvents.map((event) => client.rpc("swell_watch_validate_notification_release", {
        p_regional_event_id: cappedPayload.regional_event_id, p_beach_id: fixture.beach_id, p_recipient_id: event.recipient_user_id,
        p_forecast_at: cappedPayload.forecast_at, p_notification_event_id: event.id,
      })));
      expect(claims.map((claim) => claim.error)).toEqual([null, null]);
      expect(claims.map((claim) => claim.data[0].reason_code).sort()).toEqual(["allowed", "recipient_cap_exceeded"]);
      expect(claims.map((claim) => claim.data[0].allowed).sort()).toEqual([false, true]);
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE regional_event_id='${cappedPayload.regional_event_id}'`)).toBe("2");
      const cappedControl = await client.rpc("swell_watch_get_automation_control");
      expect(cappedControl.error).toBeNull();
      expect(cappedControl.data).toEqual([{ state: "held", epoch: 10, reason_code: "recipient_cap_exceeded" }]);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      await transition("reset_shadow", 10, "shadow");
      await transition("arm", 11, "armed");
      databaseQuery(`SELECT set_config('app.swell_watch_internal_write','on',false);
        INSERT INTO public.swell_watch_production_approval_authority
          (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        SELECT gen_random_uuid(),gen_random_uuid(),authority_epoch+1,'active',policy_hash,policy_provenance,jsonb_set(policy_values,'{volume_caps,maximum_projected_sends_per_window}','3'::jsonb),approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at
        FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1`);
      // Disjoint beaches keep both run pairs current without serializing on a provider lock.
      const globalBeachId = randomUUID();
      databaseQuery(`INSERT INTO public.beaches(id,name,lat,lon) VALUES ('${globalBeachId}','Global cap fixture',21,-157);
        INSERT INTO public.favorite_beaches(user_id,beach_id,alerts_enabled) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${globalBeachId}',true)`);
      const globalIds = [await queueVerified(), await queueVerified(undefined, 12, globalBeachId)];
      const globalEvents = await client.from("notification_events").select("id,payload,recipient_user_id").in("id", globalIds);
      expect(globalEvents.error).toBeNull();
      expect(globalEvents.data).toHaveLength(2);
      expect(new Set(globalEvents.data!.map((event) => event.payload.regional_event_id)).size).toBe(2);
      expect(databaseQuery(`SELECT count(DISTINCT batch.issuance_id)
        FROM public.swell_watch_event_evaluations evaluation
        JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
        JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
        JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
        JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
        WHERE evaluation.regional_event_id IN (${globalEvents.data!.map((event) => `'${event.payload.regional_event_id}'`).join(",")})`)).toBe("4");
      expect(globalEvents.data!.every((event) => event.payload.regional_event_id !== cappedPayload.regional_event_id)).toBe(true);
      const globalClaims = await Promise.all(globalEvents.data!.map((event) => client.rpc("swell_watch_validate_notification_release", {
        p_regional_event_id: event.payload.regional_event_id, p_beach_id: event.payload.beach_id,
        p_recipient_id: event.recipient_user_id, p_forecast_at: event.payload.forecast_at, p_notification_event_id: event.id,
      })));
      expect(globalClaims.map((claim) => claim.error)).toEqual([null, null]);
      expect(globalClaims.map((claim) => claim.data[0].reason_code).sort()).toEqual(["allowed", "projected_send_cap_exceeded"]);
      expect(globalClaims.map((claim) => claim.data[0].allowed).sort()).toEqual([false, true]);
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements`)).toBe("3");
      for (const [index, event] of globalEvents.data!.entries()) {
        expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${event.id}'`)).toBe(globalClaims[index].data[0].allowed ? "1" : "0");
      }
      expect((await client.rpc("swell_watch_get_automation_control")).data).toEqual([{ state: "held", epoch: 13, reason_code: "projected_send_cap_exceeded" }]);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      await transition("reset_shadow", 13, "shadow");
      await transition("arm", 14, "armed");
      databaseQuery(`SELECT set_config('app.swell_watch_internal_write','on',false);
        INSERT INTO public.swell_watch_production_approval_authority
          (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        SELECT gen_random_uuid(),gen_random_uuid(),authority_epoch+1,'active',policy_hash,policy_provenance,jsonb_set(policy_values,'{volume_caps,maximum_projected_sends_per_window}','4'::jsonb),approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at
        FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1`);
      const enqueueArgs = globalEvents.data!.map((event) => ({ p_recipient_id: randomUUID(), p_payload: event.payload, p_expected_epoch: 15, p_policy_hash: releasePolicy.value_hash }));
      for (const args of enqueueArgs) databaseQuery(`INSERT INTO auth.users(id,email) VALUES ('${args.p_recipient_id}','${args.p_recipient_id}@example.invalid')`);
      for (const [override, reason] of [
        [{ p_expected_epoch: 14 }, "control_epoch_changed"],
        [{ p_policy_hash: "f".repeat(64) }, "authority_unavailable"],
        [{ p_payload: { ...enqueueArgs[0].p_payload, regional_event_id: "bad-id" } }, "invalid_payload"],
      ] as const) {
        const rejected = await client.rpc("swell_watch_enqueue_notification", { ...enqueueArgs[0], ...override });
        expect(rejected.error).toBeNull();
        expect(rejected.data).toEqual([{ enqueued: false, reason_code: reason, notification_event_id: null }]);
      }
      // A binding failure must roll back the queue row in the same transaction.
      databaseQuery(`CREATE FUNCTION public.fixture_reject_binding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture binding failure'; END $$;
        CREATE TRIGGER fixture_reject_binding BEFORE INSERT ON public.swell_watch_notification_event_bindings FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_binding()`);
      const rolledBack = await client.rpc("swell_watch_enqueue_notification", enqueueArgs[0]);
      expect(rolledBack.error?.message).toContain("fixture binding failure");
      expect(databaseQuery(`SELECT count(*) FROM public.notification_events WHERE recipient_user_id='${enqueueArgs[0].p_recipient_id}'`)).toBe("0");
      databaseQuery(`DROP TRIGGER fixture_reject_binding ON public.swell_watch_notification_event_bindings; DROP FUNCTION public.fixture_reject_binding()`);
      const reservations = await Promise.all(enqueueArgs.map((args) => client.rpc("swell_watch_enqueue_notification", args)));
      expect(reservations.map((reservation) => reservation.error)).toEqual([null, null]);
      expect(reservations.map((reservation) => reservation.data[0].reason_code).sort()).toEqual(["enqueued", "projected_send_cap_exceeded"]);
      expect(databaseQuery(`SELECT public.swell_watch_projected_send_count()`)).toBe("4");
      expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_recipient_announcements`)).toBe("3");
      for (const [index, args] of enqueueArgs.entries()) {
        expect(databaseQuery(`SELECT count(*) FROM public.notification_events WHERE recipient_user_id='${args.p_recipient_id}'`)).toBe(reservations[index].data[0].enqueued ? "1" : "0");
        expect(databaseQuery(`SELECT count(*) FROM public.swell_watch_notification_event_bindings WHERE recipient_id='${args.p_recipient_id}'`)).toBe(reservations[index].data[0].enqueued ? "1" : "0");
      }
      expect((await client.rpc("swell_watch_get_automation_control")).data).toEqual([{ state: "held", epoch: 16, reason_code: "projected_send_cap_exceeded" }]);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
    } finally {
      entry.channels = channels;
      if (flag === undefined) delete process.env.SWELL_WATCH_PUSH_ENABLED;
      else process.env.SWELL_WATCH_PUSH_ENABLED = flag;
    }
  }, 60_000);

  it("expires terminal reservations after 24 hours but retains unresolved and late-delivery budget", () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const cases = [
      { name: "recent_binding", age: "23 hours 59 minutes", status: "processed", expected: 1 },
      { name: "expired_binding", age: "24 hours 1 minute", status: "processed", expected: 0 },
      { name: "expired_failed", age: "25 hours", status: "failed", expected: 0 },
      { name: "expired_cancelled", age: "25 hours", status: "cancelled", expected: 0 },
      { name: "old_pending", age: "25 hours", status: "pending", expected: 1 },
      { name: "old_processing", age: "25 hours", status: "processing", expected: 1 },
      { name: "late_outcome", age: "25 hours", status: "processed", outcomeAge: "1 minute", expected: 1 },
      { name: "expired_outcome", age: "25 hours", status: "processed", outcomeAge: "24 hours 1 minute", expected: 0 },
      { name: "binding_and_claim", age: "1 minute", status: "processed", claimAge: "1 minute", expected: 1 },
      { name: "late_claim", age: "25 hours", status: "processed", claimAge: "1 minute", expected: 1 },
      { name: "expired_claim", age: "25 hours", status: "processed", claimAge: "24 hours 1 minute", expected: 0 },
      { name: "ownerless_claim", age: "25 hours", status: "processed", claimAge: "25 hours", ownerless: true, expected: 1 },
    ];
    const sql = `BEGIN;
      CREATE TEMP TABLE budget_results(name text, delta bigint, excluded_delta bigint) ON COMMIT DROP;
      DO $$
      DECLARE
        source public.swell_watch_notification_event_bindings%ROWTYPE;
        item jsonb;
        recipient uuid;
        notification uuid;
        before_count bigint;
      BEGIN
        SELECT * INTO STRICT source FROM public.swell_watch_notification_event_bindings ORDER BY created_at LIMIT 1;
        PERFORM set_config('app.swell_watch_internal_write','on',true);
        FOR item IN SELECT value FROM jsonb_array_elements('${JSON.stringify(cases)}'::jsonb) LOOP
          recipient := gen_random_uuid(); notification := gen_random_uuid();
          before_count := public.swell_watch_projected_send_count();
          INSERT INTO auth.users(id,email) VALUES (recipient, recipient::text || '@example.invalid');
          IF coalesce((item->>'ownerless')::boolean,false) IS NOT TRUE THEN
            INSERT INTO public.notification_events(id,recipient_user_id,type,payload,status)
            SELECT notification,recipient,'swell_watch',queued.payload,item->>'status'
            FROM public.notification_events queued WHERE queued.id=source.notification_event_id;
            INSERT INTO public.swell_watch_notification_event_bindings (
              notification_event_id,regional_event_id,beach_id,recipient_id,control_epoch,authority_id,
              authority_epoch,policy_hash,approval_evidence_hash,policy_provenance,policy_values,created_at
            ) VALUES (notification,source.regional_event_id,source.beach_id,recipient,source.control_epoch,
              source.authority_id,source.authority_epoch,source.policy_hash,source.approval_evidence_hash,
              source.policy_provenance,source.policy_values,clock_timestamp()-(item->>'age')::interval);
          END IF;
          IF item ? 'claimAge' THEN
            INSERT INTO public.swell_watch_recipient_announcements(id,regional_event_id,recipient_id,notification_event_id,claimed_at)
            VALUES (gen_random_uuid(),source.regional_event_id,recipient,
              CASE WHEN (item->>'ownerless')::boolean THEN NULL ELSE notification END,
              clock_timestamp()-(item->>'claimAge')::interval);
          END IF;
          IF item ? 'outcomeAge' THEN
            INSERT INTO public.swell_watch_provider_delivery_outcomes(id,notification_event_id,attempt_number,sample_count,failure_count,created_at)
            VALUES (gen_random_uuid(),notification,1,1,0,clock_timestamp()-(item->>'outcomeAge')::interval);
          END IF;
          INSERT INTO budget_results VALUES (item->>'name',public.swell_watch_projected_send_count()-before_count,
            public.swell_watch_projected_send_count(notification)-before_count);
        END LOOP;
      END $$;
      SELECT json_agg(budget_results ORDER BY name) FROM budget_results;
      ROLLBACK;`;
    const output = execFileSync("docker", ["exec", "-i", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"],
      { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    expect(JSON.parse(output)).toEqual(cases.map((item) => ({ name: item.name, delta: item.expected, excluded_delta: item.ownerless ? 1 : 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)));
  });

  it("waits for an uncommitted owner revocation and rejects enqueue after it commits", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const command = ["exec", "-i", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"];
    const query = (sql: string): string => execFileSync("docker", [...command, "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const recipient = randomUUID();
    query(`DO $$ DECLARE epoch integer; BEGIN
      PERFORM set_config('app.swell_watch_internal_write','on',true);
      INSERT INTO auth.users(id,email) VALUES ('${recipient}','${recipient}@example.invalid');
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      SELECT gen_random_uuid(),gen_random_uuid(),authority_epoch+1,'active',policy_hash,policy_provenance,
        jsonb_set(jsonb_set(policy_values,'{volume_caps,maximum_projected_sends_per_window}','5'::jsonb),'{volume_caps,maximum_recipients_per_event}','1000'::jsonb),
        approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at
      FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1;
      SELECT control.epoch INTO epoch FROM public.swell_watch_get_automation_control() control;
      PERFORM public.transition_swell_watch_automation_control('reset_shadow',epoch,'fixture_drill',gen_random_uuid()::text,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      PERFORM public.transition_swell_watch_automation_control('arm',epoch+1,'fixture_drill',gen_random_uuid()::text,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    END $$`);
    const context: { payload: object; epoch: number; policy_hash: string } = JSON.parse(query(`SELECT json_build_object(
      'payload',(SELECT queued.payload FROM public.notification_events queued JOIN public.swell_watch_notification_event_bindings binding ON binding.notification_event_id=queued.id ORDER BY binding.created_at LIMIT 1),
      'epoch',(SELECT epoch FROM public.swell_watch_get_automation_control()),
      'policy_hash',(SELECT policy_hash FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1))`));
    const rpc = `SELECT row_to_json(result) FROM public.swell_watch_enqueue_notification('${recipient}',
      '${JSON.stringify(context.payload).replace(/'/g, "''")}'::jsonb,${context.epoch},'${context.policy_hash}') result`;
    expect(JSON.parse(query(`BEGIN; SET ROLE service_role; ${rpc}; ROLLBACK;`))).toMatchObject({ enqueued: true, reason_code: "enqueued" });
    expect(query(`SELECT count(*) FROM public.notification_events WHERE recipient_user_id='${recipient}'`)).toBe("0");
    const owner = spawn("docker", command, { stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 });
    const closed = new Promise<number | null>((resolve, reject) => { owner.once("error", reject); owner.once("close", resolve); });
    let output = "";
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Owner revocation did not become ready")), 10_000);
      owner.once("close", () => { clearTimeout(timeout); reject(new Error("Owner transaction closed before readiness")); });
      owner.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes("revocation_ready")) { clearTimeout(timeout); resolve(); }
      });
    });
    let pending: Promise<string> | undefined;
    try {
      owner.stdin.write(`BEGIN; DO $$ BEGIN
        PERFORM set_config('app.swell_watch_internal_write','on',true);
        INSERT INTO public.swell_watch_production_approval_authority
          (record_id,authority_id,authority_epoch,state,revokes_authority_id,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
        SELECT gen_random_uuid(),gen_random_uuid(),authority_epoch+1,'revoked',authority_id,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at
        FROM public.swell_watch_production_approval_authority WHERE state='active' ORDER BY authority_epoch DESC LIMIT 1;
        END $$; SELECT 'revocation_ready';\n`);
      await ready;
      const applicationName = `phase26-enqueue-${randomUUID()}`;
      pending = new Promise<string>((resolve, reject) => {
        execFile("docker", [...command, "-c", `SET application_name='${applicationName}'; SET ROLE service_role; ${rpc}`], { timeout: 10_000, encoding: "utf8" },
          (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
      });
      void pending.catch(() => undefined);
      const deadline = Date.now() + 5000;
      let blocked = false;
      while (Date.now() < deadline && !blocked) {
        blocked = query(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${applicationName}' AND wait_event='advisory' AND cardinality(pg_blocking_pids(pid))>0`) === "1";
        if (!blocked) await new Promise<void>((resolve) => setImmediate(resolve));
      }
      expect(blocked).toBe(true);
      owner.stdin.end("COMMIT;\n\\q\n");
      expect(await closed).toBe(0);
      expect(JSON.parse(await pending)).toEqual({ enqueued: false, reason_code: "authority_unavailable", notification_event_id: null });
      expect(query(`SELECT count(*) FROM public.notification_events WHERE recipient_user_id='${recipient}'`)).toBe("0");
      expect(query(`SELECT count(*) FROM public.swell_watch_notification_event_bindings WHERE recipient_id='${recipient}'`)).toBe("0");
    } finally {
      if (!owner.stdin.writableEnded) owner.stdin.end("ROLLBACK;\n\\q\n");
      await closed;
      await pending?.catch(() => undefined);
    }
  }, 20_000);

  it("atomically selects regional identity and fails closed on ambiguity and evidence races", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Isolated database required");
    const command = ["exec", "-i", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"];
    const query = (sql: string): string => execFileSync("docker", [...command, "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const client = new PostgrestClient("http://127.0.0.1:55433", { fetch: (async (url: string, init: Parameters<typeof httpFetch>[1]) => {
      if (new URL(url).origin !== "http://127.0.0.1:55433") throw new Error("Nonlocal request prohibited");
      return httpFetch(url, init);
    }) as unknown as typeof fetch });
    const beaches = [randomUUID(), randomUUID()];
    const region = randomUUID();
    const attestation = randomUUID();
    query(`BEGIN; SELECT set_config('app.swell_watch_internal_write','on',true);
      INSERT INTO public.beaches(id,name,lat,lon) VALUES ${beaches.map((id) => `('${id}','identity-${id}',21,-157)`).join(",")};
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      VALUES(gen_random_uuid(),gen_random_uuid(),(SELECT max(authority_epoch)+1 FROM public.swell_watch_production_approval_authority),'active',
        '${fixturePolicy.value_hash}','production_approved','${JSON.stringify(fixturePolicy.policy_values)}','identity-fixture',repeat('a',64),'swell_watch_push','fixture-only',now()-interval '1 hour',now()+interval '1 hour'); COMMIT;`);
    const scopes = `public.fixture_provider_run_scopes('1990-01-01T00:00Z',1,1,ARRAY[${beaches.map((id) => `'${id}'::uuid`).join(",")}])`;
    const revision = query(`SELECT revision_set_id FROM public.record_swell_watch_provider_run_receipt(${scopes})`);
    query(`SELECT public.attest_swell_watch_provider_run('${attestation}','${revision}','accepted','fixture',repeat('a',64),'fixture-only')`);
    const batch = query(`SELECT provider_batch_id FROM public.complete_swell_watch_provider_run_receipt('${revision}')`);
    const args = {
      p_provider_batch_id: batch, p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_source_point_id: beaches[0],
      p_region_key: region, p_physical_key: "alias-only", p_forecast_at: "1990-01-01T00:00Z", p_source_slot: "s1",
      p_height_m: 1, p_period_s: 12, p_direction_deg: 170, p_projected_face_height_ft: 2,
      p_policy_id: "fixture", p_policy_hash: fixturePolicy.value_hash, p_impact_hash: "b".repeat(64),
      p_arrival_at: "1990-01-02T00:00Z", p_peak_at: "1990-01-02T06:00Z",
    };
    const resolve = async (input: typeof args) => await client.rpc("resolve_and_ingest_swell_watch_evaluation", input);
    const allocations = await Promise.all([args, { ...args, p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_source_point_id: beaches[1] }].map(resolve));
    expect(allocations.map((result) => result.error)).toEqual([null, null]);
    const canonical = allocations[0].data![0].regional_event_id as string;
    expect(allocations.map((result) => result.data)).toEqual([
      [{ regional_event_id: canonical, event_state: "candidate" }], [{ regional_event_id: canonical, event_state: "candidate" }],
    ]);
    expect(query(`SELECT count(*) FROM public.swell_watch_regional_events WHERE region_key='${region}'`)).toBe("1");
    expect(query(`SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id='${canonical}'`)).toBe("1");
    expect(query(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id='${canonical}'`)).toBe("2");
    expect((await resolve({ ...args, p_observation_id: randomUUID(), p_impact_id: randomUUID() })).data).toEqual(allocations[0].data);
    expect((await resolve({ ...args, p_period_s: 99 })).error?.message).toBe("identity input does not match attested component");
    expect((await resolve({ ...args, p_policy_hash: "f".repeat(64) })).error?.message).toBe("current matching policy authority is required");

    const distinct = await resolve({ ...args, p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_forecast_at: "1990-01-01T01:00Z",
      p_arrival_at: "1990-01-05T00:00Z", p_peak_at: "1990-01-05T06:00Z" });
    expect(distinct.error).toBeNull();
    expect(distinct.data![0].regional_event_id).not.toBe(canonical);
    expect(query(`DO $$ DECLARE inserted_after timestamptz := clock_timestamp(); BEGIN
      PERFORM public.append_swell_watch_state_transition(gen_random_uuid(),'${distinct.data![0].regional_event_id}',0,'candidate','fixture-clock');
      IF (SELECT created_at FROM public.swell_watch_event_state_transitions WHERE regional_event_id='${distinct.data![0].regional_event_id}') < inserted_after THEN
        RAISE EXCEPTION 'transition used transaction start instead of insertion time';
      END IF;
    END $$; SELECT 'insertion-clock-pass';`)).toBe("insertion-clock-pass");
    const otherRegion = randomUUID();
    const other = await resolve({ ...args, p_region_key: otherRegion, p_observation_id: randomUUID(), p_impact_id: randomUUID() });
    expect(other.error).toBeNull();
    expect(other.data![0].regional_event_id).not.toBe(canonical);
    const otherId = other.data![0].regional_event_id as string;
    const conflictingId = randomUUID();
    const legacy = await client.rpc("ingest_verified_swell_watch_evaluation", {
      ...args, p_regional_event_id: conflictingId, p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_forecast_at: "1990-01-01T02:00Z",
    });
    expect(legacy.error).toBeNull();
    const countBefore = query("SELECT count(*) FROM public.swell_watch_observations");
    expect((await resolve({ ...args, p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_forecast_at: "1990-01-01T03:00Z" })).error?.message).toBe("ambiguous regional identity");
    expect(query("SELECT count(*) FROM public.swell_watch_observations")).toBe(countBefore);
    expect(query(`SELECT bool_and(has_function_privilege(role_name,p.oid,'EXECUTE')=(role_name='service_role'))
      FROM pg_proc p CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) roles(role_name)
      WHERE p.proname='resolve_and_ingest_swell_watch_evaluation'`)).toBe("t");

    const race = async (mutation: string, input: typeof args, expected: string, statement?: string): Promise<void> => {
      const owner = spawn("docker", command, { stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 });
      const closed = new Promise<number | null>((done, reject) => { owner.once("error", reject); owner.once("close", done); });
      let output = "";
      const ready = new Promise<void>((done, reject) => {
        const timer = setTimeout(() => reject(new Error("Identity race owner not ready")), 10_000);
        owner.once("close", () => { clearTimeout(timer); reject(new Error("Owner exited before ready")); });
        owner.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes("identity_ready")) { clearTimeout(timer); done(); }
        });
      });
      let pending: Promise<{ error: Error | null; stderr: string }> | undefined;
      try {
        owner.stdin.write(`BEGIN; ${mutation}; SELECT 'identity_ready';\n`);
        await ready;
        const application = `identity-${randomUUID()}`;
        const parameters = Object.values(input).map((value) => typeof value === "number" ? String(value) : `'${value.replace(/'/g, "''")}'`).join(",");
        pending = new Promise((done) => execFile("docker", [...command, "-c", `SET application_name='${application}'; SET ROLE service_role;
          ${statement ?? `SELECT * FROM public.resolve_and_ingest_swell_watch_evaluation(${parameters})`}`], { timeout: 10_000, encoding: "utf8" },
        (error, _stdout, stderr) => done({ error, stderr })));
        let blocked = false;
        const deadline = Date.now() + 5000;
        while (!blocked && Date.now() < deadline) {
          blocked = query(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${application}' AND wait_event='advisory' AND cardinality(pg_blocking_pids(pid))>0`) === "1";
          if (!blocked) await new Promise<void>((done) => setImmediate(done));
        }
        expect(blocked).toBe(true);
        owner.stdin.end("COMMIT;\n\\q\n");
        expect(await closed).toBe(0);
        const result = await pending;
        expect(result.error).not.toBeNull();
        expect(result.stderr).toContain(expected);
        expect(query("SELECT count(*) FROM public.swell_watch_observations")).toBe(countBefore);
      } finally {
        if (!owner.stdin.writableEnded) owner.stdin.end("ROLLBACK;\n\\q\n");
        await closed;
        await pending;
      }
    };
    const fresh = { ...args, p_region_key: otherRegion, p_observation_id: randomUUID(), p_impact_id: randomUUID(), p_forecast_at: "1990-01-01T03:00Z" };
    await race(`SELECT public.append_swell_watch_state_transition(gen_random_uuid(),'${otherId}',0,'suppressed','fixture-race')`, fresh,
      "compatible regional identity requires current-cycle evidence");
    await race(`SELECT public.attest_swell_watch_provider_run(gen_random_uuid(),'${revision}','revoked','fixture',repeat('b',64),'fixture-only','${attestation}')`,
      { ...fresh, p_region_key: randomUUID() }, "current provider attestation is required");
    const reaccepted = randomUUID();
    query(`SELECT public.attest_swell_watch_provider_run('${reaccepted}','${revision}','accepted','fixture',repeat('c',64),'fixture-only')`);
    const demandBefore = query("SELECT count(*) FROM public.swell_watch_shadow_demand_runs");
    await race(`SELECT public.attest_swell_watch_provider_run(gen_random_uuid(),'${revision}','revoked','fixture',repeat('d',64),'fixture-only','${reaccepted}')`,
      fresh, "current shadow policy and provider evidence required",
      `SELECT * FROM public.record_swell_watch_shadow_demand('${batch}','${fixturePolicy.value_hash}','[]'::jsonb)`);
    expect(query("SELECT count(*) FROM public.swell_watch_shadow_demand_runs")).toBe(demandBefore);
    query(`SELECT public.attest_swell_watch_provider_run(gen_random_uuid(),'${revision}','accepted','fixture',repeat('e',64),'fixture-only')`);
    await race(`SELECT * FROM public.record_swell_watch_provider_run_receipt(${scopes.replace("00:00Z',1,1", "00:00Z',1.1,1")})`,
      { ...fresh, p_region_key: randomUUID() }, "current provider attestation is required");
  }, 45_000);
  it("derives each stored full-horizon fixture before verified ingestion and one recording-only delivery", async () => {
    if (process.env.PHASE26_WORKER_DRILL !== "local") throw new Error("Run only against the isolated Phase 26 worker database");
    const client = new PostgrestClient("http://127.0.0.1:55433", { fetch: (async (url: string, init: Parameters<typeof httpFetch>[1]) => {
      if (new URL(url).origin !== "http://127.0.0.1:55433") throw new Error("Nonlocal request prohibited");
      return httpFetch(url, init);
    }) as unknown as typeof fetch });
    const rpc = async (name: string, args: object) => await client.rpc(name, args);
    const query = (sql: string): string => execFileSync("docker", ["exec", "supabase_db_phase26-worker-drill", "psql", "-U", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const beachId = randomUUID();
    const neighborId = randomUUID();
    const neighborRegion = randomUUID();
    const recipientId = randomUUID();
    const regionKey = randomUUID();
    const now = new Date();
    const hour = 3_600_000;
    const currentIssued = Math.floor(now.getTime() / (6 * hour)) * 6 * hour;
    const iso = (time: number): string => new Date(time).toISOString();
    const arrivalAt = iso(currentIssued + 72 * hour);
    const peakAt = iso(currentIssued + 75 * hour);
    query(`INSERT INTO public.beaches(id,name,lat,lon,swell_window_center_deg,swell_window_halfwidth_deg,timezone) VALUES('${beachId}','Derived ${beachId}',32.8,-117.3,170,30,'America/Los_Angeles'),('${neighborId}','Cohort neighbor ${neighborId}',32.8,-117.3,170,30,'America/Los_Angeles')`);
    const configured = [{ sourcePointId: beachId, regionKey }, { sourcePointId: neighborId, regionKey: neighborRegion }];
    const acquisitionScopes = await loadSwellWatchAcquisitionScope(configured, client as never);
    const beach = acquisitionScopes[0].beach;
    expect(acquisitionScopes.map((scope) => scope.sourcePointId)).toEqual([beachId, neighborId]);
    query(`UPDATE public.beaches SET is_private=true WHERE id='${neighborId}'`);
    await expect(loadSwellWatchAcquisitionScope(configured, client as never))
      .rejects.toThrow("differs from configured cohort");
    query(`UPDATE public.beaches SET is_private=false,owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' WHERE id='${neighborId}'`);
    await expect(loadSwellWatchAcquisitionScope(configured, client as never))
      .rejects.toThrow("differs from configured cohort");
    query(`UPDATE public.beaches SET owner_id=NULL WHERE id='${neighborId}'`);
    expect((await loadSwellWatchAcquisitionScope(configured, client as never)).map((scope) => scope.sourcePointId))
      .toEqual([beachId, neighborId]);
    await expect(loadSwellWatchAcquisitionScope([...configured, { sourcePointId: randomUUID(), regionKey }], client as never))
      .rejects.toThrow("differs from configured cohort");
    const storedRuns: Array<Awaited<ReturnType<typeof completeAttestedProviderRun>>> = [];
    const runs = [];
    for (const [index, issued] of [currentIssued - 6 * hour, currentIssued].entries()) {
      const runUtc = iso(issued).slice(0, 16) + "Z";
      const time = Array.from({ length: 168 }, (_, slot) => iso(issued + slot * hour).slice(0, 16));
      const fields = { swell_wave_height: 0.3, swell_wave_period: 9, swell_wave_direction: 260,
        secondary_swell_wave_height: index === 0 ? 0.35 : 0.25, secondary_swell_wave_period: 13, secondary_swell_wave_direction: 170 };
      const raw = JSON.stringify({ latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0, timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0,
        hourly_units: { time: "iso8601", ...Object.fromEntries(Object.keys(fields).map((field) => [field, field.endsWith("height") ? "m" : field.endsWith("period") ? "s" : "°"])) },
        hourly: { time, ...Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, time.map((slot) => {
          const validAt = Date.parse(`${slot}Z`);
          if (field === "secondary_swell_wave_height" && validAt >= Date.parse(arrivalAt) && validAt <= currentIssued + 78 * hour) {
            return validAt === Date.parse(peakAt) ? 1.8 : 1.2;
          }
          return value;
        })])) } });
      const stored = await acquireProviderRunReceipts({ runUtc, forecastDays: 7, scopes: acquisitionScopes },
        async () => ({ status: 200, text: async () => raw }), { rpc });
      query(`SELECT public.attest_swell_watch_provider_run('${randomUUID()}','${stored.revisionSetId}','accepted','fixture-only',repeat('a',64),'fixture-only')`);
      const completed = await completeAttestedProviderRun(stored, { rpc });
      storedRuns.push(completed);
      const expectedScope = { providerBatchId: completed.providerBatchId, forecastDays: 7,
        scopes: acquisitionScopes };
      expect(await loadAttestedProviderRunScope(expectedScope, { rpc })).toMatchObject({
        evaluationId: completed.evaluationId, expectedComponentCount: 672,
        scopes: expect.arrayContaining(acquisitionScopes.map(({ sourcePointId, latitude, longitude }) =>
          ({ sourcePointId, latitude, longitude, forecastDays: 7 }))),
      });
      await expect(loadAttestedProviderRunScope({ ...expectedScope, scopes: [...expectedScope.scopes,
        { ...expectedScope.scopes[0], sourcePointId: randomUUID() }] }, { rpc }))
        .rejects.toThrow("differs from expected coverage");
      const attested = await loadAttestedSwellWatchRun({ providerBatchId: completed.providerBatchId, sourcePointId: beachId }, { rpc });
      expect(attested.samples).toHaveLength(168);
      expect(attested.source.evaluationId).toBe(completed.evaluationId);
      expect(Date.parse(attested.source.issuedAt)).toBe(issued);
      const { provider, model, sourcePointId, issuedAt } = attested.source;
      const source = { provider, model, sourcePointId, issuedAt };
      const samples = attested.samples.map((sample) => ({ forecastAt: sample.forecastAt,
        components: sample.components.map(({ sourceSlot, heightM, periodS, directionDeg }) => ({
          sourceSlot, heightM, periodS, directionDeg, fieldSources: { height: source, period: source, direction: source },
        })) }));
      runs.push({ source, forecastDays: attested.forecastDays, samples });
    }
    const derived = deriveSwellWatchFixture({ provenance: "synthetic_fixture", now: now.toISOString(), policy: fixturePolicy,
      beach: { swell_window_center_deg: beach.swell_window_center_deg, swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg }, runs });
    expect(query("SELECT has_function_privilege('anon','public.read_swell_watch_run_scope(uuid)','EXECUTE'),has_function_privilege('authenticated','public.read_swell_watch_run_scope(uuid)','EXECUTE'),has_function_privilege('service_role','public.read_swell_watch_run_scope(uuid)','EXECUTE')")).toBe("f|f|t");
    expect(derived).toMatchObject({ kind: "derived", productionApproved: false, qualifyingEvaluationCount: 0,
      events: [{ arrivalAt, peakAt, confidence: 1 }],
      evaluations: [{ baseline: { heightFt: 1.1483 } }, { baseline: { heightFt: 0.8202 } }] });
    if (derived.kind !== "derived" || derived.events.length !== 1 || derived.events[0].confidence === null) throw new Error("Full horizon did not derive a unique fixture episode");
    const releasePolicy: SwellWatchPolicy = { ...fixturePolicy as SwellWatchPolicy, schema_version: "swell-watch-policy.v2", provenance: "production_approved",
      policy_values: { ...fixturePolicy.policy_values, volume_caps: { ...fixturePolicy.policy_values.volume_caps, projected_send_window_hours: 24 } },
      approval_evidence: { approval_id: "derived-fixture", evidence_hash: "e".repeat(64), reviewer: "fixture-only", reviewed_at: now.toISOString() } };
    releasePolicy.value_hash = calculateSwellWatchPolicyHash(releasePolicy);
    const currentDerivation = await deriveAttestedSwellWatchRun({
      providerBatchId: storedRuns[1].providerBatchId, sourcePointId: beachId,
      now: now.toISOString(), beach, policy: releasePolicy,
    }, { rpc });
    expect(currentDerivation).toMatchObject({ kind: "derived",
      source: { evaluationId: storedRuns[1].evaluationId },
      baseline: derived.evaluations[1].baseline,
      events: [{ arrivalAt, peakAt, confidence: null,
        impact: { partition: { evaluationId: storedRuns[1].evaluationId }, policyHash: releasePolicy.value_hash } }] });
    if (currentDerivation.kind !== "derived" || currentDerivation.events.length !== 1) {
      throw new Error("Attested horizon did not derive the expected episode");
    }
    query(`BEGIN; SELECT set_config('app.swell_watch_internal_write','on',true);
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      SELECT gen_random_uuid(),gen_random_uuid(),COALESCE(max(authority_epoch),0)+1,'active','${releasePolicy.value_hash}','production_approved',
        '${JSON.stringify(releasePolicy.policy_values)}','derived-fixture',repeat('e',64),'swell_watch_push','fixture-only',now()-interval '1 hour',now()+interval '1 hour'
      FROM public.swell_watch_production_approval_authority;
      INSERT INTO auth.users(id) VALUES('${recipientId}');
      INSERT INTO public.profiles(id,display_name,timezone,notif_push_enabled,notif_forecast_alerts) VALUES('${recipientId}','Derived fixture','UTC',true,true);
      INSERT INTO public.user_devices(user_id,platform,device_token) VALUES('${recipientId}','ios','derived-fixture-token');
      INSERT INTO public.favorite_beaches(user_id,beach_id,alerts_enabled) VALUES('${recipientId}','${beachId}',true);
      COMMIT;`);
    for (const operation of ["hold", "reset_shadow", "arm"]) {
      const control = await client.rpc("swell_watch_get_automation_control");
      expect(control.error).toBeNull();
      expect((await client.rpc("transition_swell_watch_automation_control", { p_operation: operation, p_expected_epoch: control.data[0].epoch,
        p_reason_code: "fixture_drill", p_idempotency_key: randomUUID(), p_actor_user_id: recipientId })).error).toBeNull();
    }
    let regionalId = "";
    const priorDerivation = await deriveAttestedSwellWatchRun({ providerBatchId: storedRuns[0].providerBatchId,
      sourcePointId: beachId, now: iso(currentIssued - 6 * hour), beach, policy: releasePolicy }, { rpc });
    if (priorDerivation.kind !== "derived") throw new Error("Prior attested fixture did not derive");
    for (const [index, evaluation] of [priorDerivation].entries()) {
      const event = evaluation.events[0];
      const impact = await ingestAttestedSwellWatchImpact({ providerBatchId: storedRuns[index].providerBatchId, sourcePointId: beachId,
        observationId: randomUUID(), impactId: randomUUID(), regionKey, physicalKey: regionKey,
        forecastAt: event.peakAt, sourceSlot: event.impact.partition.sourceSlot, peakAt: event.peakAt,
        impact: { baselineHeightFt: evaluation.baseline.heightFt, baselineEnergy: evaluation.baseline.energy, arrivalAt: event.arrivalAt,
          now, beach, policy: releasePolicy, seamContinuous: true, sourceCoherent: true },
      }, { rpc, from: client.from.bind(client) as never });
      expect(impact).toMatchObject({ kind: "candidate", arrivalAt, projectedFaceHeightFt: event.impact.projectedFaceHeightFt,
        heightRiseFt: event.impact.heightRiseFt, energyRatio: event.impact.energyRatio });
      if (impact.kind !== "candidate") throw new Error("Derived fixture failed verified ingestion");
      if (regionalId && impact.regionalEventId !== regionalId) throw new Error("Derived runs allocated different regional identities");
      regionalId = impact.regionalEventId;
    }
    const ingestionInput = { providerBatchId: storedRuns[1].providerBatchId, sourcePointId: beachId,
      now: now.toISOString(), beach, policy: releasePolicy, regionKey };
    const ingestionClient = { rpc, from: client.from.bind(client) as never };
    const failSecondImpact = {
      ...ingestionClient,
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name !== "ingest_swell_watch_run") return rpc(name, args);
        const impacts = args.p_impacts as Record<string, string | number>[];
        return rpc(name, { p_impacts: [impacts[0], { ...impacts[0], p_height_m: 99 }] });
      },
    };
    await expect(ingestAttestedSwellWatchRun(ingestionInput, failSecondImpact))
      .rejects.toThrow("identity input does not match attested component");
    expect(query(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id='${regionalId}' AND beach_id='${beachId}'`)).toBe("1");
    expect(query(`SELECT count(*) FROM public.swell_watch_event_state_transitions WHERE regional_event_id='${regionalId}'`)).toBe("0");
    const cohortInput = { providerBatchId: storedRuns[1].providerBatchId, forecastDays: 7,
      now: now.toISOString(), policy: releasePolicy,
      scopes: acquisitionScopes };
    expect(query("SELECT has_function_privilege('anon','public.ingest_swell_watch_cohort(jsonb)','EXECUTE'),has_function_privilege('authenticated','public.ingest_swell_watch_cohort(jsonb)','EXECUTE'),has_function_privilege('service_role','public.ingest_swell_watch_cohort(jsonb)','EXECUTE')")).toBe("f|f|t");
    const failNeighbor = { ...ingestionClient, rpc: async (name: string, args: Record<string, unknown>) => {
      if (name !== "ingest_swell_watch_cohort") return rpc(name, args);
      const impacts = args.p_impacts as Record<string, string | number>[];
      return rpc(name, { p_impacts: [impacts[0], { ...impacts[1], p_height_m: 99 }] });
    } };
    await expect(ingestAttestedSwellWatchCohort(cohortInput, failNeighbor))
      .rejects.toThrow("identity input does not match attested component");
    expect(query(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE beach_id IN ('${beachId}','${neighborId}')`)).toBe("1");
    expect(query(`SELECT count(*) FROM public.swell_watch_event_state_transitions WHERE regional_event_id='${regionalId}'`)).toBe("0");
    query(`BEGIN; SELECT set_config('app.swell_watch_internal_write','on',true);
      INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
      VALUES(1,'active','${releasePolicy.value_hash}','${JSON.stringify(releasePolicy.policy_values)}','fixture-only',repeat('e',64),now()-interval '1 hour',now()+interval '1 hour');
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,revokes_authority_id,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      SELECT gen_random_uuid(),gen_random_uuid(),(SELECT max(authority_epoch)+1 FROM public.swell_watch_production_approval_authority),
        'revoked',a.authority_id,a.policy_hash,a.policy_provenance,a.policy_values,a.approval_id,a.approval_evidence_hash,a.production_scope,a.reviewer,a.not_before,a.expires_at
      FROM public.swell_watch_get_production_authority() a; COMMIT;`);
    for (const operation of ["hold", "reset_shadow"]) {
      const control = await client.rpc("swell_watch_get_automation_control");
      expect((await client.rpc("transition_swell_watch_automation_control", { p_operation: operation,
        p_expected_epoch: control.data[0].epoch, p_reason_code: "fixture_shadow", p_idempotency_key: randomUUID(),
        p_actor_user_id: recipientId })).error).toBeNull();
    }
    const ledgerState = (): string => query(`SELECT jsonb_build_object(
      'queue',(SELECT count(*) FROM public.notification_events),
      'bindings',(SELECT count(*) FROM public.swell_watch_notification_event_bindings),
      'announcements',(SELECT count(*) FROM public.swell_watch_recipient_announcements),
      'attempts',(SELECT count(*) FROM public.notification_delivery_attempts),
      'control',(SELECT to_jsonb(c) FROM public.swell_watch_get_automation_control() c),
      'authority',(SELECT count(*) FROM public.swell_watch_production_approval_authority))`);
    const beforeShadow = ledgerState();
    expect(query("SELECT state FROM public.swell_watch_get_automation_control()")).toBe("shadow");
    expect(query("SELECT revoked_at IS NOT NULL FROM public.swell_watch_get_production_authority()")).toBe("t");
    const shadowEnvironment = process.env;
    const clientFactory = jest.mocked(createSupabaseServiceRoleClient);
    const originalClientFactory = clientFactory.getMockImplementation();
    try {
      process.env = { ...shadowEnvironment, SWELL_WATCH_PUSH_ENABLED: "false", SWELL_WATCH_ENABLED: "false",
        SWELL_WATCH_SHADOW_EVALUATION_ENABLED: "true", CRON_SECRET: "local-drill-secret",
        SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ policy: releasePolicy, cohort: configured }) };
      clientFactory.mockReturnValue(client as never);
      await expect(loadSwellWatchDeliveryHealth(releasePolicy.value_hash, { rpc })).rejects.toThrow("current delivery policy authority");
      const impactCount = (): string => query(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE beach_id IN ('${beachId}','${neighborId}')`);
      expect(impactCount()).toBe("1");
      const callback = async (): Promise<Response> => evaluateShadowCallback(new Request("http://localhost/api/cron/swell-watch-evaluate", {
        method: "POST", headers: { Authorization: "Bearer local-drill-secret", "Content-Type": "application/json" },
        body: JSON.stringify({ provider_batch_id: storedRuns[1].providerBatchId }),
      }));
      const response = await callback();
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
      const { data: shadow } = await response.json();
      expect(shadow).toMatchObject({ status: "evaluated", evaluationIds: [storedRuns[1].evaluationId],
        policyHash: releasePolicy.value_hash, candidateCount: 2, stableRegionalEventCount: 1,
        preSafetyRecipientsThisEvaluation: 1, sendEligibility: "not_evaluated",
        projectedSendsRolling24Hours: null, deliveryHealth: null, enqueued: 0 });
      expect(JSON.stringify(shadow)).not.toContain(recipientId);
      expect(shadow.recordedDemand).toEqual({ observedAt: expect.any(String), recipientEventPairs24Hours: 1 });
      expect(JSON.stringify(shadow)).not.toContain(beachId);
      expect(impactCount()).toBe("3");
      expect(await evaluateSwellWatchShadow(cohortInput, client as never)).toEqual(shadow);
      const repeated = await callback();
      expect(repeated.status).toBe(200);
      expect((await repeated.json()).data).toEqual(shadow);
      expect(impactCount()).toBe("3");
      expect(ledgerState()).toBe(beforeShadow);
    } finally {
      process.env = shadowEnvironment;
      clientFactory.mockReset();
      if (originalClientFactory) clientFactory.mockImplementation(originalClientFactory);
    }
    const cohort = await ingestAttestedSwellWatchCohort(cohortInput, ingestionClient);
    expect(cohort).toMatchObject({ kind: "ingested", runs: [
      { source: { sourcePointId: beachId }, events: [{ impact: { regionalEventId: regionalId, eventState: "stable" } }] },
      { source: { sourcePointId: neighborId }, events: [{ impact: { eventState: "candidate" } }] },
    ] });
    if (cohort.kind !== "ingested") throw new Error("Cohort was suppressed");
    const [retry, reversed] = await Promise.all([
      ingestAttestedSwellWatchCohort(cohortInput, ingestionClient),
      ingestAttestedSwellWatchCohort({ ...cohortInput, scopes: [...cohortInput.scopes].reverse() }, ingestionClient),
    ]);
    expect(retry).toEqual(cohort);
    expect(reversed).toEqual({ ...cohort, runs: [...cohort.runs].reverse() });
    const ingested = cohort.runs[0];
    expect(ingested).toMatchObject({ kind: "ingested", source: { evaluationId: storedRuns[1].evaluationId },
      events: [{ arrivalAt, peakAt, impact: { regionalEventId: regionalId, eventState: "stable",
        heightRiseFt: currentDerivation.events[0].impact.heightRiseFt,
        energyRatio: currentDerivation.events[0].impact.energyRatio } }] });
    expect(await ingestAttestedSwellWatchRun(ingestionInput, ingestionClient)).toEqual(ingested);
    expect(query(`SELECT count(*) FROM public.swell_watch_event_impacts WHERE regional_event_id='${regionalId}' AND beach_id='${beachId}'`)).toBe("2");
    const history = await loadSwellWatchHistory({ regionKey, beachId }, { rpc, from: client.from.bind(client) as never });
    expect(history).toHaveLength(2);
    const regionalEvent = matchRegionalSwellEvent(history, releasePolicy, { persistedEvents: history.map((reference) => {
      if (!reference.persistedRegionalEventId) throw new Error("Missing persisted identity");
      return { regionalEventId: reference.persistedRegionalEventId, regionKey, aliases: [], reference };
    }) });
    expect(regionalEvent).toMatchObject({ regionalEventId: regionalId, status: "stable" });
    const part = derived.events[0].impact.partition;
    const matchedHistory = await loadMatchedSwellWatchHistory({ regionKey, beachId,
      regionalEventId: regionalId, evaluationId: storedRuns[1].evaluationId, policy: releasePolicy }, ingestionClient);
    expect(matchedHistory).toMatchObject({ regionalEvent: { regionalEventId: regionalId, status: "stable",
      evaluationIds: storedRuns.map((run) => run.evaluationId).sort() }, confidence: 1 });
    if (matchedHistory.confidence === null) throw new Error("Persisted consistency is missing");
    // Restore fixture release authority only for the pre-existing recording-transport test.
    query(`BEGIN; SELECT set_config('app.swell_watch_internal_write','on',true);
      INSERT INTO public.swell_watch_production_approval_authority
        (record_id,authority_id,authority_epoch,state,policy_hash,policy_provenance,policy_values,approval_id,approval_evidence_hash,production_scope,reviewer,not_before,expires_at)
      SELECT gen_random_uuid(),gen_random_uuid(),(SELECT max(authority_epoch)+1 FROM public.swell_watch_production_approval_authority),
        'active',a.policy_hash,a.policy_provenance,a.policy_values,a.approval_id,a.approval_evidence_hash,a.production_scope,a.reviewer,a.not_before,a.expires_at
      FROM public.swell_watch_get_production_authority() a; COMMIT;`);
    const shadowControl = await client.rpc("swell_watch_get_automation_control");
    expect((await client.rpc("transition_swell_watch_automation_control", { p_operation: "arm",
      p_expected_epoch: shadowControl.data[0].epoch, p_reason_code: "fixture_drill", p_idempotency_key: randomUUID(),
      p_actor_user_id: recipientId })).error).toBeNull();
    const deliveryHealth = await loadSwellWatchDeliveryHealth(releasePolicy.value_hash, { rpc });
    expect(query("SELECT has_function_privilege('anon','public.read_swell_watch_delivery_health(text)','EXECUTE'),has_function_privilege('authenticated','public.read_swell_watch_delivery_health(text)','EXECUTE'),has_function_privilege('service_role','public.read_swell_watch_delivery_health(text)','EXECUTE')")).toBe("f|f|t");
    await expect(loadSwellWatchDeliveryHealth("0".repeat(64), { rpc })).rejects.toThrow("current delivery policy authority");
    const payload = { type: "swell_watch", schema_version: "swell-watch-notification.v2", regional_event_id: regionalId, beach_id: beachId, forecast_at: part.forecastAt,
      arrival_at: derived.events[0].arrivalAt, peak_at: derived.events[0].peakAt,
      target_partition: { height_m: part.heightM, period_s: part.periodS, direction_deg: part.directionDeg } };
    const channels = NOTIFICATION_REGISTRY.swell_watch.channels;
    const flag = process.env.SWELL_WATCH_PUSH_ENABLED;
    const fcm = { sendEach: jest.fn(async () => ({ successCount: 1, failureCount: 0, responses: [{ success: true }] })) };
    try {
      process.env.SWELL_WATCH_PUSH_ENABLED = "true";
      NOTIFICATION_REGISTRY.swell_watch.channels = ["push"] as never;
      const diagnostics = createSwellWatchObservability();
      expect(await enqueueAttestedSwellWatchCohort(cohortInput, client as never, diagnostics)).toEqual({ enqueued: 1, duplicates: 0, stoppedReason: null });
      expect(diagnostics.snapshot()).toMatchObject({ stageCounts: { detection: 2, suppression: 1, consolidation: 1, audience: 1, enqueue: 1 },
        correlations: expect.arrayContaining([{ evaluationId: storedRuns[1].evaluationId, regionalEventId: regionalId }]) });
      expect(JSON.stringify(diagnostics.snapshot())).not.toContain(recipientId);
      expect(JSON.stringify(diagnostics.snapshot())).not.toContain(beachId);
      expect(await enqueueAttestedSwellWatchCohort(cohortInput, client as never)).toEqual({ enqueued: 0, duplicates: 1, stoppedReason: null });
      const queued = await client.from("notification_events").select("id,payload").eq("payload->>regional_event_id", regionalId).single();
      expect(queued.error).toBeNull();
      if (!queued.data) throw new Error("Derived event was not queued");
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
      expect(queued.data.payload).toEqual({ ...payload, kind: "v2", title: "Swell incoming.",
        copy_context: { beach_timezone: "America/Los_Angeles" },
        body: `Productivity has been cancelled. Arrives ${weekday.format(new Date(payload.arrival_at))}. Peaks ${weekday.format(new Date(payload.peak_at))}.` });
      expect(query(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${queued.data.id}'`)).toBe("0");
      const workerNow = new Date(now);
      workerNow.setUTCHours(12, 0, 0, 0);
      const options = { now: workerNow, fcm: fcm as never, resolveMajorEventHold: async () => ({ status: "allowed" as const, candidate: null }) };
      await processPendingEvents(client as never, options);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      expect(fcm.sendEach).toHaveBeenCalledWith([expect.objectContaining({ token: "derived-fixture-token", data: expect.objectContaining({
        target_partition: JSON.stringify(payload.target_partition), forecast_at: payload.forecast_at, arrival_at: payload.arrival_at, peak_at: payload.peak_at,
      }) })]);
      await processPendingEvents(client as never, options);
      expect(fcm.sendEach).toHaveBeenCalledTimes(1);
      expect(query(`SELECT count(*) FROM public.swell_watch_recipient_announcements WHERE notification_event_id='${queued.data.id}'`)).toBe("1");
      const terminal = await client.from("notification_events").select("status,attempt_count").eq("id", queued.data.id).single();
      expect(terminal.error).toBeNull();
      expect(terminal.data).toEqual({ status: "processed", attempt_count: 1 });
      const afterDelivery = await loadSwellWatchDeliveryHealth(releasePolicy.value_hash, { rpc });
      expect(afterDelivery.providerFailures).toEqual({
        samples: deliveryHealth.providerFailures.samples + 1, failures: deliveryHealth.providerFailures.failures,
      });
      expect(afterDelivery.priorProjectedSendsInWindow).toBe(deliveryHealth.priorProjectedSendsInWindow + 1);
      query(`BEGIN; SELECT set_config('app.swell_watch_internal_write','on',true);
        INSERT INTO public.swell_watch_provider_delivery_outcomes
          (id,notification_event_id,attempt_number,sample_count,failure_count,created_at)
        VALUES(gen_random_uuid(),'${queued.data.id}',999,100,100,
          now()-make_interval(mins=>${releasePolicy.policy_values.provider_failure_hold.window_minutes + 1}));
        COMMIT;`);
      expect(await loadSwellWatchDeliveryHealth(releasePolicy.value_hash, { rpc })).toEqual(afterDelivery);
      const attempts = await client.from("notification_delivery_attempts").select("status").eq("notification_event_id", queued.data.id);
      expect(attempts.error).toBeNull();
      expect(attempts.data).toEqual([{ status: "sent" }]);
    } finally {
      NOTIFICATION_REGISTRY.swell_watch.channels = channels;
      if (flag === undefined) delete process.env.SWELL_WATCH_PUSH_ENABLED;
      else process.env.SWELL_WATCH_PUSH_ENABLED = flag;
    }
  }, 60_000);
});
