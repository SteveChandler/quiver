import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createErrorResponse,
  methodNotAllowed,
  type AuthenticatedContext,
  withAuth,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import {
  submitConditionsReportCore,
  type SubmitConditionsReportInput,
} from "@/lib/conditions-report/submit-conditions-report";
import type { WaveSizeRange, Vibe } from "@/types/conditions-report";
import { VIBE_OPTIONS, WAVE_SIZE_OPTIONS } from "@/types/conditions-report";

export const dynamic = "force-dynamic";

// "1-2ft" → "1:2", "5+ft" → "5:5" — derived so the contract can't drift from the canonical options.
const WAVE_RANGE_BY_BOUNDS: Record<string, WaveSizeRange> = Object.fromEntries(
  WAVE_SIZE_OPTIONS.map((o) => {
    const m = o.value.match(/^(\d+)(?:-(\d+))?/);
    const min = Number(m?.[1]);
    const max = m?.[2] !== undefined ? Number(m[2]) : min;
    return [`${min}:${max}`, o.value];
  }),
);

const VALID_VIBES = new Set<string>(VIBE_OPTIONS.map((o) => o.value));

function validationError(reason: string): NextResponse {
  return NextResponse.json({ error: "validation_failed", reason }, { status: 422 });
}

async function handler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("invalid_json");
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return validationError("body must be an object");
  }

  const raw = body as Record<string, unknown>;
  const beachId = raw.beachId;
  const waveSizeMin = raw.waveSizeMin;
  const waveSizeMax = raw.waveSizeMax;
  const vibe = raw.vibe;

  if (typeof beachId !== "string" || !beachId.trim()) {
    return validationError("beachId is required");
  }
  if (typeof waveSizeMin !== "number" || typeof waveSizeMax !== "number") {
    return validationError("waveSizeMin and waveSizeMax must be numbers");
  }

  const waveSizeRange = WAVE_RANGE_BY_BOUNDS[`${waveSizeMin}:${waveSizeMax}`];
  if (!waveSizeRange) return validationError("invalid wave size range");
  if (typeof vibe !== "string" || !VALID_VIBES.has(vibe)) {
    return validationError("invalid vibe");
  }
  if (raw.note !== undefined && typeof raw.note !== "string") {
    return validationError("note must be a string");
  }
  if (typeof raw.note === "string" && raw.note.length > 280) {
    return validationError("note must be 280 characters or fewer");
  }
  if (raw.photoStoragePath !== undefined && typeof raw.photoStoragePath !== "string") {
    return validationError("photoStoragePath must be a string");
  }

  const input: SubmitConditionsReportInput = {
    beachId,
    waveSizeRange,
    vibe: vibe as Vibe,
    note: raw.note as string | undefined,
    photoStoragePath: raw.photoStoragePath as string | undefined,
  };
  const result = await submitConditionsReportCore(input, user, supabase);

  if (!result.success) {
    if (result.error === "ALREADY_REPORTED_TODAY") {
      return NextResponse.json({ error: "already_reported_today" }, { status: 409 });
    }
    if (result.error === "Beach not found") {
      return validationError("beach_not_found");
    }
    return createErrorResponse(result.error ?? "submission_failed", undefined, 500);
  }

  return NextResponse.json(
    {
      reportId: result.data?.intelPostId,
      intelPostId: result.data?.intelPostId,
      sessionId: result.data?.sessionId ?? null,
      expiresAt: result.data?.expiresAt,
    },
    { status: 201 },
  );
}

export const POST = withNoStore(
  withAuth(handler, { errorMessage: "Failed to submit conditions report" }),
);

export const GET = withNoStore(async () => methodNotAllowed(["POST"]));
