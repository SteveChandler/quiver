import "server-only";

import { randomUUID } from "node:crypto";
import { processImport, type ProcessImportResult } from "@/lib/sessions/imports/process-import";
import { TrackFileError } from "@/lib/sessions/tracks/types";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import type { Database } from "@/types/database.generated";
import type { WatchContext } from "./with-watch-auth";

const integer = z.number().int().safe();
const chunkCountSchema = integer.min(1).max(1000);
const headerSchema = z.object({
  surfId: z.string().uuid(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  sport: z.literal("surfing"),
  partNumber: z.string(),
  deviceName: z.string(),
  appVersion: z.string(),
  rating: integer.min(1).max(5).nullable(),
  chunkCount: chunkCountSchema,
});
const chunkSchema = z.object({
  header: headerSchema.optional(),
  t0: integer,
  lat0: integer.nullable(),
  lon0: integer.nullable(),
  rows: z.array(z.tuple([
    integer.min(0), integer.nullable(), integer.nullable(),
    integer.nullable(), integer.nullable(), integer.nullable(),
  ])).min(1).max(600),
});
const surfIdSchema = z.string().uuid();
const indexSchema = z.string().regex(/^\d+$/).transform(Number).pipe(integer.min(0).max(999));
type Upload = Database["public"]["Tables"]["watch_uploads"]["Row"];

function checkError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function loadUpload(ctx: WatchContext, surfId: string): Promise<Upload | null> {
  const { data, error } = await ctx.service.from("watch_uploads").select("*")
    .eq("id", surfId).eq("user_id", ctx.userId).maybeSingle();
  checkError(error);
  return data;
}

export async function uploadWatchChunk(request: NextRequest, ctx: WatchContext): Promise<Response> {
  const id = surfIdSchema.safeParse(ctx.params.surfId);
  const index = indexSchema.safeParse(ctx.params.index);
  const body = chunkSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !index.success || !body.success) return createErrorResponse("invalid_chunk", undefined, 400);
  const { header } = body.data;
  if ((index.data === 0 && !header) || (header && (index.data !== 0 || header.surfId !== id.data))) {
    return createErrorResponse("invalid_header", undefined, 400);
  }

  let upload = await loadUpload(ctx, id.data);
  if (upload && upload.user_id !== ctx.userId) return createErrorResponse("not_found", undefined, 404);
  if (!upload) {
    // Ignore conflicts so an existing UUID can never be reassigned to a different owner.
    const { error } = await ctx.service.from("watch_uploads").upsert({
      id: id.data, user_id: ctx.userId, device_id: ctx.deviceId,
    }, { onConflict: "id", ignoreDuplicates: true });
    checkError(error);
    upload = await loadUpload(ctx, id.data);
  }
  if (!upload || upload.user_id !== ctx.userId) return createErrorResponse("not_found", undefined, 404);
  if (upload.chunk_count !== null && index.data >= upload.chunk_count) {
    return createErrorResponse("invalid_index", undefined, 400);
  }
  if (upload.import_id) return createSuccessResponse({ received: index.data });

  const { error: storageError } = await ctx.service.storage.from("session-tracks").upload(
    `${id.data}/${ctx.userId}/chunks/${index.data}.json`, JSON.stringify(body.data),
    { contentType: "application/octet-stream", upsert: true },
  );
  checkError(storageError);
  const { error } = await ctx.service.from("watch_uploads").update({
    ...(header ? { header, chunk_count: header.chunkCount } : {}),
    received_chunks: [...new Set([...upload.received_chunks, index.data])].sort((a, b) => a - b),
  }).eq("id", id.data).eq("user_id", ctx.userId).is("import_id", null);
  checkError(error);
  return createSuccessResponse({ received: index.data });
}

function mappedResult(result: ProcessImportResult): Response {
  return createSuccessResponse({ status: result.status, sessionId: result.status === "needs_beach" ? null : result.sessionId });
}

async function cleanChunks(ctx: WatchContext, upload: Upload): Promise<void> {
  try {
    const paths = upload.received_chunks.map(index => `${upload.id}/${ctx.userId}/chunks/${index}.json`);
    if (!paths.length) return;
    const { error } = await ctx.service.storage.from("session-tracks").remove(paths);
    checkError(error);
  } catch (error) {
    console.warn("[watch-upload] chunk cleanup failed", error);
  }
}

async function processWatchImport(ctx: WatchContext, upload: Upload, importId: string): Promise<Response> {
  let response: Response;
  try {
    const result = await processImport({ userClient: ctx.service, serviceClient: ctx.service, now: new Date() }, importId, ctx.userId);
    response = mappedResult(result);
  } catch (error) {
    if (!(error instanceof TrackFileError)) throw error;
    response = createSuccessResponse({ status: "failed", sessionId: null });
  }
  await cleanChunks(ctx, upload);
  return response;
}

async function existingImport(ctx: WatchContext, upload: Upload): Promise<Response> {
  const { data: imported, error } = await ctx.service.from("session_imports").select("*")
    .eq("id", upload.import_id!).eq("user_id", ctx.userId).maybeSingle();
  checkError(error);
  if (!imported || imported.user_id !== ctx.userId) return createErrorResponse("not_found", undefined, 404);
  if (imported.status === "completed") return createSuccessResponse({ status: "completed", sessionId: imported.session_id });
  if (imported.status === "needs_beach") return createSuccessResponse({ status: "needs_beach", sessionId: null });
  if (imported.status === "failed") {
    return createSuccessResponse({
      status: imported.error === "duplicate" ? "duplicate" : "failed",
      sessionId: imported.error === "duplicate" ? imported.session_id : null,
    });
  }
  if (imported.status !== "uploaded") throw new Error("Unexpected watch import status");
  const createdAt = imported.created_at ? Date.parse(imported.created_at) : NaN;
  if (Number.isFinite(createdAt) && Date.now() - createdAt < 90_000) {
    return createSuccessResponse({ status: "processing", sessionId: null }, 202);
  }
  return processWatchImport(ctx, upload, imported.id);
}

async function assembleChunks(ctx: WatchContext, upload: Upload): Promise<string> {
  const chunks = [];
  for (let index = 0; index < upload.chunk_count!; index++) {
    const { data, error } = await ctx.service.storage.from("session-tracks")
      .download(`${upload.id}/${ctx.userId}/chunks/${index}.json`);
    checkError(error);
    if (!data) throw new Error("Watch chunk object not found");
    const { t0, lat0, lon0, rows } = chunkSchema.parse(JSON.parse(await data.text()));
    chunks.push({ t0, lat0, lon0, rows });
  }
  return JSON.stringify({ quiverWatch: 1, header: upload.header, chunks });
}

export async function completeWatchUpload(request: NextRequest, ctx: WatchContext): Promise<Response> {
  const id = surfIdSchema.safeParse(ctx.params.surfId);
  const body = z.object({ chunkCount: chunkCountSchema }).safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return createErrorResponse("invalid_upload", undefined, 400);
  const upload = await loadUpload(ctx, id.data);
  if (!upload || upload.user_id !== ctx.userId) return createErrorResponse("not_found", undefined, 404);
  if (upload.import_id) return existingImport(ctx, upload);
  if (upload.chunk_count !== null && upload.chunk_count !== body.data.chunkCount) {
    return createErrorResponse("invalid_chunk_count", undefined, 400);
  }
  const received = new Set(upload.received_chunks);
  const missing = Array.from({ length: body.data.chunkCount }, (_, index) => index)
    .filter(index => !received.has(index) || (index === 0 && !upload.header));
  if (missing.length) return createErrorResponse("missing_chunks", { missing }, 409);

  const importId = randomUUID();
  const storagePath = `${importId}/${ctx.userId}/samples.json`;
  const assembled = await assembleChunks(ctx, upload);
  const bucket = ctx.service.storage.from("session-tracks");
  const { error: storageError } = await bucket.upload(storagePath, assembled, {
    contentType: "application/octet-stream", upsert: true,
  });
  checkError(storageError);
  const { error: insertError } = await ctx.service.from("session_imports").insert({
    id: importId, user_id: ctx.userId, storage_path: storagePath,
    original_filename: `garmin-${id.data}.json`, origin: "garmin_watch", device_id: upload.device_id,
  });
  if (insertError) {
    const { error: cleanupError } = await bucket.remove([storagePath]);
    checkError(cleanupError);
    throw new Error(insertError.message);
  }

  const { data: claimed, error: claimError } = await ctx.service.from("watch_uploads")
    .update({ import_id: importId }).eq("id", id.data).eq("user_id", ctx.userId)
    .is("import_id", null).select("id");
  checkError(claimError);
  if (!claimed?.length) {
    const { error: deleteError } = await ctx.service.from("session_imports").delete()
      .eq("id", importId).eq("user_id", ctx.userId);
    checkError(deleteError);
    const { error: cleanupError } = await bucket.remove([storagePath]);
    checkError(cleanupError);
    const current = await loadUpload(ctx, id.data);
    if (!current || current.user_id !== ctx.userId) return createErrorResponse("not_found", undefined, 404);
    if (!current.import_id) throw new Error("Watch upload claim disappeared");
    return existingImport(ctx, current);
  }
  return processWatchImport(ctx, upload, importId);
}
