import { createClient } from '@supabase/supabase-js';
import {
  validateCronRequest,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-utils';

// Allow extended timeout for training orchestration
// Note: Actual training happens on ML service, but data extraction
// and validation can take time with large datasets
export const maxDuration = 300; // 5 minutes

const ML_SERVICE_URL = process.env.ML_SERVICE_URL!;
const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET!;

interface TrainingMetrics {
  training_window_days: number;
  training_samples: number;
  holdout_improvement_pct: number;
  holdout_raw_mae: number;
  holdout_corrected_mae: number;
}

interface TrainResponse {
  success: boolean;
  version: string;
  metrics?: TrainingMetrics;
  model_url?: string;
  error?: string;
}

/**
 * POST /api/cron/ml/retrain
 *
 * Orchestrates the ML model retraining pipeline:
 * 1. Extract training data from ml_predictions_log (max 365 days)
 * 2. Call ML service to train new v3 model
 * 3. Run validation gates on holdout set
 * 4. If PASS: Deploy to Fly.io, update ml_model_registry
 * 5. If FAIL: Log failure, keep current model
 *
 * This is a long-running operation that may take several minutes.
 *
 * @see docs/plans/2026-02-01-ml-rolling-pipeline-design.md
 */
export async function POST(request: Request) {
  // Verify cron authentication
  if (!validateCronRequest(request)) {
    return createErrorResponse('Unauthorized', undefined, 401);
  }

  // Check required environment variables
  if (!ML_SERVICE_URL || !ML_INTERNAL_SECRET) {
    return createErrorResponse(
      'ML_SERVICE_URL or ML_INTERNAL_SECRET not configured',
      undefined,
      500
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return createErrorResponse(
      'Supabase configuration missing',
      undefined,
      500
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const trainingStartedAt = new Date().toISOString();
  const modelVersion = `v3.${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

  console.log(`[ML Retrain] Starting pipeline for ${modelVersion}`);

  try {
    // =======================================================================
    // STEP 1: Extract Training Data
    // =======================================================================
    console.log('[ML Retrain] Step 1: Extracting training data...');

    const maxDaysBack = 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDaysBack);

    // Extract all predictions with ground truth (observed_m is not null)
    const { data: trainingData, error: extractError } = await supabase
      .from('ml_predictions_log')
      .select(
        `
        id,
        beach_id,
        predicted_at,
        raw_forecast_m,
        corrected_forecast_m,
        observed_m,
        raw_error_m,
        corrected_error_m,
        model_version
      `
      )
      .not('observed_m', 'is', null)
      .gte('predicted_at', cutoffDate.toISOString())
      .order('predicted_at', { ascending: true });

    if (extractError) {
      console.error('[ML Retrain] Data extraction failed:', extractError);
      return createErrorResponse(
        'Failed to extract training data',
        extractError,
        500
      );
    }

    if (!trainingData || trainingData.length === 0) {
      console.warn('[ML Retrain] No training data available');
      return createSuccessResponse({
        message: 'No training data available',
        model_version: modelVersion,
        status: 'skipped',
      });
    }

    const trainingWindowDays = Math.ceil(
      (new Date().getTime() - new Date(trainingData[0].predicted_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    console.log(
      `[ML Retrain] Extracted ${trainingData.length} samples spanning ${trainingWindowDays} days`
    );

    // =======================================================================
    // STEP 2: Create Model Registry Entry
    // =======================================================================
    console.log('[ML Retrain] Step 2: Creating registry entry...');

    const { data: registryEntry, error: registryError } = await supabase
      .from('ml_model_registry')
      .insert({
        version: modelVersion,
        training_window_days: trainingWindowDays,
        training_samples: trainingData.length,
        training_started_at: trainingStartedAt,
        status: 'training',
        notes: 'Auto-retrain pipeline initiated',
      })
      .select()
      .single();

    if (registryError) {
      console.error('[ML Retrain] Registry creation failed:', registryError);
      return createErrorResponse(
        'Failed to create registry entry',
        registryError,
        500
      );
    }

    console.log(`[ML Retrain] Registry entry created: ${registryEntry.id}`);

    // =======================================================================
    // STEP 3: Call ML Service to Train Model
    // =======================================================================
    console.log('[ML Retrain] Step 3: Calling ML service for training...');

    // TODO: The ML service currently doesn't have a /train endpoint.
    // This needs to be implemented in ml/api.py to accept:
    // - Training data (or a reference to fetch from Supabase)
    // - Model version string
    // - Training configuration (recency weighting, guardrails)
    //
    // The endpoint should:
    // 1. Run train_v3.py logic
    // 2. Validate with go/no-go gates
    // 3. Save model artifact
    // 4. Return metrics and model file URL
    //
    // For now, this is a placeholder that shows the expected flow.

    let trainResponse: TrainResponse;

    try {
      // Prepare training request payload
      const trainingPayload = {
        version: modelVersion,
        training_data: trainingData,
        config: {
          recency_weight_days: 14,
          recency_weight_multiplier: 2.0,
          holdout_days: 2,
          max_bias_pct: 0.75,
          bias_floor_m: 0.5,
        },
      };

      const response = await fetch(`${ML_SERVICE_URL}/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': ML_INTERNAL_SECRET,
        },
        body: JSON.stringify(trainingPayload),
        signal: AbortSignal.timeout(240000), // 4 minute timeout for training
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML service training failed: ${response.status} - ${errorText}`);
      }

      trainResponse = await response.json();
    } catch (error) {
      console.error('[ML Retrain] Training failed:', error);

      // Update registry with failure
      await supabase
        .from('ml_model_registry')
        .update({
          status: 'failed',
          notes: `Training failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        .eq('id', registryEntry.id);

      return createErrorResponse(
        'Model training failed',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }

    if (!trainResponse.success) {
      console.error('[ML Retrain] Training did not pass validation gates');

      // Update registry with failure
      await supabase
        .from('ml_model_registry')
        .update({
          training_completed_at: new Date().toISOString(),
          status: 'failed',
          holdout_improvement_pct: trainResponse.metrics?.holdout_improvement_pct,
          holdout_raw_mae: trainResponse.metrics?.holdout_raw_mae,
          holdout_corrected_mae: trainResponse.metrics?.holdout_corrected_mae,
          notes: `Training completed but failed validation gates: ${trainResponse.error}`,
        })
        .eq('id', registryEntry.id);

      return createSuccessResponse({
        message: 'Model training failed validation gates',
        model_version: modelVersion,
        status: 'failed',
        metrics: trainResponse.metrics,
        reason: trainResponse.error,
      });
    }

    console.log('[ML Retrain] Training passed validation gates');
    console.log('[ML Retrain] Metrics:', trainResponse.metrics);

    // =======================================================================
    // STEP 4: Deploy to Fly.io
    // =======================================================================
    console.log('[ML Retrain] Step 4: Deploying to Fly.io...');

    // TODO: Deploy the trained model to Fly.io
    // Options:
    // 1. Use Fly.io API to trigger deployment with new MODEL_VERSION env var
    // 2. Upload model artifact to Fly.io volumes/storage
    // 3. Trigger a rebuild with the new model baked in
    //
    // For now, this is a placeholder. In practice, you might:
    // - Use Fly.io GraphQL API to update secrets/env vars
    // - Trigger a deployment via flyctl or API
    // - Wait for health check to confirm deployment

    try {
      // Placeholder for deployment logic
      const deploymentResult = await deployToFly(
        modelVersion,
        trainResponse.model_url || ''
      );

      if (!deploymentResult.success) {
        throw new Error(deploymentResult.error || 'Deployment failed');
      }

      console.log('[ML Retrain] Deployment successful');
    } catch (error) {
      console.error('[ML Retrain] Deployment failed:', error);

      await supabase
        .from('ml_model_registry')
        .update({
          training_completed_at: new Date().toISOString(),
          status: 'validated',
          holdout_improvement_pct: trainResponse.metrics?.holdout_improvement_pct,
          holdout_raw_mae: trainResponse.metrics?.holdout_raw_mae,
          holdout_corrected_mae: trainResponse.metrics?.holdout_corrected_mae,
          notes: `Training passed but deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        .eq('id', registryEntry.id);

      return createErrorResponse(
        'Model deployment failed',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }

    // =======================================================================
    // STEP 5: Update Registry with Success
    // =======================================================================
    console.log('[ML Retrain] Step 5: Updating registry with deployment...');

    const { error: updateError } = await supabase
      .from('ml_model_registry')
      .update({
        training_completed_at: new Date().toISOString(),
        deployed_at: new Date().toISOString(),
        status: 'deployed',
        holdout_improvement_pct: trainResponse.metrics?.holdout_improvement_pct,
        holdout_raw_mae: trainResponse.metrics?.holdout_raw_mae,
        holdout_corrected_mae: trainResponse.metrics?.holdout_corrected_mae,
        notes: 'Successfully trained and deployed via auto-retrain pipeline',
      })
      .eq('id', registryEntry.id);

    if (updateError) {
      console.error('[ML Retrain] Registry update failed:', updateError);
      // Don't fail the whole operation since deployment succeeded
    }

    console.log('[ML Retrain] Pipeline completed successfully');

    return createSuccessResponse({
      message: 'Model retrain and deployment successful',
      model_version: modelVersion,
      status: 'deployed',
      training_samples: trainingData.length,
      training_window_days: trainingWindowDays,
      metrics: trainResponse.metrics,
      deployed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ML Retrain] Unexpected error:', error);
    return createErrorResponse(
      'Unexpected error during retrain pipeline',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Deploy model to Fly.io
 *
 * TODO: Implement actual Fly.io deployment
 * This should:
 * 1. Upload model artifact to Fly.io volume or S3
 * 2. Update MODEL_VERSION environment variable
 * 3. Trigger deployment/restart
 * 4. Wait for health check confirmation
 *
 * For now, this is a stub.
 */
async function deployToFly(
  modelVersion: string,
  modelUrl: string
): Promise<{ success: boolean; error?: string }> {
  console.warn(
    '[deployToFly] STUB: Fly.io deployment not yet implemented'
  );
  console.warn(`[deployToFly] Would deploy ${modelVersion} from ${modelUrl}`);

  // TODO: Implement actual deployment
  // Example using Fly.io API:
  // 1. Upload model to Fly.io volume or external storage
  // 2. Update app secrets with new MODEL_VERSION
  // 3. Trigger deployment
  // 4. Poll health endpoint until ready

  return {
    success: false,
    error: 'Fly.io deployment not yet implemented - manual deployment required',
  };
}
