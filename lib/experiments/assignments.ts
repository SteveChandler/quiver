import { createServiceRoleClient } from "@/lib/supabase";
import type { ExperimentArm, ExperimentKey } from "./assignment-hash";

export interface ExperimentAssignmentRow {
  experiment_key: ExperimentKey;
  user_id: string;
  arm: ExperimentArm;
  index_at: string;
  assignment_version: string;
  build: string | null;
  source: "native_app" | "web_oauth" | null;
  linked_at: string | null;
  created_at: string;
}

export interface ExperimentEligibilityLinkResult {
  rowsLinked: number;
  alreadyLinked: boolean;
  existingBuild: string | null;
  existingSource: string | null;
}

export async function linkExperimentEligibility(
  userId: string,
  build: string,
  source: "native_app" | "web_oauth"
): Promise<ExperimentEligibilityLinkResult> {
  const { data, error } = await createServiceRoleClient().rpc(
    "link_experiment_eligibility",
    {
      p_user_id: userId,
      p_build: build,
      p_source: source,
    }
  );

  if (error) throw error;

  const row = data?.[0];
  if (!row) {
    throw new Error("Experiment eligibility linkage returned no result");
  }

  return {
    rowsLinked: row.rows_linked,
    alreadyLinked: row.already_linked,
    existingBuild: row.existing_build,
    existingSource: row.existing_source,
  };
}

export async function allocateExperimentBatch(
  experimentKey: ExperimentKey,
  userIds: string[],
  indexAt?: string
): Promise<ExperimentAssignmentRow[]> {
  const { data, error } = await createServiceRoleClient().rpc(
    "allocate_experiment_batch",
    {
      p_experiment_key: experimentKey,
      p_user_ids: userIds,
      ...(indexAt ? { p_index_at: indexAt } : {}),
    }
  );

  if (error) throw error;
  return (data ?? []) as ExperimentAssignmentRow[];
}
