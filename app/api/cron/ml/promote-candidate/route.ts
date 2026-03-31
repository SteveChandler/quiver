import { createClient } from '@supabase/supabase-js';
import { updateFlyMachineEnvVars, waitForModelVersion } from '@/lib/services/fly-deploy';

// Candidate promotion runs quickly - just queries metrics and updates registry
export const maxDuration = 30;

// Candidate can be up to 2% worse than champion to be promoted
const PROMOTION_THRESHOLD = -2; // percent

// Candidate's mean absolute error must not exceed champion's by more than 10%
const MAE_REGRESSION_THRESHOLD = 10; // percent

// Candidate must not be worse than raw NOAA (doing nothing)
const CANDIDATE_VS_RAW_MAE_THRESHOLD = 5; // percent

/**
 * GET /api/cron/ml/promote-candidate
 *
 * Checks for validated candidate models that have completed 24h shadow scoring.
 * Compares candidate vs champion corrections against ground truth from
 * ml_predictions_log. Promotes only if all three gates pass, otherwise marks failed.
 *
 * Promotion gates (all must pass):
 *   Gate 1 — Win rate: candidate_improvement >= champion_improvement - 2%
 *   Gate 2 — MAE regression: candidate MAE not more than 10% worse than champion MAE
 *   Gate 3 — vs raw NOAA: candidate MAE not more than 5% worse than raw NOAA MAE
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

    // Calculate improvement percentages and MAE accumulators
    // Champion improvement: % of predictions where corrected is closer to observed than raw
    let championImproved = 0;
    let candidateImproved = 0;
    let championTotalError = 0;
    let candidateTotalError = 0;
    let rawTotalError = 0;

    for (const row of candidateMetrics) {
      const rawError = Math.abs(row.raw_error_m);
      const championError = Math.abs(row.corrected_error_m);
      const candidateError = Math.abs(row.candidate_corrected_m - row.observed_m);

      if (championError < rawError) championImproved++;
      if (candidateError < rawError) candidateImproved++;

      championTotalError += championError;
      candidateTotalError += candidateError;
      rawTotalError += rawError;
    }

    const totalSamples = candidateMetrics.length;
    const championImprovementPct = (championImproved / totalSamples) * 100;
    const candidateImprovementPct = (candidateImproved / totalSamples) * 100;

    const championMAE = championTotalError / totalSamples;
    const candidateMAE = candidateTotalError / totalSamples;
    const rawMAE = rawTotalError / totalSamples;

    console.log(`[Promote Candidate] ${candidate.version}: champion=${championImprovementPct.toFixed(1)}%, candidate=${candidateImprovementPct.toFixed(1)}% (${totalSamples} samples)`);
    console.log(`[Promote Candidate] ${candidate.version} MAE: candidate=${candidateMAE.toFixed(3)}m, champion=${championMAE.toFixed(3)}m, raw=${rawMAE.toFixed(3)}m`);

    // =========================================================================
    // STEP 4: Promotion decision — all three gates must pass
    // =========================================================================
    const improvementDelta = candidateImprovementPct - championImprovementPct;
    const passesWinRate = improvementDelta >= PROMOTION_THRESHOLD;

    const maeRegressionPct = championMAE > 0
      ? ((candidateMAE - championMAE) / championMAE) * 100
      : 0;
    const passesMAE = maeRegressionPct <= MAE_REGRESSION_THRESHOLD;

    const candidateVsRawPct = rawMAE > 0
      ? ((candidateMAE - rawMAE) / rawMAE) * 100
      : 0;
    const passesRawCheck = candidateVsRawPct <= CANDIDATE_VS_RAW_MAE_THRESHOLD;

    const shouldPromote = passesWinRate && passesMAE && passesRawCheck;

    console.log(
      `[Promote Candidate] ${candidate.version} gates: ` +
      `win_rate=${passesWinRate ? 'PASS' : 'FAIL'} (delta: ${improvementDelta.toFixed(1)}%, threshold: >=${PROMOTION_THRESHOLD}%) | ` +
      `mae_regression=${passesMAE ? 'PASS' : 'FAIL'} (${maeRegressionPct.toFixed(1)}%, threshold: <=${MAE_REGRESSION_THRESHOLD}%) | ` +
      `vs_raw=${passesRawCheck ? 'PASS' : 'FAIL'} (${candidateVsRawPct.toFixed(1)}%, threshold: <=${CANDIDATE_VS_RAW_MAE_THRESHOLD}%)`
    );

    if (shouldPromote) {
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
          notes: `Promoted. Win rate: ${candidateImprovementPct.toFixed(1)}% vs champion ${championImprovementPct.toFixed(1)}% (delta: ${improvementDelta.toFixed(1)}%). MAE: candidate=${candidateMAE.toFixed(3)}m, champion=${championMAE.toFixed(3)}m, raw=${rawMAE.toFixed(3)}m.`,
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
      const failedGates = [
        !passesWinRate && `win_rate (delta: ${improvementDelta.toFixed(1)}%, needed >=${PROMOTION_THRESHOLD}%)`,
        !passesMAE && `mae_regression (${maeRegressionPct.toFixed(1)}% worse, max ${MAE_REGRESSION_THRESHOLD}%)`,
        !passesRawCheck && `vs_raw (${candidateVsRawPct.toFixed(1)}% worse than raw, max ${CANDIDATE_VS_RAW_MAE_THRESHOLD}%)`,
      ].filter(Boolean).join(', ');

      console.log(`[Promote Candidate] Rejecting ${candidate.version} — failed gates: ${failedGates}`);

      await supabase
        .from('ml_model_registry')
        .update({
          status: 'failed',
          production_improvement_pct: candidateImprovementPct,
          notes: `Failed production validation. Failed gates: ${failedGates}`,
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
