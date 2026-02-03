-- Add RLS policy for service_role to read ml_predictions_log
-- This ensures the ML retrain endpoint can access training data
-- Note: service_role should bypass RLS by default, but having an explicit policy is good practice

-- Check if policy exists before creating (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ml_predictions_log'
        AND policyname = 'Service role can read all predictions'
    ) THEN
        CREATE POLICY "Service role can read all predictions"
        ON ml_predictions_log
        FOR SELECT
        TO service_role
        USING (true);
    END IF;
END $$;

COMMENT ON POLICY "Service role can read all predictions" ON ml_predictions_log IS
'Allows service_role to read all predictions for ML training pipeline';
