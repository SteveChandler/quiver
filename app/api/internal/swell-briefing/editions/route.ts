import { NextResponse, type NextRequest } from "next/server";

import { withBriefingPublisher } from "@/lib/middleware/api-wrappers/briefing-publisher-wrapper";
import {
  BriefingStoreError,
  loadBriefingInput,
  publishBriefingEdition,
} from "@/lib/services/discovery/swell-briefing-store";
import {
  BriefingValidationError,
  assertBriefingArtifactMatchesInput,
} from "@/lib/services/discovery/swell-briefing-validate";
import type { BriefingArtifact } from "@/lib/services/discovery/swell-briefing-types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** An artifact is small; a large body is refused before it is read into memory. */
const MAX_BODY_BYTES = 512 * 1024;

function fail(code: string, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

/**
 * Publishes one generated edition.
 *
 * The worker is trusted to choose copy and nothing else, so the upload is
 * revalidated against the input this server issued before anything is stored.
 * Saving is idempotent by artifact id and refuses an older source, both inside
 * one transaction, so a retry and a concurrent job are equally safe.
 */
export const POST = withBriefingPublisher(async (request: NextRequest, { userId, region }) => {
  // Refuse on the declared length first, so an oversized upload is not pulled
  // into memory before being rejected. `raw.length` counts UTF-16 units, not
  // bytes, so the real size is measured after decoding as well.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail("payload_too_large", 413);
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return fail("payload_too_large", 413);

  let artifact: BriefingArtifact;
  try {
    artifact = JSON.parse(raw) as BriefingArtifact;
  } catch {
    return fail("invalid_json", 400);
  }

  if (!artifact || typeof artifact !== "object") return fail("invalid_artifact", 400);
  // 1 is the Outlook briefing, 2 Week Scout notes; the input decides which rules apply.
  if (artifact.schemaVersion !== 1 && artifact.schemaVersion !== 2) {
    return fail("unsupported_schema_version", 400);
  }
  // The credential names the account; a body claiming another user is refused
  // rather than quietly rewritten.
  if (artifact.userId !== userId) return fail("user_mismatch", 403);
  if (artifact.region !== region) return fail("region_mismatch", 400);

  const client = createSupabaseServiceRoleClient();

  try {
    const input = await loadBriefingInput(client, artifact.inputHash, userId);
    if (input === null) return fail("unknown_input_hash", 409);

    assertBriefingArtifactMatchesInput(artifact, input);

    const result = await publishBriefingEdition(client, artifact);
    // Only after a durable save. The worker writes its receipt from this id.
    return NextResponse.json({ artifactId: result.artifactId }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof BriefingValidationError) return fail(error.message, error.status);
    if (error instanceof BriefingStoreError) return fail(error.message, error.status);
    throw error;
  }
});
