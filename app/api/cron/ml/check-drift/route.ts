import { createClient } from '@supabase/supabase-js';

// Quick drift check operation - calls database function and potentially triggers retrain
export const maxDuration = 120; // Allow time for potential retrain trigger

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
        error: `Retrain failed: ${errorText}`,
      }, { status: 500 });
    }

    const retrainResult = await retrainResponse.json();
    console.log('Retrain triggered successfully:', retrainResult);

    return Response.json({
      drift_detected: true,
      retrain_triggered: true,
      retrain_result: retrainResult,
    });
  } catch (triggerError) {
    console.error('Failed to trigger retrain:', triggerError);
    return Response.json({
      drift_detected: true,
      retrain_triggered: false,
      error: `Failed to trigger retrain: ${triggerError instanceof Error ? triggerError.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
