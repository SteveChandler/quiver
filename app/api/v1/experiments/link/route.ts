import type { NextRequest } from "next/server";
import {
  createErrorResponse,
  createNotFoundError,
  createSuccessResponse,
  createValidationError,
  type AuthenticatedContext,
  withAuth,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import { linkExperimentEligibility } from "@/lib/experiments/assignments";

const NATIVE_BUILD_PATTERN = /^[0-9]{1,10}$/;

async function handler(
  request: NextRequest,
  { user }: AuthenticatedContext
) {
  const body: unknown = await request.json().catch(() => null);
  const build =
    typeof body === "object" && body !== null && typeof (body as { build?: unknown }).build === "string"
      ? (body as { build: string }).build
      : null;

  if (!build || !NATIVE_BUILD_PATTERN.test(build)) {
    return createValidationError("build must be a native build number");
  }

  const result = await linkExperimentEligibility(user.id, build, "native_app");
  if (result.rowsLinked > 0) {
    return createSuccessResponse({ linked: true });
  }

  if (result.existingBuild === null || result.existingSource === null) {
    return createNotFoundError("Experiment assignment");
  }

  if (result.existingBuild === build && result.existingSource === "native_app") {
    return createSuccessResponse({ linked: false, already_linked: true });
  }

  return createErrorResponse("eligibility linkage is write-once", undefined, 409);
}

export const POST = withNoStore(
  withAuth(handler, { errorMessage: "Failed to link experiment eligibility" })
);
