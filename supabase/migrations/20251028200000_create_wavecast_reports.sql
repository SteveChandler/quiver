-- Migration: Create wavecast_reports table for storing scraped WaveCast surf forecasts
-- Description: Stores raw and parsed data from wavecast.com/socal/ to enhance forecast accuracy
-- Schedule: Scraped on Sundays, Tuesdays, and Thursdays at 8 AM PST

-- Create the wavecast_reports table
CREATE TABLE IF NOT EXISTS public.wavecast_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  report_date DATE NOT NULL UNIQUE,
  scrape_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT DEFAULT 'Nathan Cool',

  -- Raw content (for debugging and re-parsing if needed)
  full_text TEXT NOT NULL,
  html_content TEXT,

  -- Parsed structured data (JSONB for flexibility)
  parsed_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Per-beach forecasts (array of beach-specific predictions)
  beach_forecasts JSONB DEFAULT '[]'::jsonb,

  -- Overall conditions snapshot
  current_conditions JSONB,

  -- Multi-day outlook
  outlook JSONB,

  -- Data quality metrics
  parsing_confidence NUMERIC(3,2) CHECK (parsing_confidence >= 0 AND parsing_confidence <= 1),
  parsing_errors TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT wavecast_reports_unique_date UNIQUE (report_date),
  CONSTRAINT wavecast_reports_valid_json CHECK (
    jsonb_typeof(parsed_data) = 'object' AND
    jsonb_typeof(beach_forecasts) = 'array'
  )
);

-- Create indexes for common queries
CREATE INDEX idx_wavecast_reports_date ON public.wavecast_reports(report_date DESC);
CREATE INDEX idx_wavecast_reports_scrape_time ON public.wavecast_reports(scrape_timestamp DESC);
CREATE INDEX idx_wavecast_reports_created_at ON public.wavecast_reports(created_at DESC);

-- Create GIN index for JSONB queries
CREATE INDEX idx_wavecast_reports_parsed_data_gin ON public.wavecast_reports USING GIN (parsed_data);
CREATE INDEX idx_wavecast_reports_beach_forecasts_gin ON public.wavecast_reports USING GIN (beach_forecasts);

-- Enable Row Level Security (RLS)
ALTER TABLE public.wavecast_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (forecasts are public data)
CREATE POLICY "Public read access to wavecast reports"
  ON public.wavecast_reports
  FOR SELECT
  USING (true);

-- RLS Policy: Only service role can insert/update (via cron job)
CREATE POLICY "Service role can insert wavecast reports"
  ON public.wavecast_reports
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can update wavecast reports"
  ON public.wavecast_reports
  FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_wavecast_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_wavecast_reports_updated_at
  BEFORE UPDATE ON public.wavecast_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wavecast_reports_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.wavecast_reports IS
  'Stores scraped WaveCast expert surf forecasts from wavecast.com/socal/. Updated automatically via cron job on Sundays, Tuesdays, and Thursdays at 8 AM PST.';

COMMENT ON COLUMN public.wavecast_reports.report_date IS
  'The date this forecast report covers (unique constraint ensures one report per day)';

COMMENT ON COLUMN public.wavecast_reports.parsed_data IS
  'Structured forecast data extracted from HTML, including swells, wave forecasts, weather, etc.';

COMMENT ON COLUMN public.wavecast_reports.beach_forecasts IS
  'Array of beach-specific forecasts mapped to Quiver beach IDs';

COMMENT ON COLUMN public.wavecast_reports.parsing_confidence IS
  'Confidence score (0-1) indicating how successfully the HTML was parsed';

-- Grant permissions
GRANT SELECT ON public.wavecast_reports TO anon;
GRANT SELECT ON public.wavecast_reports TO authenticated;
GRANT ALL ON public.wavecast_reports TO service_role;
