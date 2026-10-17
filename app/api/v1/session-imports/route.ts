import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isSessionImportsUserAllowed } from "@/lib/flags/session-imports";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";
const schema = z.object({ filename: z.string().min(1).max(200) });

function safeFilename(filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  if (safe === "." || safe === "..") return "track";
  if (safe.length <= 100) return safe;
  const dot = safe.lastIndexOf(".");
  const extension = dot > 0 ? safe.slice(dot) : "";
  return safe.slice(0, 100 - Math.min(extension.length, 99)) + extension.slice(-99);
}

export const POST = withNoStore(withRateLimit(withAuth(async (request, { user }) => {
  if (!isSessionImportsUserAllowed(user.id)) return createErrorResponse("not_found", undefined, 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return createErrorResponse("invalid_filename", undefined, 400);
  const importId = randomUUID();
  const uploadPath = `${importId}/${user.id}/${safeFilename(parsed.data.filename)}`;
  const { error } = await createServiceRoleClient().from("session_imports").insert({
    id: importId, user_id: user.id, storage_path: uploadPath, original_filename: parsed.data.filename,
  });
  if (error) throw new Error(error.message);
  return createSuccessResponse({ importId, uploadPath }, 201);
}, { errorMessage: "Failed to create session import" }), "authenticated-default"));
