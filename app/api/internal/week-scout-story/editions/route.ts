import { NextResponse, type NextRequest } from "next/server";
import { withStoryPublisher } from "@/lib/middleware/api-wrappers/story-publisher-wrapper";
import { loadStoryInput, publishStoryEdition, StoryStoreError } from "@/lib/services/discovery/week-scout-story-store";
import { assertStoryArtifactMatchesInput, StoryValidationError } from "@/lib/services/discovery/week-scout-story-validate";
import type { StoryArtifact } from "@/lib/services/discovery/week-scout-story-types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 512 * 1024;

export const POST = withStoryPublisher(async (request: NextRequest) => {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  let artifact: StoryArtifact;
  try { artifact = JSON.parse(raw) as StoryArtifact; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!artifact || typeof artifact !== "object" || artifact.schemaVersion !== 3
    || typeof artifact.inputHash !== "string" || typeof artifact.region !== "string") {
    return NextResponse.json({ error: "invalid_artifact" }, { status: 400 });
  }
  const client = createSupabaseServiceRoleClient();
  try {
    const input = await loadStoryInput(client, artifact.inputHash);
    if (!input) return NextResponse.json({ error: "unknown_input_hash" }, { status: 409 });
    assertStoryArtifactMatchesInput(artifact, input);
    const result = await publishStoryEdition(client, artifact);
    return NextResponse.json({ artifactId: result.artifactId }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof StoryValidationError || error instanceof StoryStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
