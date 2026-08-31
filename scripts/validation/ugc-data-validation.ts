/**
 * Real-database proof for the UGC session conditions, video, photo, and share paths.
 *
 * Local mode is intentionally write-capable only for localhost Supabase. The
 * remote-readonly mode does not create users, rows, storage objects, or sessions.
 *
 * Run:
 *   npx tsx scripts/validation/ugc-data-validation.ts
 *   npx tsx scripts/validation/ugc-data-validation.ts --with-server
 *   npx tsx scripts/validation/ugc-data-validation.ts --remote-readonly
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

loadEnv({ path: ".env" });

type CheckStatus = "PASS" | "FAIL" | "SKIP";
type Check = { phase: string; name: string; status: CheckStatus; evidence: string };
type Client = SupabaseClient<any, any, any>;

const checks: Check[] = [];
let failureObserved = false;
const remoteReadonly = process.argv.includes("--remote-readonly");
const withServer = process.argv.includes("--with-server");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocalSupabaseUrl = (candidate: string): boolean => {
  try {
    const parsed = new URL(candidate);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

function record(phase: string, name: string, status: CheckStatus, evidence: unknown): void {
  checks.push({ phase, name, status, evidence: typeof evidence === "string" ? evidence : JSON.stringify(evidence) });
  console.log(`${status.padEnd(4)} ${phase.padEnd(9)} ${name}: ${checks.at(-1)?.evidence}`);
}

function pass(phase: string, name: string, evidence: unknown): void { record(phase, name, "PASS", evidence); }
function skip(phase: string, name: string, evidence: unknown): void { record(phase, name, "SKIP", evidence); }
function fail(phase: string, name: string, error: unknown): void {
  failureObserved = true;
  record(phase, name, "FAIL", error instanceof Error ? error.message : JSON.stringify(error));
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor<T>(read: () => Promise<T | null>, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function sql(query: string): string {
  return execFileSync(
    "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-c", query],
    { env: { ...process.env, PGPASSWORD: process.env.SUPABASE_PASS ?? "postgres" }, encoding: "utf8" },
  ).trim();
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function printFailureEvidence(mediaId: string | null, paths: string[]): void {
  const pathValues = paths.length > 0 ? paths.map(sqlLiteral).join(", ") : "NULL";
  const mediaPredicate = mediaId
    ? `(id = ${sqlLiteral(mediaId)} OR storage_path IN (${pathValues}))`
    : `storage_path IN (${pathValues})`;
  const evidence = sql(`
    SELECT json_build_object(
      'session_media', (SELECT COALESCE(json_agg(row_to_json(sm) ORDER BY sm.created_at), '[]'::json) FROM public.session_media sm WHERE ${mediaPredicate}),
      'storage_objects', (SELECT COALESCE(json_agg(row_to_json(so) ORDER BY so.created_at), '[]'::json) FROM storage.objects so WHERE so.bucket_id = 'session-videos' AND so.name IN (${pathValues}))
    )
  `);
  console.error(`FAILURE EVIDENCE ${evidence}`);
}

function localDatabaseTruth(): Record<string, unknown> {
  const raw = sql(`
    SELECT json_build_object(
      'bucket', (SELECT row_to_json(b) FROM storage.buckets b WHERE b.id = 'session-videos'),
      'intel_session_column', (SELECT row_to_json(c) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'intel_posts' AND c.column_name = 'session_id'),
      'column', (SELECT row_to_json(c) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'session_media' AND c.column_name = 'moderation_status'),
      'check', (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.session_media'::regclass AND conname = 'session_media_moderation_status_check'),
      'enum', (SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'content_report_target' AND e.enumlabel = 'session_media')),
      'config', (SELECT row_to_json(c) FROM public.community_photo_feature_config c WHERE c.singleton = true)
    )`);
  return JSON.parse(raw) as Record<string, unknown>;
}

async function schemaPhase(service: Client): Promise<void> {
  const phase = "schema";
  if (remoteReadonly) {
    const { data: buckets, error: bucketError } = await service.from("storage.buckets").select("id,name,public,file_size_limit,allowed_mime_types").eq("id", "session-videos").maybeSingle();
    if (bucketError) throw bucketError;
    assert(buckets, "session-videos bucket is missing");
    assert(buckets.public === false && buckets.file_size_limit === 62914560, `bucket config ${JSON.stringify(buckets)}`);
    assert(JSON.stringify(buckets.allowed_mime_types ?? []).includes("video/mp4") && JSON.stringify(buckets.allowed_mime_types ?? []).includes("video/quicktime"), "bucket MIME types are incomplete");
    pass(phase, "session-videos bucket", buckets);
    const { error: columnError } = await service.from("session_media").select("moderation_status").limit(1);
    if (columnError) throw new Error(`moderation_status column lookup failed: ${columnError.message}`);
    pass(phase, "moderation_status column", "PostgREST column lookup succeeded; default/constraint require local psql");
    const { data: configRow, error: configError } = await service.from("community_photo_feature_config").select("singleton").eq("singleton", true).maybeSingle();
    if (configError) throw configError;
    assert(configRow, "community_photo_feature_config singleton row is missing");
    pass(phase, "photo feature config", configRow);
    skip(phase, "default/check/enum", "remote-readonly does not use writes or a remote SQL connection");
    return;
  }

  const truth = localDatabaseTruth();
  const bucket = truth.bucket as Record<string, unknown> | null;
  assert(bucket, "session-videos bucket is missing");
  assert(bucket.public === false && Number(bucket.file_size_limit) === 62914560, `bucket config ${JSON.stringify(bucket)}`);
  const mime = JSON.stringify(bucket.allowed_mime_types ?? []);
  assert(mime.includes("video/mp4") && mime.includes("video/quicktime"), `bucket MIME types ${mime}`);
  pass(phase, "session-videos bucket", bucket);
  const intelSessionColumn = truth.intel_session_column as Record<string, unknown> | null;
  assert(intelSessionColumn, "intel_posts.session_id column is missing");
  pass(phase, "intel_posts.session_id column", intelSessionColumn);
  const column = truth.column as Record<string, unknown> | null;
  assert(column, "moderation_status column is missing");
  assert(column.column_default === "'approved'::text", `moderation_status default is ${column.column_default}`);
  pass(phase, "moderation_status default", column.column_default);
  const constraint = String(truth.check ?? "");
  assert(constraint.includes("pending") && constraint.includes("approved") && constraint.includes("rejected"), constraint || "constraint missing");
  pass(phase, "moderation CHECK", constraint);
  assert(truth.enum === true, "content_report_target does not contain session_media");
  pass(phase, "content_report_target enum", "session_media");
  assert(truth.config, "community_photo_feature_config singleton row is missing");
  pass(phase, "photo feature config", truth.config);
}

async function createActor(anon: Client, service: Client, label: string): Promise<{ client: Client; user: User; accessToken: string }> {
  const email = `ugc-validation-${label}-${randomUUID()}@localhost.test`;
  const password = `UgcValidation-${randomUUID()}!`;
  const signup = await anon.auth.signUp({ email, password });
  if (signup.error) throw signup.error;
  let session = signup.data.session;
  if (!session) {
    // Local auth has enable_confirmations = true; admin-confirm the throwaway
    // user so the harness can sign in (localhost-only by the top-level guard).
    const signupUser = signup.data.user;
    if (signupUser) {
      const confirm = await service.auth.admin.updateUserById(signupUser.id, { email_confirm: true });
      if (confirm.error) throw confirm.error;
    }
    const login = await anon.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) throw login.error ?? new Error(`No session for ${label}`);
    session = login.data.session;
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession(session);
  return { client, user: requireValue(signup.data.user ?? session.user, `No ${label} user`), accessToken: session.access_token };
}

async function conditionsPhase(a: { client: Client; user: User }, service: Client): Promise<{ beachId: string; sessionId: string }> {
  const phase = "conditions";
  // Direct table access on beaches is revoked for API roles (hardening — reads
  // go through SECURITY DEFINER RPCs), so the harness reads via local psql.
  const beachRaw = sql("SELECT json_build_object('id', id, 'name', name) FROM public.beaches WHERE lat IS NOT NULL AND lon IS NOT NULL LIMIT 1");
  const beach = requireValue(beachRaw ? (JSON.parse(beachRaw) as { id: string; name: string }) : null, "No beach available after db reset");
  const { submitConditionsReportCore } = await import("../../lib/conditions-report/submit-conditions-report");
  const input = { beachId: beach.id, waveSizeRange: "2-3ft", vibe: "fun", note: "UGC validation harness" } as const;
  const user = a.user;
  const first = await submitConditionsReportCore(input as any, user, a.client as any);
  assert(first.success, `conditions report failed: ${JSON.stringify(first)}`);
  const intel = requireValue((await service.from("intel_posts").select("tag,wave_size_range,vibe,session_id").eq("id", first.data.intelPostId).single()).data, "intel row missing");
  assert(intel.tag === "conditions" && intel.wave_size_range === input.waveSizeRange && intel.vibe === input.vibe, JSON.stringify(intel));
  assert(intel.session_id === first.data.sessionId, `intel/session linkage mismatch: ${JSON.stringify(intel)}`);
  pass(phase, "intel_posts", intel);
  const session = requireValue((await service.from("sessions").select("id,wave_height_ft,source").eq("id", first.data.sessionId).single()).data, "conditions session missing");
  assert(Number(session.wave_height_ft) === 2.5 && session.source === "conditions_report", JSON.stringify(session));
  pass(phase, "conditions session", session);
  const second = await submitConditionsReportCore(input as any, user, a.client as any);
  assert(!second.success && second.error === "ALREADY_REPORTED_TODAY", JSON.stringify(second));
  pass(phase, "same-day dedupe", second.error);
  const forecastAt = new Date();
  forecastAt.setUTCMinutes(0, 0, 0);
  const forecast = await service.from("enhanced_forecasts").select("id").eq("beach_id", beach.id).eq("forecast_at", forecastAt.toISOString()).maybeSingle();
  if (forecast.error) throw forecast.error;
  if (!forecast.data) {
    skip(phase, "forecast feedback context", `no enhanced_forecasts row at ${forecastAt.toISOString()}`);
  } else {
    const feedback = await waitFor(async () => (await service.from("forecast_feedback_contexts").select("id,feedback_kind,ingest_path").eq("user_id", a.user.id).eq("beach_id", beach.id).eq("feedback_kind", "condition_report").order("created_at", { ascending: false }).limit(1).maybeSingle()).data, 10_000);
    assert(feedback, "current-hour forecast existed but no condition_report feedback context was written");
    pass(phase, "forecast feedback context", feedback);
  }
  return { beachId: beach.id, sessionId: requireValue(first.data.sessionId, "conditions core did not create a session") };
}

async function reportVideoPhase(a: { client: Client; user: User; accessToken: string }, b: { client: Client; user: User; accessToken: string }, service: Client, conditions: { beachId: string; sessionId: string }, storagePaths: string[], onMediaId: (mediaId: string) => void): Promise<void> {
  const phase = "report-video";
  const intel = requireValue((await service.from("intel_posts").select("id,session_id").eq("session_id", conditions.sessionId).single()).data, "linked conditions intel row missing");
  assert(intel.session_id === conditions.sessionId, JSON.stringify(intel));
  pass(phase, "intel/session linkage row-for-row", intel);

  const path = `${conditions.sessionId}/${a.user.id}/${randomUUID()}.mp4`;
  const fixture = Buffer.from("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom", "ascii");
  const upload = await a.client.storage.from("session-videos").upload(path, fixture, { contentType: "video/mp4", upsert: false });
  if (upload.error) throw upload.error;
  storagePaths.push(path);
  pass(phase, "report session storage upload", `${path} (${fixture.length} bytes)`);

  const { POST } = await import("../../app/api/sessions/[id]/videos/route");
  const finalize = await POST(new Request(`${url}/api/sessions/${conditions.sessionId}/videos`, {
    method: "POST",
    headers: { authorization: `Bearer ${a.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ storagePath: path, durationSec: 12, sizeBytes: fixture.length }),
  }) as any, { params: { id: conditions.sessionId } } as any);
  const finalizeText = await finalize.text();
  assert(finalize.status === 201, `report video finalize returned ${finalize.status}: ${finalizeText}`);
  const mediaId = requireValue((JSON.parse(finalizeText) as { mediaId?: string }).mediaId, "report video mediaId missing");
  onMediaId(mediaId);
  pass(phase, "report video finalized pending", mediaId);

  const { data: bIntel, error: bIntelError } = await b.client.from("intel_posts").select("id,session_id").eq("id", intel.id).single();
  if (bIntelError) throw bIntelError;
  assert(bIntel?.session_id === conditions.sessionId, `actor B cannot see report linkage: ${JSON.stringify(bIntel)}`);
  const { data: pendingForB, error: pendingError } = await b.client.from("session_media").select("id").eq("id", mediaId).maybeSingle();
  if (pendingError) throw pendingError;
  assert(!pendingForB, "pending report video is visible to actor B through the intel-side lens");
  pass(phase, "pending invisible to actor B", "intel linkage visible; pending clip hidden");

  const approved = await service.from("session_media").update({ moderation_status: "approved" }).eq("id", mediaId);
  if (approved.error) throw approved.error;
  const { GET } = await import("../../app/api/sessions/[id]/videos/[mediaId]/route");
  const playback = await GET(new Request(`${url}/api/sessions/${conditions.sessionId}/videos/${mediaId}`, {
    headers: { authorization: `Bearer ${b.accessToken}` },
  }) as any, { params: { id: conditions.sessionId, mediaId } } as any);
  const playbackText = await playback.text();
  assert(playback.status === 200, `actor B playback returned ${playback.status}: ${playbackText}`);
  assert(Boolean((JSON.parse(playbackText) as { url?: string }).url), "actor B playback URL is empty");
  pass(phase, "actor B approved playback", "HTTP 200 signed URL");
}

async function videoPhase(a: { client: Client; user: User; accessToken: string }, service: Client, beachId: string, storagePaths: string[]): Promise<{ publicSessionId: string; mediaId: string }> {
  const phase = "video";
  const session = requireValue((await service.from("sessions").insert({ user_id: a.user.id, beach_id: beachId, beach_name: "UGC validation", arrival_time: new Date().toISOString(), status: "completed", source: "manual", is_public: true }).select("id").single()).data, "public test session creation failed");
  const path = `${session.id}/${a.user.id}/${randomUUID()}.mp4`;
  const fixture = Buffer.from("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom", "ascii");
  const upload = await a.client.storage.from("session-videos").upload(path, fixture, { contentType: "video/mp4", upsert: false });
  if (upload.error) throw upload.error;
  storagePaths.push(path);
  pass(phase, "owner storage upload", `${path} (${fixture.length} bytes)`);
  const { POST } = await import("../../app/api/sessions/[id]/videos/route");
  const call = async (body: Record<string, unknown>): Promise<Response> => POST(new Request(`${url}/api/sessions/${session.id}/videos`, { method: "POST", headers: { authorization: `Bearer ${a.accessToken}`, "content-type": "application/json" }, body: JSON.stringify(body) }) as any, { params: { id: session.id } } as any);
  const response = await call({ storagePath: path, durationSec: 12, sizeBytes: fixture.length });
  const responseText = await response.text();
  assert(response.status === 201, `finalize returned ${response.status}: ${responseText}`);
  const result = JSON.parse(responseText) as { mediaId?: string };
  const mediaId = requireValue(result.mediaId, "finalize did not return mediaId");
  const media = requireValue((await service.from("session_media").select("id,media_type,moderation_status").eq("id", mediaId).single()).data, "finalized media missing");
  assert(media.media_type === "video" && media.moderation_status === "pending", JSON.stringify(media));
  pass(phase, "video finalize", media);
  const rejects: Array<[string, Record<string, unknown>]> = [["wrong-prefix", { storagePath: `other/${a.user.id}/x.mp4`, durationSec: 1, sizeBytes: 1 }], [">60s", { storagePath: path, durationSec: 61, sizeBytes: 1 }], [">60MB", { storagePath: path, durationSec: 1, sizeBytes: 62914561 }]];
  for (const [name, body] of rejects) {
    const rejected = await call(body);
    assert(rejected.status === 422, `${name} returned ${rejected.status}`);
    pass(phase, `reject ${name}`, `HTTP ${rejected.status}`);
  }
  return { publicSessionId: session.id, mediaId };
}

async function visibilityPhase(a: { client: Client; user: User }, b: { client: Client; user: User }, anon: Client, service: Client, publicSessionId: string, pendingMediaId: string, beachId: string): Promise<void> {
  const phase = "RLS";
  const read = async (client: Client, id: string): Promise<boolean> => {
    const result = await client.from("session_media").select("id").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    return Boolean(result.data);
  };
  assert(await read(a.client, pendingMediaId), "owner cannot see pending video");
  assert(!(await read(b.client, pendingMediaId)), "user B can see pending video");
  assert(!(await read(anon, pendingMediaId)), "anon can see pending video");
  pass(phase, "pending public video matrix", "A=true, B=false, anon=false");
  const photo = requireValue((await a.client.from("session_media").insert({ session_id: publicSessionId, user_id: a.user.id, storage_path: `legacy/${randomUUID()}.jpg`, public_url: "", file_size: 1, media_type: "photo" }).select("id,moderation_status").single()).data, "photo insert failed");
  assert(photo.moderation_status === "approved", JSON.stringify(photo));
  assert(await read(b.client, photo.id) && await read(anon, photo.id), "default-approved photo is not public");
  pass(phase, "photo default-approved matrix", "B=true, anon=true");
  const approved = await service.from("session_media").update({ moderation_status: "approved" }).eq("id", pendingMediaId);
  if (approved.error) throw approved.error;
  assert(await read(b.client, pendingMediaId) && await read(anon, pendingMediaId), "approved public video is not public");
  pass(phase, "approved public video matrix", "B=true, anon=true");
  const privateSession = requireValue((await service.from("sessions").insert({ user_id: a.user.id, beach_id: beachId, beach_name: "UGC private validation", arrival_time: new Date().toISOString(), status: "completed", source: "manual", is_public: false }).select("id").single()).data, "private session creation failed");
  const privateMedia = requireValue((await service.from("session_media").insert({ session_id: privateSession.id, user_id: a.user.id, storage_path: `private/${randomUUID()}.mp4`, public_url: "", file_size: 1, media_type: "video", moderation_status: "approved" }).select("id").single()).data, "private media creation failed");
  assert(!(await read(b.client, privateMedia.id)) && !(await read(anon, privateMedia.id)), "private approved video is public");
  pass(phase, "private approved video matrix", "B=false, anon=false");
}

async function contractsPhase(service: Client, mediaId: string): Promise<void> {
  const phase = "contracts";
  const signed = await service.storage.from("session-videos").createSignedUrl(requireValue((await service.from("session_media").select("storage_path").eq("id", mediaId).single()).data?.storage_path, "video path missing"), 300);
  if (signed.error) throw signed.error;
  assert(Boolean(signed.data?.signedUrl), "approved video signed URL is empty");
  pass(phase, "approved video signed URL", signed.data?.signedUrl);
  if (!withServer) {
    skip(phase, "share sticker", "pass --with-server with a running Next server");
    return;
  }
  const response = await fetch(`${process.env.BASE_URL ?? "http://localhost:3000"}/api/og/share-sticker?beachName=Validation&waveRange=2-3ft&vibe=clean`);
  const bytes = await response.arrayBuffer();
  assert(response.status === 200 && response.headers.get("content-type")?.startsWith("image/png") && bytes.byteLength > 0, `HTTP ${response.status}, ${response.headers.get("content-type")}, ${bytes.byteLength} bytes`);
  pass(phase, "share sticker", `HTTP 200 image/png ${bytes.byteLength} bytes`);
}

async function sharesPhase(a: { client: Client; user: User }, sessionId: string): Promise<void> {
  const phase = "share";
  const row = requireValue((await a.client.from("session_shares").insert({ session_id: sessionId, user_id: a.user.id, platform: "instagram", variant: "story" }).select("id,platform").single()).data, "session share insert failed");
  assert(row.platform === "instagram", JSON.stringify(row));
  pass(phase, "native share recording", row);
}

async function main(): Promise<void> {
  assert(!isLocalSupabaseUrl("https://prod.example.supabase.co"), "local URL guard self-test accepted a remote URL");
  pass("guard", "non-local URL self-test", "remote URL rejected");
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required in .env");
  if (!remoteReadonly && !isLocalSupabaseUrl(url)) throw new Error(`Refusing write phases: Supabase URL is ${url}. This harness writes only to localhost/127.0.0.1; use --remote-readonly for zero-write assertions.`);
  if (!remoteReadonly) {
    try { execFileSync("supabase", ["status"], { stdio: "ignore" }); }
    catch { throw new Error("Local Supabase is not running. Start it with: supabase start && yarn db:reset"); }
  }
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = remoteReadonly
    ? (serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null)
    : createClient(url, requireValue(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required for local cleanup"), { auth: { persistSession: false, autoRefreshToken: false } });
  await schemaPhase(service ?? anon);
  if (remoteReadonly) return;
  const localService = requireValue(service, "service client was not initialized");
  let actorA: Awaited<ReturnType<typeof createActor>> | null = null;
  let actorB: Awaited<ReturnType<typeof createActor>> | null = null;
  const storagePaths: string[] = [];
  let reportVideoMediaId: string | null = null;
  let failure: unknown = null;
  try {
    actorA = await createActor(anon, service, "a");
    actorB = await createActor(anon, service, "b");
    pass("actors", "throwaway auth users", `${actorA.user.id}, ${actorB.user.id}`);
    const conditions = await conditionsPhase(actorA, localService);
    await reportVideoPhase(actorA, actorB, localService, conditions, storagePaths, (mediaId) => { reportVideoMediaId = mediaId; });
    const video = await videoPhase(actorA, localService, conditions.beachId, storagePaths);
    await visibilityPhase(actorA, actorB, anon, localService, video.publicSessionId, video.mediaId, conditions.beachId);
    await contractsPhase(localService, video.mediaId);
    await sharesPhase(actorA, conditions.sessionId);
  } catch (error: unknown) {
    failure = error;
    fail("fatal", "harness", error);
  } finally {
    if (failure || failureObserved) {
      // Capture the database row and storage object before cleanup removes either.
      printFailureEvidence(reportVideoMediaId, storagePaths);
    }
    if (storagePaths.length > 0) {
      const removed = await localService.storage.from("session-videos").remove(storagePaths);
      if (removed.error) fail("cleanup", "storage objects", removed.error);
      else pass("cleanup", "storage objects", storagePaths.join(", "));
    }
    if (actorA) {
      await localService.from("session_media").delete().eq("user_id", actorA.user.id);
      await localService.from("sessions").delete().eq("user_id", actorA.user.id);
      await localService.from("intel_posts").delete().eq("user_id", actorA.user.id);
      await localService.auth.admin.deleteUser(actorA.user.id);
      if (actorB) await localService.auth.admin.deleteUser(actorB.user.id);
      pass("cleanup", "throwaway rows/users", "deleted via service role");
    }
  }
}

void main().catch((error: unknown) => {
  fail("fatal", "harness", error);
}).finally(() => {
  console.log("\nSummary");
  console.table(checks.map(({ phase, name, status, evidence }) => ({ phase, check: name, status, evidence })));
  process.exitCode = checks.some((check) => check.status === "FAIL") ? 1 : 0;
});
