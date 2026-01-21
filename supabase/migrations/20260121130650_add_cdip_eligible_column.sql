-- Migration: Add cdip_eligible column to beaches table
-- Purpose: Track which beaches are within CDIP station coverage range
-- This fixes the bug where the CDIP cron job never updates beaches that weren't
-- initially seeded with CDIP data, causing "1% Confidence / Outdated" issues.

-- Add column to track CDIP eligibility
ALTER TABLE beaches
  ADD COLUMN IF NOT EXISTS cdip_eligible BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient filtering in cron job queries
CREATE INDEX IF NOT EXISTS idx_beaches_cdip_eligible_true
  ON beaches (cdip_eligible)
  WHERE cdip_eligible = TRUE;

COMMENT ON COLUMN beaches.cdip_eligible IS
  'True if beach is within CDIP station coverage range (typically 50-150km depending on station). Computed by backfill script based on haversine distance to nearest active CDIP station.';

-- Note: The existing cdip_station column can be used to store the assigned station ID.
-- A backfill script (scripts/backfill-cdip-eligibility.ts) should be run after this
-- migration to populate the cdip_eligible column for all existing beaches.
