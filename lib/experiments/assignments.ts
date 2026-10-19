import { createServiceRoleClient } from "@/lib/supabase";

interface ExperimentEligibilityLinkResult {
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
