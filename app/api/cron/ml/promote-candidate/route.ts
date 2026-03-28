import { createClient } from '@supabase/supabase-js';
import { updateFlyMachineEnvVars, waitForModelVersion } from '@/lib/services/fly-deploy';

// Candidate promotion runs quickly - just queries metrics and updates registry
export const maxDuration = 30;

// Candidate can be up to 2% worse than champion to be promoted
const PROMOTION_THRESHOLD = -2; // percent

/**
 * GET /api/cron/ml/promote-candidate
 *
 * Checks for validated candidate models that have completed 24h shadow scoring.
 * Compares candidate vs champion corrections against ground truth from
 * ml_predictions_log. Promotes if candidate outperforms, otherwise marks failed.
 *
 * Promotion gate:
 *   candidate_improvement > champion_improvement - 2%
 *
 * Run on schedule (e.g., every 6 hours) to evaluate shadow scoring results.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Promote Candidate] Missing Supabase configuration');
    return Response.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // =========================================================================
  // STEP 1: Find candidates ready for evaluation (validated, 24h+ old)
  // =========================================================================
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: candidateError } = await supabase
    .from('ml_model_registry')
    .select('id, version, training_completed_at, holdout_improvement_pct')
    .eq('status', 'validated')
    .lt('training_completed_at', twentyFourHoursAgo)
    .order('training_completed_at', { ascending: true });

  if (candidateError) {
    console.error('[Promote Candidate] Failed to query candidates:', candidateError);
    return Response.json({ error: candidateError.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    console.log('[Promote Candidate] No candidates ready for evaluation');
    return Response.json({
      promoted: 0,
      failed: 0,
      message: 'No candidates ready for evaluation',
    });
  }

  console.log(`[Promote Candidate] Found ${candidates.length} candidate(s) to evaluate`);

  // =========================================================================
  // STEP 2: Get current champion model for comparison
  // =========================================================================
  const { data: champion, error: championError } = await supabase
    .from('ml_model_registry')
    .select('id, version, production_improvement_pct')
    .eq('status', 'deployed')
    .order('deployed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (championError) {
    console.error('[Promote Candidate] Failed to query champion model:', championError);
    return Response.json({ error: championError.message }, { status: 500 });
  }

  let promoted = 0;
  let failed = 0;

  for (const candidate of candidates) {
    console.log(`[Promote Candidate] Evaluating candidate ${candidate.version}...`);

    // =========================================================================
    // STEP 3: Compare candidate vs champion corrections against ground truth
    // =========================================================================
    // Query ml_predictions_log for rows where both candidate and champion
    // corrections exist alongside ground truth observations.

    // Get candidate improvement from shadow scoring data
    const { data: candidateMetrics, error: candidateMetricsError } = await supabase
      .from('ml_predictions_log')
      .select('raw_error_m, corrected_error_m, candidate_corrected_m, observed_m')
      .eq('candidate_model_version', candidate.version)
      .gt('observed_m', 0)
      .not('candidate_corrected_m', 'is', null)
      .not('raw_error_m', 'is', null)
      .not('corrected_error_m', 'is', null)
      .limit(5000);

    if (candidateMetricsError) {
      console.error(`[Promote Candidate] Failed to query metrics for ${candidate.version}:`, candidateMetricsError);
      failed++;
      continue;
    }

    if (!candidateMetrics || candidateMetrics.length < 10) {
      console.log(`[Promote Candidate] Insufficient shadow scoring data for ${candidate.version}: ${candidateMetrics?.length || 0} samples`);
      // Mark as failed if we've waited long enough without enough data
      const trainingAge = Date.now() - new Date(candidate.training_completed_at).getTime();
      const fortyEightHours = 48 * 60 * 60 * 1000;

      if (trainingAge > fortyEightHours) {
        console.log(`[Promote Candidate] Candidate ${candidate.version} is >48h old with insufficient data, marking as failed`);
        await supabase
          .from('ml_model_registry')
          .update({
            status: 'failed',
            notes: `Insufficient shadow scoring data after 48h: ${candidateMetrics?.length || 0} samples`,
          })
          .eq('id', candidate.id);
        failed++;
      }
      continue;
    }

    // Calculate improvement percentages
    // Champion improvement: % of predictions where corrected is closer to observed than raw
    let championImproved = 0;
    let candidateImproved = 0;

    for (const row of candidateMetrics) {
      const rawError = Math.abs(row.raw_error_m);
      const championError = Math.abs(row.corrected_error_m);
      const candidateError = Math.abs(row.candidate_corrected_m - row.observed_m);

      if (championError < rawError) championImproved++;
      if (candidateError < rawError) candidateImproved++;
    }

    const totalSamples = candidateMetrics.length;
    const championImprovementPct = (championImproved / totalSamples) * 100;
    const candidateImprovementPct = (candidateImproved / totalSamples) * 100;

    console.log(`[Promote Candidate] ${candidate.version}: champion=${championImprovementPct.toFixed(1)}%, candidate=${candidateImprovementPct.toFixed(1)}% (${totalSamples} samples)`);

    // =========================================================================
    // STEP 4: Promotion decision
    // =========================================================================
    const improvementDelta = candidateImprovementPct - championImprovementPct;

    if (improvementDelta >= PROMOTION_THRESHOLD) {
      console.log(`[Promote Candidate] Promoting ${candidate.version} (delta: ${improvementDelta.toFixed(1)}%)`);

      // Demote current champion if exists
      if (champion) {
        await supabase
          .from('ml_model_registry')
          .update({
            status: 'rolled_back',
            notes: `Superseded by ${candidate.version}`,
          })
          .eq('id', champion.id);
      }

      // Promote candidate
      const { error: promoteError } = await supabase
        .from('ml_model_registry')
        .update({
          status: 'deployed',
          deployed_at: new Date().toISOString(),
          production_improvement_pct: candidateImprovementPct,
          notes: `Promoted after shadow scoring. Improvement: ${candidateImprovementPct.toFixed(1)}% (champion was ${championImprovementPct.toFixed(1)}%, delta: ${improvementDelta.toFixed(1)}%)`,
        })
        .eq('id', candidate.id);

      if (promoteError) {
        console.error(`[Promote Candidate] Failed to promote ${candidate.version}:`, promoteError);
        failed++;
        continue;
      }

      // Update Fly.io secrets: move candidate to primary model
      // Set CANDIDATE_VERSION/CANDIDATE_PATH to empty to clear shadow scoring
      if (process.env.FLY_API_TOKEN) {
        try {
          await promoteCandidateOnFly(candidate.version);
        } catch (flyError) {
          console.error(`[Promote Candidate] Fly.io promotion failed for ${candidate.version}:`, flyError);
          // Don't fail the entire operation - registry is updated
        }
      }

      promoted++;
    } else {
      console.log(`[Promote Candidate] Rejecting ${candidate.version} (delta: ${improvementDelta.toFixed(1)}%, threshold: ${PROMOTION_THRESHOLD}%)`);

      await supabase
        .from('ml_model_registry')
        .update({
          status: 'failed',
          production_improvement_pct: candidateImprovementPct,
          notes: `Failed production validation. Improvement: ${candidateImprovementPct.toFixed(1)}% vs champion ${championImprovementPct.toFixed(1)}% (delta: ${improvementDelta.toFixed(1)}%, needed >= ${PROMOTION_THRESHOLD}%)`,
        })
        .eq('id', candidate.id);

      // Clear candidate env vars on Fly.io
      try {
        await updateFlyMachineEnvVars({}, ['CANDIDATE_VERSION', 'CANDIDATE_PATH']);
      } catch (flyError) {
        console.error('[Promote Candidate] Failed to clear candidate on Fly.io:', flyError);
      }

      failed++;
    }
  }

  console.log(`[Promote Candidate] Complete: ${promoted} promoted, ${failed} failed`);

  return Response.json({
    promoted,
    failed,
    evaluated: candidates.length,
  });
}

// =============================================================================
// HELPER: Promote candidate to primary model on Fly.io
// =============================================================================
async function promoteCandidateOnFly(modelVersion: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured');
  }
  const modelPath = `${supabaseUrl}/storage/v1/object/public/ml-artifacts/ml-models/${modelVersion}.json`;

  console.log(`[Promote Candidate] Updating Fly.io machines: MODEL_VERSION=${modelVersion}, clearing CANDIDATE_*`);

  const result = await updateFlyMachineEnvVars(
    { MODEL_VERSION: modelVersion, MODEL_PATH: modelPath },
    ['CANDIDATE_VERSION', 'CANDIDATE_PATH']
  );

  if (!result.success) {
    throw new Error(`Failed to update Fly.io machines: ${result.error}`);
  }

  const health = await waitForModelVersion(modelVersion);
  if (!health.success) {
    throw new Error(`Health check failed after promotion: ${health.error}`);
  }

  console.log(`[Promote Candidate] Fly.io machines updated: MODEL_VERSION=${modelVersion}, MODEL_PATH=${modelPath}, CANDIDATE_* cleared`);
}
