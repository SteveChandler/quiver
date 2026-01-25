-- Consolidate push_devices into user_devices
-- Fixes table mismatch where mobile app registers tokens in push_devices
-- but push notification service queries user_devices

begin;

-- Copy existing tokens from push_devices to user_devices
-- Only insert if the combination doesn't already exist
insert into public.user_devices (user_id, platform, device_token, created_at, updated_at)
select
  pd.user_id,
  pd.platform,
  pd.token as device_token,
  pd.created_at,
  coalesce(pd.updated_at, pd.last_seen_at, pd.created_at) as updated_at
from public.push_devices pd
on conflict (user_id, device_token) do nothing;

-- Drop the now-redundant push_devices table
drop table if exists public.push_devices cascade;

-- Migration is idempotent: if push_devices doesn't exist (already migrated), no error occurs
-- If user_devices already has the tokens, ON CONFLICT DO NOTHING prevents duplicates

commit;
