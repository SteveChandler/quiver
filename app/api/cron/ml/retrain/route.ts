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

// Environment variables validated at runtime in POST handler
// Using getters to avoid non-null assertion at module load time
const getMLServiceUrl = () => process.env.ML_SERVICE_URL;
const getMLInternalSecret = () => process.env.ML_INTERNAL_SECRET;

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
  const ML_SERVICE_URL = getMLServiceUrl();
  const ML_INTERNAL_SECRET = getMLInternalSecret();

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
    // Join with beaches table to get terrain factors
    // Use pagination to fetch all rows (Supabase default limit is 1000)
    const PAGE_SIZE = 5000;
    const trainingData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error: extractError } = await supabase
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
          model_version,
          wave_period_s,
          wave_direction_deg,
          wind_speed_ms,
          wind_direction_deg,
          beaches!inner(
            swell_access_factors,
            wind_exposure_factors
          )
        `
        )
        .not('observed_m', 'is', null)
        .gte('predicted_at', cutoffDate.toISOString())
        .order('predicted_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (extractError) {
        console.error('[ML Retrain] Data extraction failed:', extractError);
        return createErrorResponse(
          'Failed to extract training data',
          extractError,
          500
        );
      }

      if (pageData && pageData.length > 0) {
        trainingData.push(...pageData);
        console.log(`[ML Retrain] Fetched page ${page + 1}: ${pageData.length} rows (total: ${trainingData.length})`);
        hasMore = pageData.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }

      // Safety limit: max 100 pages (500k rows)
      if (page >= 100) {
        console.warn('[ML Retrain] Reached max pagination limit (500k rows)');
        hasMore = false;
      }
    }

    console.log(`[ML Retrain] Total training data: ${trainingData.length} rows`);

    if (trainingData.length === 0) {
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

    let trainResponse: TrainResponse;

    try {
      // Prepare training request payload
      // Transform trainingData to include terrain factors from beaches join
      const trainingPayload = {
        version: modelVersion,
        training_data: trainingData.map((record: any) => ({
          beach_id: record.beach_id,
          predicted_at: record.predicted_at,
          raw_forecast_m: record.raw_forecast_m,
          observed_m: record.observed_m,
          wave_period_s: record.wave_period_s,
          wave_direction_deg: record.wave_direction_deg,
          wind_speed_ms: record.wind_speed_ms,
          wind_direction_deg: record.wind_direction_deg,
          swell_access_factors: record.beaches?.swell_access_factors || null,
          wind_exposure_factors: record.beaches?.wind_exposure_factors || null,
        })),
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

    try {
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
 * Implementation:
 * 1. Upload model artifact to Supabase Storage (accessible by ML service)
 * 2. Get list of machines for the Fly.io app
 * 3. Update MODEL_VERSION and MODEL_PATH env vars on all machines
 * 4. Restart machines to load new model
 * 5. Poll health endpoint until new model version is confirmed
 *
 * Timeout: 2 minutes for entire deployment process
 */
async function deployToFly(
  modelVersion: string,
  modelUrl: string
): Promise<{ success: boolean; error?: string }> {
  const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  const FLY_APP_NAME = process.env.FLY_APP_NAME || 'quiver-ml';
  const HEALTH_URL = process.env.ML_SERVICE_URL
    ? `${process.env.ML_SERVICE_URL}/health`
    : 'https://quiver-ml.fly.dev/health';
  const DEPLOYMENT_TIMEOUT = 120000; // 2 minutes
  const HEALTH_CHECK_INTERVAL = 3000; // 3 seconds
  const HEALTH_CHECK_TIMEOUT = 60000; // 1 minute for health checks

  // Validate required environment variables
  if (!FLY_API_TOKEN) {
    console.error('[deployToFly] FLY_API_TOKEN not configured');
    return {
      success: false,
      error: 'FLY_API_TOKEN environment variable not set',
    };
  }

  if (!modelUrl) {
    console.error('[deployToFly] No model URL provided');
    return {
      success: false,
      error: 'Model URL is required for deployment',
    };
  }

  // Security: Validate model URL is from trusted ML service
  // Prevents SSRF attacks if ML service is compromised
  const ALLOWED_MODEL_URL_PREFIXES = [
    'https://quiver-ml.fly.dev/',
    'http://localhost:8080/', // Local development
    process.env.ML_SERVICE_URL ? `${process.env.ML_SERVICE_URL}/` : null,
  ].filter(Boolean) as string[];

  const isAllowedUrl = ALLOWED_MODEL_URL_PREFIXES.some(prefix =>
    modelUrl.startsWith(prefix)
  );

  if (!isAllowedUrl) {
    console.error(`[deployToFly] Model URL not from trusted source: ${modelUrl}`);
    console.error(`[deployToFly] Allowed prefixes: ${ALLOWED_MODEL_URL_PREFIXES.join(', ')}`);
    return {
      success: false,
      error: `Model URL must be from trusted ML service. Got: ${modelUrl}`,
    };
  }

  const deploymentStartTime = Date.now();
  console.log(`[deployToFly] Starting deployment of ${modelVersion}`);
  console.log(`[deployToFly] Model URL: ${modelUrl}`);

  try {
    // =======================================================================
    // STEP 1: Upload Model to Supabase Storage
    // =======================================================================
    console.log('[deployToFly] Step 1: Uploading model to Supabase Storage...');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        success: false,
        error: 'Supabase configuration missing for model upload',
      };
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Download model from training output
    const modelResponse = await fetch(modelUrl, {
      signal: AbortSignal.timeout(30000), // 30 second timeout for download
    });

    if (!modelResponse.ok) {
      throw new Error(`Failed to download model: ${modelResponse.status} ${modelResponse.statusText}`);
    }

    const modelData = await modelResponse.arrayBuffer();
    const modelFileName = `${modelVersion}.json`;
    const storagePath = `ml-models/${modelFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ml-artifacts')
      .upload(storagePath, modelData, {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[deployToFly] Model upload failed:', uploadError);
      return {
        success: false,
        error: `Failed to upload model to storage: ${uploadError.message}`,
      };
    }

    // Get public URL for the uploaded model
    const { data: urlData } = supabase.storage
      .from('ml-artifacts')
      .getPublicUrl(storagePath);

    const publicModelUrl = urlData.publicUrl;
    console.log(`[deployToFly] Model uploaded to: ${publicModelUrl}`);

    // =======================================================================
    // STEP 2: Get Fly.io Machines
    // =======================================================================
    console.log('[deployToFly] Step 2: Fetching Fly.io machines...');

    const machinesUrl = `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines`;
    const machinesResponse = await fetch(machinesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FLY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!machinesResponse.ok) {
      const errorText = await machinesResponse.text();
      console.error('[deployToFly] Failed to fetch machines:', errorText);
      return {
        success: false,
        error: `Failed to fetch Fly.io machines: ${machinesResponse.status} - ${errorText}`,
      };
    }

    const machines = await machinesResponse.json();

    if (!Array.isArray(machines) || machines.length === 0) {
      console.error('[deployToFly] No machines found for app');
      return {
        success: false,
        error: `No machines found for app ${FLY_APP_NAME}`,
      };
    }

    console.log(`[deployToFly] Found ${machines.length} machine(s)`);

    // =======================================================================
    // STEP 3: Update Environment Variables and Restart Machines
    // =======================================================================
    console.log('[deployToFly] Step 3: Updating machines with new model...');

    for (const machine of machines) {
      const machineId = machine.id;
      console.log(`[deployToFly] Updating machine ${machineId}...`);

      // Get current machine configuration
      const machineUrl = `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines/${machineId}`;
      const machineResponse = await fetch(machineUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FLY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!machineResponse.ok) {
        const errorText = await machineResponse.text();
        console.error(`[deployToFly] Failed to fetch machine ${machineId}:`, errorText);
        continue;
      }

      const machineConfig = await machineResponse.json();

      // Update environment variables with new model info
      const updatedEnv = {
        ...(machineConfig.config?.env || {}),
        MODEL_VERSION: modelVersion,
        MODEL_PATH: publicModelUrl,
      };

      // Update machine configuration
      const updateResponse = await fetch(machineUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FLY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            ...machineConfig.config,
            env: updatedEnv,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`[deployToFly] Failed to update machine ${machineId}:`, errorText);
        return {
          success: false,
          error: `Failed to update machine ${machineId}: ${updateResponse.status} - ${errorText}`,
        };
      }

      console.log(`[deployToFly] Machine ${machineId} configuration updated`);

      // Restart machine to load new model
      const restartUrl = `https://api.machines.dev/v1/apps/${FLY_APP_NAME}/machines/${machineId}/restart`;
      const restartResponse = await fetch(restartUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FLY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timeout: 30 }),
        signal: AbortSignal.timeout(35000),
      });

      if (!restartResponse.ok) {
        const errorText = await restartResponse.text();
        console.error(`[deployToFly] Failed to restart machine ${machineId}:`, errorText);
        return {
          success: false,
          error: `Failed to restart machine ${machineId}: ${restartResponse.status} - ${errorText}`,
        };
      }

      console.log(`[deployToFly] Machine ${machineId} restarted successfully`);
    }

    // =======================================================================
    // STEP 4: Wait for Machines to Start
    // =======================================================================
    console.log('[deployToFly] Step 4: Waiting for machines to start...');

    // Give machines a moment to start up before health checks
    await new Promise(resolve => setTimeout(resolve, 5000));

    // =======================================================================
    // STEP 5: Poll Health Endpoint for New Model Version
    // =======================================================================
    console.log('[deployToFly] Step 5: Polling health endpoint...');

    const healthCheckStartTime = Date.now();
    let healthCheckSuccess = false;
    let lastHealthError = '';

    while (Date.now() - healthCheckStartTime < HEALTH_CHECK_TIMEOUT) {
      // Check overall deployment timeout
      if (Date.now() - deploymentStartTime > DEPLOYMENT_TIMEOUT) {
        return {
          success: false,
          error: `Deployment timed out after ${DEPLOYMENT_TIMEOUT / 1000} seconds`,
        };
      }

      try {
        const healthResponse = await fetch(HEALTH_URL, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log('[deployToFly] Health check response:', healthData);

          // Check if the new model version is active
          if (healthData.model_version === modelVersion) {
            healthCheckSuccess = true;
            console.log(`[deployToFly] Health check confirmed new model version: ${modelVersion}`);
            break;
          } else {
            lastHealthError = `Model version mismatch: expected ${modelVersion}, got ${healthData.model_version}`;
            console.log(`[deployToFly] ${lastHealthError}, retrying...`);
          }
        } else {
          lastHealthError = `Health check returned ${healthResponse.status}`;
          console.log(`[deployToFly] ${lastHealthError}, retrying...`);
        }
      } catch (error) {
        lastHealthError = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[deployToFly] Health check failed: ${lastHealthError}, retrying...`);
      }

      // Wait before next health check
      await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
    }

    if (!healthCheckSuccess) {
      return {
        success: false,
        error: `Health check failed to confirm new model version after ${HEALTH_CHECK_TIMEOUT / 1000}s: ${lastHealthError}`,
      };
    }

    const deploymentDuration = ((Date.now() - deploymentStartTime) / 1000).toFixed(1);
    console.log(`[deployToFly] Deployment completed successfully in ${deploymentDuration}s`);

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[deployToFly] Deployment failed:', errorMessage);

    if (error instanceof Error && error.stack) {
      console.error('[deployToFly] Stack trace:', error.stack);
    }

    return {
      success: false,
      error: `Deployment failed: ${errorMessage}`,
    };
  }
}
