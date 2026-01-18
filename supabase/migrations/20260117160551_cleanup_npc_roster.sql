-- Migration: Cleanup NPC Roster
-- Part of the Realistic NPC System implementation
-- Deletes test data, removes duplicates, renames old-style NPCs to realistic names

BEGIN;

-- Allow destructive operations for this migration
SET LOCAL app.allow_destructive = 'on';

-- ============================================================================
-- STEP 1: Delete test posts from Test User
-- ============================================================================
DELETE FROM intel_posts
WHERE user_id = '610a5745-1fac-429c-8f5a-8d085783a5ea';

DELETE FROM sessions
WHERE user_id = '610a5745-1fac-429c-8f5a-8d085783a5ea';

DELETE FROM beach_reviews
WHERE user_id = '610a5745-1fac-429c-8f5a-8d085783a5ea';

-- ============================================================================
-- STEP 2: Delete Test User profile
-- ============================================================================
DELETE FROM profiles
WHERE id = '610a5745-1fac-429c-8f5a-8d085783a5ea';

-- Delete 'steve' test profile
DELETE FROM profiles
WHERE id = 'd6d1d315-48ba-4103-9c07-212510f17781';

-- ============================================================================
-- STEP 3: Update unconfigured NPCs to realistic names and add config
-- We'll update ONE profile per old name and delete the duplicates
-- ============================================================================

-- Update one Dana "Dawn Patrol" Wilson -> Ethan Brooks (competitor, central-coast)
UPDATE profiles SET
  full_name = 'Ethan Brooks',
  personality_type = 'competitor',
  home_region = 'central-coast',
  activity_level = 'high',
  posting_window = '{"primary": [6, 9], "secondary": [15, 18]}'::jsonb
WHERE id = '7d96a989-7677-4981-947b-b4be231999d7';

-- Update one Larry "Local" Thompson -> David Kim (local, orange-county)
UPDATE profiles SET
  full_name = 'David Kim',
  personality_type = 'local',
  home_region = 'orange-county',
  activity_level = 'high',
  posting_window = '{"primary": [5, 8], "secondary": [16, 19]}'::jsonb
WHERE id = '533a228f-b1cc-4212-b814-ace83dae75b7';

-- Update one Mia "Safety" Rodriguez -> Anika Patel (rookie, orange-county)
UPDATE profiles SET
  full_name = 'Anika Patel',
  personality_type = 'rookie',
  home_region = 'orange-county',
  activity_level = 'medium',
  posting_window = '{"primary": [9, 12], "secondary": [14, 17]}'::jsonb
WHERE id = 'f7132e8f-1548-4dd9-b9be-66d170096cda';

-- Update one Riley "Rookie" Rodriguez -> Emma Davis (rookie, south-san-diego)
UPDATE profiles SET
  full_name = 'Emma Davis',
  personality_type = 'rookie',
  home_region = 'south-san-diego',
  activity_level = 'medium',
  posting_window = '{"primary": [9, 12], "secondary": [14, 17]}'::jsonb
WHERE id = 'a11a608e-d0b7-43a2-88bc-e5cbe89a8935';

-- Update one Sofia "SoCal" Ramirez -> Priya Sharma (local, sf-bay-area)
UPDATE profiles SET
  full_name = 'Priya Sharma',
  personality_type = 'local',
  home_region = 'sf-bay-area',
  activity_level = 'high',
  posting_window = '{"primary": [5, 8], "secondary": [16, 19]}'::jsonb
WHERE id = '90e3093d-2b68-4787-8914-dc911b849d10';

-- Update one Tina "Travel" Chen -> Sofia Reyes (traveler, socal-visitor)
UPDATE profiles SET
  full_name = 'Sofia Reyes',
  personality_type = 'traveler',
  home_region = 'socal-visitor',
  activity_level = 'low',
  posting_window = '{"primary": [7, 11], "secondary": [15, 18]}'::jsonb
WHERE id = 'ab580176-b0d5-4afa-96f1-9abf7cb2e789';

-- Update Morning Intel Bot -> mark as system account (Quiver Surf Forecast already exists)
UPDATE profiles SET
  is_system_account = true,
  personality_type = 'forecaster',
  home_region = 'all-regions',
  activity_level = 'high'
WHERE id = 'f2472229-100e-4a8a-ae6e-bc8b23d7cf87';

-- Update Quiver Surf Forecast to be a system account
UPDATE profiles SET
  is_system_account = true
WHERE id = '3290f65d-b474-49e2-ac5e-27de2db3fc9e';

-- ============================================================================
-- STEP 4: Add posting_window config to existing configured NPCs
-- ============================================================================

-- Locals: dawn patrol + after work
UPDATE profiles SET posting_window = '{"primary": [5, 8], "secondary": [16, 19]}'::jsonb
WHERE personality_type = 'local' AND posting_window IS NULL AND is_mock = true;

-- Rookies: mid-morning + afternoon
UPDATE profiles SET posting_window = '{"primary": [9, 12], "secondary": [14, 17]}'::jsonb
WHERE personality_type = 'rookie' AND posting_window IS NULL AND is_mock = true;

-- Travelers: tourist hours
UPDATE profiles SET posting_window = '{"primary": [7, 11], "secondary": [15, 18]}'::jsonb
WHERE personality_type = 'traveler' AND posting_window IS NULL AND is_mock = true;

-- Photographers: golden hours
UPDATE profiles SET posting_window = '{"primary": [5, 7], "secondary": [17, 20]}'::jsonb
WHERE personality_type = 'photographer' AND posting_window IS NULL AND is_mock = true;

-- Tactical: pre-dawn recon + midday
UPDATE profiles SET posting_window = '{"primary": [5, 6], "secondary": [11, 13]}'::jsonb
WHERE personality_type = 'tactical' AND posting_window IS NULL AND is_mock = true;

-- Competitors: training blocks
UPDATE profiles SET posting_window = '{"primary": [6, 9], "secondary": [15, 18]}'::jsonb
WHERE personality_type = 'competitor' AND posting_window IS NULL AND is_mock = true;

-- Forecaster: early morning only
UPDATE profiles SET posting_window = '{"primary": [5, 6], "secondary": []}'::jsonb
WHERE personality_type = 'forecaster' AND posting_window IS NULL AND is_mock = true;

-- ============================================================================
-- STEP 5: Delete duplicate/old-style profiles
-- (Only delete profiles that have unconfigured duplicates we're not using)
-- ============================================================================

-- Delete duplicate Dana "Dawn Patrol" Wilson
DELETE FROM profiles WHERE id = '6f8b9150-e399-4ab3-8f2f-5a1b58bb5153';

-- Delete duplicate Larry "Local" Thompson
DELETE FROM profiles WHERE id = '4739cd65-99b5-4c70-bda3-68f5ff4ea16e';

-- Delete remaining Mia "Safety" Rodriguez duplicates
DELETE FROM profiles WHERE id IN ('bbce7f0b-58f3-4814-a529-b28abce24d4a', '7d482e7b-4cd7-4c35-88e5-4262b89c0ee1');

-- Delete remaining Riley "Rookie" Rodriguez duplicates
DELETE FROM profiles WHERE id IN ('4fa6d995-32f5-4ac8-ae6f-791191536741', '67a3df17-8af1-4b09-ae0f-e8cf114590a1');

-- Delete remaining Sofia "SoCal" Ramirez duplicate
DELETE FROM profiles WHERE id = '098af0cb-80ca-41c4-8563-96c7b0c67e6e';

-- Delete remaining Tina "Travel" Chen duplicates
DELETE FROM profiles WHERE id IN ('2da9ea1d-4b93-420d-b399-076a60045cc1', '457b8242-0012-43e7-a9cc-60987ca4965e');

-- Delete all Big Boss (unconfigured)
DELETE FROM profiles WHERE id IN ('ddd136cf-6aba-4409-acb9-bbf380f39624', '69ff3604-7378-4219-aff5-ef493b622acf');

-- Delete all Emma "Weather" Foster (unconfigured, Sarah Tanaka covers this)
DELETE FROM profiles WHERE id IN ('c9cde5f1-fca3-4e77-9a64-3f7ed5615e38', '3e326e21-a042-47cf-9af6-af92e2ea3f39', '7432bf3c-2b5d-42ce-a1d7-b756d6a5cac8');

-- Delete all Jake "NorCal" Anderson (Chris Morales covers norcal-visitor)
DELETE FROM profiles WHERE id IN ('5c753211-ea61-4c57-affa-749d20bd479a', 'b11fce44-77a6-45ea-beb9-50dc64938d61');

-- Delete all Kai "Hawaii" Nakamura and Kai N. (Kai Nakamura configured exists)
DELETE FROM profiles WHERE id IN ('65867669-b6f3-40fe-a7e7-b1dec52e754e', '6c35cc06-543c-4b38-8743-bcb02a7adac2', '0b7c77bc-bd7e-4365-8064-ee1f428b4119');

-- Delete all Liquid Snake (Tyler OBrien covers competitor)
DELETE FROM profiles WHERE id IN ('c489a74c-1e71-498a-8cc1-751c108d6436', '2fb00791-2e04-41f1-87d5-f14f95b8fb65');

-- Delete all Marcus "East Coast" Johnson (Nina Okonkwo covers norcal-visitor)
DELETE FROM profiles WHERE id IN ('1ff4503f-17c4-4a8d-996f-f9f8f9671f0a', '91166014-f184-4bbc-8b54-37c65018de57');

-- Delete all Paul "PhotoPro" Martinez (Maya Johnson covers photographer)
DELETE FROM profiles WHERE id IN ('2c1a628a-23d0-432d-9188-58f3656dbcc2', '4ce27d5d-0f6b-4017-839e-1c3d18385822');

-- Delete Ryan K. (Ryan Fitzgerald exists)
DELETE FROM profiles WHERE id = '39ff26a7-b562-473b-805e-035ab6ec369e';

-- Delete all Ryan "Tech" Kumar
DELETE FROM profiles WHERE id IN ('e3a80360-046c-4e0a-b4c6-b55e46479aca', 'af91dfd0-f91d-4061-8e1a-49a3b7f25c15');

-- Delete all Solid Snake (Mike Patterson covers tactical)
DELETE FROM profiles WHERE id IN ('1927c090-3125-4918-88e1-47c3316bbac0', '09d542e6-4aae-47bd-be2f-bb767fae08d0', 'bcdc5d59-2e22-4006-98a6-cada8618577a');

-- ============================================================================
-- STEP 6: Reassign orphaned content from deleted NPCs to remaining NPCs
-- This prevents foreign key violations
-- ============================================================================

-- First, identify any content from deleted profiles and reassign to similar NPCs
-- We'll reassign to NPCs of the same personality type where possible

-- For simplicity, we'll just delete orphaned content from the deleted NPCs
-- since they were duplicates and the content would be redundant anyway
DELETE FROM intel_posts WHERE user_id NOT IN (SELECT id FROM profiles);
DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM profiles);
DELETE FROM beach_reviews WHERE user_id NOT IN (SELECT id FROM profiles);

-- ============================================================================
-- Summary: Final NPC roster should have ~26 profiles:
-- - 20 originally configured NPCs
-- - 6 newly configured from renamed profiles
-- - 2 system accounts (Morning Intel Bot, Quiver Surf Forecast)
-- ============================================================================

COMMIT;
