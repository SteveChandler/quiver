import type { NextRequest } from "next/server";
import {
  createNotFoundError,
  createSuccessResponse,
  createValidationError,
  type AuthenticatedContext,
  withAuth,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";
import { EXPERIMENT_KEYS, type ExperimentKey } from "@/lib/experiments/assignment-hash";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const dynamic = "force-dynamic";

function isExperimentKey(value: string | null): value is ExperimentKey {
  return value !== null && EXPERIMENT_KEYS.includes(value as ExperimentKey);
}

async function handler(
  request: NextRequest,
  { user }: AuthenticatedContext
) {
  const key = request.nextUrl.searchParams.get("key");
  if (!isExperimentKey(key)) {
    return createValidationError(`key must be one of ${EXPERIMENT_KEYS.join(", ")}`);
  }

  const { data, error } = await createServiceRoleClient()
    .from("experiment_assignments")
    .select("experiment_key, arm, assignment_version")
    .eq("experiment_key", key)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return createNotFoundError("Experiment assignment");

  return createSuccessResponse({
    experiment_key: data.experiment_key,
    arm: data.arm,
    assignment_version: data.assignment_version,
  });
}

const handleGet = withNoStore(
  withAuth(handler, { errorMessage: "Failed to load assignment" })
);

export const GET = withErrorNoStore(handleGet, "/api/v1/experiments/assignment");
