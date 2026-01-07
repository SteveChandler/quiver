-- Add forecast_vs_actual column to session_forecast_snapshots
-- This column stores the calculated diff between forecast and actual conditions
-- Only includes fields where both forecast and actual values exist AND differ

ALTER TABLE session_forecast_snapshots
ADD COLUMN IF NOT EXISTS forecast_vs_actual JSONB;

-- Add index for querying forecast_vs_actual
CREATE INDEX IF NOT EXISTS idx_sfs_forecast_vs_actual_gin
ON session_forecast_snapshots USING GIN (forecast_vs_actual);

-- Add comment explaining the column
COMMENT ON COLUMN session_forecast_snapshots.forecast_vs_actual IS
'Calculated diff between forecast and actual conditions. Only includes fields where both values exist and differ. Format: { field_name: { forecast: value, actual: value, diff: numeric_diff } }';
