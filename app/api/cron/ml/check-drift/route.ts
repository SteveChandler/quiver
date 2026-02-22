import { createClient } from '@supabase/supabase-js';

// Quick drift check operation - calls database function and potentially triggers retrain
export const maxDuration = 120; // Allow time for potential retrain trigger

// Auto-rollback threshold: if production improvement drops below this for 2 consecutive
// checks (~48h with 24h check interval), roll back to the previous deployed model.
const ROLLBACK_IMPROVEMENT_FLOOR = 25; // percent

// Cooldown period after an auto-rollback to prevent A-B-A oscillation.
// If the current model was auto-restored within this window, skip rollback.
const AUTO_ROLLBACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration');
    return Response.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // =========================================================================
  // AUTO-ROLLBACK CHECK
  // =========================================================================
  // Check if the currently deployed model has been underperforming.
  // If production_improvement < 25% for 2 consecutive checks (48h), roll back.
  const rollbackResult = await checkAutoRollback(supabase);

  // Call check_ml_drift() database function
  const { data: isDriftDetected, error } = await supabase.rpc('check_ml_drift');

  if (error) {
    console.error('Failed to check ML drift:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!isDriftDetected) {
    console.log('No drift detected - model performance is healthy');
    return Response.json({
      drift_detected: false,
      message: 'Model performance is healthy',
      auto_rollback: rollbackResult,
    });
  }

  // Drift detected - log warning and trigger retrain
  console.warn('ML drift detected! Triggering emergency retrain...');

  // Trigger the retrain route
  const retrainUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/ml/retrain`;

  try {
    const retrainResponse = await fetch(retrainUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    if (!retrainResponse.ok) {
      const errorText = await retrainResponse.text();
      console.error('Retrain trigger failed:', errorText);
      return Response.json({
        drift_detected: true,
        retrain_triggered: false,
        auto_rollback: rollbackResult,
        error: `Retrain failed: ${errorText}`,
      }, { status: 500 });
    }

    const retrainResult = await retrainResponse.json();
    console.log('Retrain triggered successfully:', retrainResult);

    return Response.json({
      drift_detected: true,
      retrain_triggered: true,
      retrain_result: retrainResult,
      auto_rollback: rollbackResult,
    });
  } catch (triggerError) {
    console.error('Failed to trigger retrain:', triggerError);
    return Response.json({
      drift_detected: true,
      retrain_triggered: false,
      auto_rollback: rollbackResult,
      error: `Failed to trigger retrain: ${triggerError instanceof Error ? triggerError.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}

// =============================================================================
// AUTO-ROLLBACK LOGIC
// =============================================================================
// Checks if the currently deployed model has consistently underperformed.
// If production_improvement < ROLLBACK_IMPROVEMENT_FLOOR for 2 consecutive
// drift checks (~48h), rolls back to the previous deployed model.

interface RollbackResult {
  checked: boolean;
  rolled_back: boolean;
  reason?: string;
  previous_model?: string;
  current_model?: string;
}

async function checkAutoRollback(
  supabase: any
): Promise<RollbackResult> {
  try {
    // Get the currently deployed model
    const { data: currentModel, error: currentError } = await supabase
      .from('ml_model_registry')
      .select('id, version, production_improvement_pct, deployed_at, notes')
      .eq('status', 'deployed')
      .order('deployed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentError || !currentModel) {
      return { checked: false, rolled_back: false, reason: 'No deployed model found' };
    }

    // Cooldown: skip auto-rollback if the current model was auto-restored recently.
    // This prevents A-B-A oscillation where two models keep rolling back to each other.
    if (currentModel.notes && currentModel.notes.startsWith('Auto-restored')) {
      const deployedAt = new Date(currentModel.deployed_at).getTime();
      const cooldownExpiry = deployedAt + AUTO_ROLLBACK_COOLDOWN_MS;
      if (Date.now() < cooldownExpiry) {
        const daysLeft = ((cooldownExpiry - Date.now()) / (24 * 60 * 60 * 1000)).toFixed(1);
        console.log(`[Auto-Rollback] Cooldown active: current model was auto-restored. ${daysLeft} days remaining.`);
        return { checked: true, rolled_back: false, reason: `Auto-rollback cooldown active (${daysLeft} days remaining)` };
      }
    }

    // Calculate current production improvement from recent predictions
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check improvement in last 24h window
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('ml_predictions_log')
      .select('raw_error_m, corrected_error_m')
      .eq('model_version', currentModel.version)
      .gt('observed_m', 0)
      .not('raw_error_m', 'is', null)
      .not('corrected_error_m', 'is', null)
      .gte('predicted_at', twentyFourHoursAgo)
      .limit(5000);

    if (metricsError || !recentMetrics || recentMetrics.length < 10) {
      return { checked: true, rolled_back: false, reason: 'Insufficient recent data for rollback check' };
    }

    // Calculate improvement percentage
    let improved = 0;
    for (const row of recentMetrics) {
      if (Math.abs(row.corrected_error_m) < Math.abs(row.raw_error_m)) {
        improved++;
      }
    }
    const currentImprovementPct = (improved / recentMetrics.length) * 100;

    console.log(`[Auto-Rollback] Current model ${currentModel.version}: ${currentImprovementPct.toFixed(1)}% improvement (floor: ${ROLLBACK_IMPROVEMENT_FLOOR}%)`);

    // Update production_improvement_pct in registry
    await supabase
      .from('ml_model_registry')
      .update({ production_improvement_pct: currentImprovementPct })
      .eq('id', currentModel.id);

    if (currentImprovementPct >= ROLLBACK_IMPROVEMENT_FLOOR) {
      return { checked: true, rolled_back: false, reason: 'Performance above rollback floor' };
    }

    // Check if the previous check (24-48h ago) also showed poor performance
    const { data: olderMetrics, error: olderError } = await supabase
      .from('ml_predictions_log')
      .select('raw_error_m, corrected_error_m')
      .eq('model_version', currentModel.version)
      .gt('observed_m', 0)
      .not('raw_error_m', 'is', null)
      .not('corrected_error_m', 'is', null)
      .gte('predicted_at', fortyEightHoursAgo)
      .lt('predicted_at', twentyFourHoursAgo)
      .limit(5000);

    if (olderError || !olderMetrics || olderMetrics.length < 10) {
      console.log('[Auto-Rollback] Insufficient older data - waiting for next check');
      return { checked: true, rolled_back: false, reason: 'Waiting for consecutive underperformance confirmation' };
    }

    let olderImproved = 0;
    for (const row of olderMetrics) {
      if (Math.abs(row.corrected_error_m) < Math.abs(row.raw_error_m)) {
        olderImproved++;
      }
    }
    const olderImprovementPct = (olderImproved / olderMetrics.length) * 100;

    console.log(`[Auto-Rollback] Previous window: ${olderImprovementPct.toFixed(1)}% improvement`);

    if (olderImprovementPct >= ROLLBACK_IMPROVEMENT_FLOOR) {
      console.log('[Auto-Rollback] Previous window was above floor - not rolling back yet');
      return { checked: true, rolled_back: false, reason: 'Only 1 consecutive underperformance, need 2' };
    }

    // Both windows are below the floor - trigger auto-rollback
    console.warn('[Auto-Rollback] 2 consecutive underperformance windows detected! Rolling back...');

    // Find previous deployed model to roll back to
    const { data: previousModel, error: previousError } = await supabase
      .from('ml_model_registry')
      .select('id, version')
      .eq('status', 'rolled_back')
      .order('deployed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError || !previousModel) {
      console.error('[Auto-Rollback] No previous model available for rollback');
      return { checked: true, rolled_back: false, reason: 'No previous model available for rollback' };
    }

    // Roll back: mark current as rolled_back, restore previous as deployed
    const { error: rollbackError } = await supabase
      .from('ml_model_registry')
      .update({
        status: 'rolled_back',
        notes: `Auto-rolled back: production improvement ${currentImprovementPct.toFixed(1)}% < ${ROLLBACK_IMPROVEMENT_FLOOR}% for 2 consecutive checks`,
      })
      .eq('id', currentModel.id);

    if (rollbackError) {
      console.error('[Auto-Rollback] Failed to update current model status:', rollbackError);
      return { checked: true, rolled_back: false, reason: `Rollback failed: ${rollbackError.message}` };
    }

    const { error: restoreError } = await supabase
      .from('ml_model_registry')
      .update({
        status: 'deployed',
        deployed_at: new Date().toISOString(),
        notes: `Auto-restored after ${currentModel.version} underperformed`,
      })
      .eq('id', previousModel.id);

    if (restoreError) {
      console.error('[Auto-Rollback] Failed to restore previous model:', restoreError);
      return { checked: true, rolled_back: false, reason: `Restore failed: ${restoreError.message}` };
    }

    console.warn(`[Auto-Rollback] Rolled back from ${currentModel.version} to ${previousModel.version}`);

    return {
      checked: true,
      rolled_back: true,
      current_model: currentModel.version,
      previous_model: previousModel.version,
      reason: `Production improvement ${currentImprovementPct.toFixed(1)}% < ${ROLLBACK_IMPROVEMENT_FLOOR}% for 2 consecutive windows`,
    };
  } catch (error) {
    console.error('[Auto-Rollback] Unexpected error:', error);
    return {
      checked: false,
      rolled_back: false,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
