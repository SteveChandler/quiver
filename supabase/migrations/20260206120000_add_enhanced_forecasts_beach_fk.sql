-- Add missing foreign key from enhanced_forecasts.beach_id to beaches.id
-- This enables PostgREST embedded resource joins (beaches!inner(...))
-- which are used by getCityTideData() in intent-forecast-actions.ts
ALTER TABLE enhanced_forecasts
  ADD CONSTRAINT enhanced_forecasts_beach_id_fkey
  FOREIGN KEY (beach_id) REFERENCES beaches(id);
