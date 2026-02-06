import { createClient } from '@supabase/supabase-js';
import {
  validateCronRequest,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-utils';
import { createServiceRoleClient } from '@/lib/supabase';

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
  model_url?: string;  // Keep for backwards compat
  model_data?: string;  // Base64 encoded model JSON (avoids ephemeral storage 404)
  error?: string;
}

/**
 * GET/POST /api/cron/ml/retrain
 *
 * Orchestrates the ML model retraining pipeline:
 * 1. Extract training data from ml_predictions_log (max 365 days)
 * 2. Call ML service to train new v3 model
 * 3. Run validation gates on holdout set
 * 4. If PASS: Deploy to Fly.io, update ml_model_registry
 * 5. If FAIL: Log failure, keep current model
 *
 * This is a long-running operation that may take several minutes.
 * Supports both GET (Vercel cron) and POST (manual trigger).
 *
 * @see docs/plans/2026-02-01-ml-rolling-pipeline-design.md
 */
async function handleRetrain(request: Request) {
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

  // Use the standard service role client which has proper auth configuration
  const supabase = createServiceRoleClient();

  const trainingStartedAt = new Date().toISOString();
  // Include timestamp to ensure unique version even on same day
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toISOString().split('T')[1].slice(0, 5).replace(':', '');
  const modelVersion = `v3.${dateStr}.${timeStr}`;

  console.log(`[ML Retrain] Starting pipeline for ${modelVersion}`);

  try {
    // =======================================================================
    // STEP 1: Extract Training Data
    // =======================================================================
    console.log('[ML Retrain] Step 1: Extracting training data...');

    // Use 90 days for training (increased after scaling ML service to 2GB)
    const maxDaysBack = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDaysBack);

    // Limit total samples to avoid 4-minute API timeout
    // Memory supports ~100K but request times out at ~60K samples
    // See: docs/plans/2026-02-01-ml-rolling-pipeline-design.md for infrastructure tracking
    const MAX_TRAINING_SAMPLES = 50000;

    // Extract all predictions with ground truth (observed_m is not null)
    // Join with beaches table to get terrain factors
    // Use pagination to fetch all rows
    // Note: Supabase API has a default 1000 row limit, so we use 1000 per page
    const PAGE_SIZE = 1000;
    const trainingData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch predictions without JOIN (much faster)
      // Terrain factors will be fetched separately for unique beaches
      const { data: pageData, error: extractError, count } = await supabase
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
          wind_direction_deg
        `,
          { count: 'exact' }
        )
        .gt('observed_m', 0)  // Exclude nulls and sentinel values (-1)
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
        // Continue pagination if we got data and haven't hit sample limit
        hasMore = count !== null && trainingData.length < count && trainingData.length < MAX_TRAINING_SAMPLES;
        page++;
      } else {
        hasMore = false;
      }

      // Check sample limit
      if (trainingData.length >= MAX_TRAINING_SAMPLES) {
        console.log(`[ML Retrain] Reached max training samples limit (${MAX_TRAINING_SAMPLES})`);
        hasMore = false;
      }

      // Safety limit: max 500 pages (500k rows with 1000 per page)
      if (page >= 500) {
        console.warn('[ML Retrain] Reached max pagination limit (500k rows)');
        hasMore = false;
      }
    }

    console.log(`[ML Retrain] Extracted ${trainingData.length} training samples in ${page} pages`);

    if (trainingData.length === 0) {
      console.warn('[ML Retrain] No training data available');
      return createSuccessResponse({
        message: 'No training data available',
        model_version: modelVersion,
        status: 'skipped',
      });
    }

    // Fetch terrain factors for unique beaches (separate query for performance)
    const uniqueBeachIds = [...new Set(trainingData.map((d) => d.beach_id))];
    console.log(`[ML Retrain] Fetching terrain factors for ${uniqueBeachIds.length} beaches...`);

    const { data: beachesData, error: beachesError } = await supabase
      .from('beaches')
      .select('id, swell_access_factors, wind_exposure_factors')
      .in('id', uniqueBeachIds);

    if (beachesError) {
      console.error('[ML Retrain] Failed to fetch terrain factors:', beachesError);
      // Continue without terrain factors (will use defaults)
    }

    // Create lookup map for terrain factors
    const terrainMap = new Map<string, { swell_access_factors: number[] | null; wind_exposure_factors: number[] | null }>();
    if (beachesData) {
      for (const beach of beachesData) {
        terrainMap.set(beach.id, {
          swell_access_factors: beach.swell_access_factors,
          wind_exposure_factors: beach.wind_exposure_factors,
        });
      }
    }

    // Merge terrain factors into training data
    for (const row of trainingData) {
      const terrain = terrainMap.get(row.beach_id);
      row.swell_access_factors = terrain?.swell_access_factors || null;
      row.wind_exposure_factors = terrain?.wind_exposure_factors || null;
    }

    console.log(`[ML Retrain] Terrain factors merged for ${terrainMap.size} beaches`);

    // Log training data quality statistics
    const stats = computeTrainingStats(trainingData, uniqueBeachIds);
    console.log('[ML Retrain] Training data statistics:');
    console.log(`  - Total samples: ${stats.totalSamples}`);
    console.log(`  - Unique beaches: ${stats.uniqueBeaches}`);
    console.log(`  - Date range: ${stats.minDate} to ${stats.maxDate}`);
    console.log(`  - Days covered: ${stats.daysCovered}`);
    console.log(`  - Avg samples/beach: ${stats.avgSamplesPerBeach.toFixed(1)}`);
    console.log(`  - Min samples/beach: ${stats.minSamplesPerBeach} (beach: ${stats.minSamplesBeachId})`);
    console.log(`  - Bucket distribution: small=${stats.buckets.small}, medium=${stats.buckets.medium}, large=${stats.buckets.large}`);

    // Filter out beaches with insufficient samples for reliable training
    const MIN_SAMPLES_PER_BEACH = 10;
    const beachSampleCounts = new Map<string, number>();
    for (const d of trainingData) {
      beachSampleCounts.set(d.beach_id, (beachSampleCounts.get(d.beach_id) || 0) + 1);
    }

    const lowSampleBeaches = Array.from(beachSampleCounts.entries())
      .filter(([, count]) => count < MIN_SAMPLES_PER_BEACH);

    if (lowSampleBeaches.length > 0) {
      console.warn(`[ML Retrain] Filtering ${lowSampleBeaches.length} beaches with <${MIN_SAMPLES_PER_BEACH} samples`);
      const validBeachIds = new Set(
        Array.from(beachSampleCounts.entries())
          .filter(([, count]) => count >= MIN_SAMPLES_PER_BEACH)
          .map(([id]) => id)
      );

      const originalLength = trainingData.length;
      const filteredData = trainingData.filter(d => validBeachIds.has(d.beach_id));
      console.log(`[ML Retrain] Samples after filtering: ${filteredData.length} (removed ${originalLength - filteredData.length})`);

      // Replace trainingData with filtered version
      trainingData.length = 0;
      trainingData.push(...filteredData);
    }

    // Guard against empty training data after filtering
    if (trainingData.length === 0) {
      console.warn('[ML Retrain] No training data remaining after filtering beaches with insufficient samples');
      return createSuccessResponse({
        message: 'No training data remaining after filtering beaches with insufficient samples',
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
    console.log(`[ML Retrain] Step 3: Sending ${trainingData.length} samples to ML service...`);

    let trainResponse: TrainResponse;

    try {
      // Prepare training request payload
      // Transform trainingData to include terrain factors
      const mappedData = trainingData.map((record: any) => ({
        beach_id: record.beach_id,
        predicted_at: record.predicted_at,
        raw_forecast_m: record.raw_forecast_m,
        observed_m: record.observed_m,
        wave_period_s: record.wave_period_s,
        wave_direction_deg: record.wave_direction_deg,
        wind_speed_ms: record.wind_speed_ms,
        wind_direction_deg: record.wind_direction_deg,
        swell_access_factors: record.swell_access_factors || null,
        wind_exposure_factors: record.wind_exposure_factors || null,
      }));

      const trainingPayload = {
        version: modelVersion,
        training_data: mappedData,
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
        signal: AbortSignal.timeout(270000), // 4.5 minute timeout for training
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
        trainResponse.model_url || '',
        trainResponse.model_data  // Pass inline model data if available
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

interface TrainingStats {
  totalSamples: number;
  uniqueBeaches: number;
  minDate: string;
  maxDate: string;
  daysCovered: number;
  avgSamplesPerBeach: number;
  minSamplesPerBeach: number;
  minSamplesBeachId: string;
  buckets: { small: number; medium: number; large: number };
}

/**
 * Compute statistics about training data quality
 */
function computeTrainingStats(data: any[], beachIds: string[]): TrainingStats {
  const byBeach = new Map<string, number>();
  let minDate = new Date();
  let maxDate = new Date(0);
  const buckets = { small: 0, medium: 0, large: 0 };

  for (const d of data) {
    // Count per beach
    byBeach.set(d.beach_id, (byBeach.get(d.beach_id) || 0) + 1);

    // Track date range
    const dt = new Date(d.predicted_at);
    if (dt < minDate) minDate = dt;
    if (dt > maxDate) maxDate = dt;

    // Bucket by wave size
    const height = d.observed_m;
    if (height < 0.5) buckets.small++;
    else if (height <= 1.5) buckets.medium++;
    else buckets.large++;
  }

  const samplesPerBeach = Array.from(byBeach.values());
  const minSamples = samplesPerBeach.length > 0 ? Math.min(...samplesPerBeach) : 0;
  const minIdx = samplesPerBeach.indexOf(minSamples);
  const minBeachId = Array.from(byBeach.keys())[minIdx] || 'unknown';

  return {
    totalSamples: data.length,
    uniqueBeaches: beachIds.length,
    minDate: minDate.toISOString().split('T')[0],
    maxDate: maxDate.toISOString().split('T')[0],
    daysCovered: Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)),
    avgSamplesPerBeach: beachIds.length > 0 ? data.length / beachIds.length : 0,
    minSamplesPerBeach: minSamples,
    minSamplesBeachId: minBeachId,
    buckets
  };
}

/**
 * Deploy model to Fly.io
 *
 * Implementation:
 * 1. Upload model artifact to Supabase Storage (accessible by ML service)
 *    - Prefers inline model_data (base64) to avoid ephemeral storage 404 issues
 *    - Falls back to modelUrl fetch for backwards compatibility
 * 2. Use Fly.io GraphQL API to set secrets (MODEL_VERSION, MODEL_PATH)
 *    - Secrets override env vars baked into Docker images
 *    - Setting secrets triggers automatic rolling redeployment
 * 3. Poll health endpoint until new model version is confirmed
 *
 * NOTE: Previous approach used Fly Machines API to update env vars, but these
 * don't reliably propagate due to Docker image layer caching. Secrets always
 * override other env var sources and trigger proper redeployment.
 *
 * Timeout: 2.5 minutes for entire deployment process (secrets trigger redeploy)
 */
async function deployToFly(
  modelVersion: string,
  modelUrl: string,
  modelDataB64?: string  // Base64 encoded model data (preferred over URL)
): Promise<{ success: boolean; error?: string }> {
  const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  const FLY_APP_NAME = process.env.FLY_APP_NAME || 'quiver-ml';
  const HEALTH_URL = process.env.ML_SERVICE_URL
    ? `${process.env.ML_SERVICE_URL}/health`
    : 'https://quiver-ml.fly.dev/health';
  const DEPLOYMENT_TIMEOUT = 150000; // 2.5 minutes (secrets trigger rolling redeploy)
  const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds (machines need time to restart)
  const HEALTH_CHECK_TIMEOUT = 90000; // 1.5 minutes for health checks (rolling deploy takes time)

  // Validate required environment variables
  if (!FLY_API_TOKEN) {
    console.error('[deployToFly] FLY_API_TOKEN not configured');
    return {
      success: false,
      error: 'FLY_API_TOKEN environment variable not set',
    };
  }

  // Validate we have either inline model data or a URL
  if (!modelDataB64 && !modelUrl) {
    console.error('[deployToFly] No model data or URL provided');
    return {
      success: false,
      error: 'Either model_data or model_url is required for deployment',
    };
  }

  // If using URL (fallback), validate it's from trusted source
  if (!modelDataB64 && modelUrl) {
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
  }

  const deploymentStartTime = Date.now();
  console.log(`[deployToFly] Starting deployment of ${modelVersion}`);
  console.log(`[deployToFly] Model URL: ${modelUrl}`);

  try {
    // =======================================================================
    // STEP 1: Upload Model to Supabase Storage
    // =======================================================================
    console.log('[deployToFly] Step 1: Uploading model to Supabase Storage...');

    // Use the standard service role client which has proper auth configuration
    const supabase = createServiceRoleClient();

    // Get model data - prefer inline base64 data over URL fetch
    // This avoids 404 errors from Fly.io ephemeral storage
    let modelData: ArrayBuffer;

    if (modelDataB64) {
      // Decode base64 model data returned directly from training
      console.log('[deployToFly] Using inline model data from training response');
      const binaryString = atob(modelDataB64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      modelData = bytes.buffer;
      console.log(`[deployToFly] Decoded model size: ${modelData.byteLength} bytes`);
    } else {
      // Fallback: Download model from URL (backwards compatibility)
      console.log(`[deployToFly] Fetching model from URL: ${modelUrl}`);
      const modelResponse = await fetch(modelUrl, {
        signal: AbortSignal.timeout(30000), // 30 second timeout for download
      });

      if (!modelResponse.ok) {
        throw new Error(`Failed to download model: ${modelResponse.status} ${modelResponse.statusText}`);
      }

      modelData = await modelResponse.arrayBuffer();
      console.log(`[deployToFly] Downloaded model size: ${modelData.byteLength} bytes`);
    }
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
    // STEP 2: Set Fly.io Secrets via GraphQL API
    // =======================================================================
    // Using secrets instead of machine env vars because:
    // - Secrets always override env vars baked into Docker images
    // - Setting secrets triggers automatic rolling redeployment
    // - Previous approach with Machines API env vars didn't reliably propagate
    console.log('[deployToFly] Step 2: Setting Fly.io secrets via GraphQL...');

    const FLY_GRAPHQL_URL = 'https://api.fly.io/graphql';

    // GraphQL mutation to set secrets
    // This triggers an automatic rolling deployment of all machines
    const setSecretsMutation = `
      mutation SetSecrets($appId: ID!, $secrets: [SecretInput!]!) {
        setSecrets(input: {appId: $appId, secrets: $secrets}) {
          app {
            name
          }
        }
      }
    `;

    const secretsPayload = {
      query: setSecretsMutation,
      variables: {
        appId: FLY_APP_NAME,
        secrets: [
          { key: 'MODEL_VERSION', value: modelVersion },
          { key: 'MODEL_PATH', value: publicModelUrl },
        ],
      },
    };

    console.log(`[deployToFly] Setting secrets: MODEL_VERSION=${modelVersion}, MODEL_PATH=${publicModelUrl}`);

    const secretsResponse = await fetch(FLY_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(secretsPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!secretsResponse.ok) {
      const errorText = await secretsResponse.text();
      console.error('[deployToFly] GraphQL request failed:', errorText);
      return {
        success: false,
        error: `Failed to set Fly.io secrets: ${secretsResponse.status} - ${errorText}`,
      };
    }

    const secretsResult = await secretsResponse.json();

    // Check for GraphQL errors
    if (secretsResult.errors && secretsResult.errors.length > 0) {
      const errorMessages = secretsResult.errors.map((e: any) => e.message).join('; ');
      console.error('[deployToFly] GraphQL errors:', secretsResult.errors);
      return {
        success: false,
        error: `GraphQL errors setting secrets: ${errorMessages}`,
      };
    }

    console.log('[deployToFly] Secrets set successfully, rolling deployment triggered');
    console.log('[deployToFly] GraphQL response:', JSON.stringify(secretsResult.data));

    // =======================================================================
    // STEP 3: Wait for Rolling Deployment
    // =======================================================================
    console.log('[deployToFly] Step 3: Waiting for rolling deployment to complete...');

    // Setting secrets triggers automatic rolling redeployment
    // Give machines time to restart before polling health endpoint
    // Typical restart time is 20-40 seconds for rolling deploy
    await new Promise(resolve => setTimeout(resolve, 15000));

    // =======================================================================
    // STEP 4: Poll Health Endpoint for New Model Version
    // =======================================================================
    console.log('[deployToFly] Step 4: Polling health endpoint...');

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

// Export handlers for both GET (Vercel cron) and POST (manual trigger)
export async function GET(request: Request) {
  return handleRetrain(request);
}

export async function POST(request: Request) {
  return handleRetrain(request);
}
