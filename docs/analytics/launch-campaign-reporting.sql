-- Quiver launch campaign reporting queries.
-- Read-only. Avoids PII and groups by safe campaign, path, CTA, and tracker
-- metadata fields. Set the reporting window before running.

-- Recommended setup:
-- \set start_at '''2026-05-24T00:00:00Z'''
-- \set end_at '''2026-06-08T00:00:00Z'''

-- 1. Launch page views by surface and route.
select
  metadata->>'launch_campaign' as launch_campaign,
  metadata->>'launch_surface' as launch_surface,
  metadata->>'launch_content_group' as launch_content_group,
  metadata->>'pathname' as pathname,
  count(*) as events,
  count(distinct coalesce(user_id::text, session_id::text)) as visitors
from public.user_events
where event_type = 'page_view'
  and metadata->>'launch_campaign' = 'go_live_2026_05'
  and created_at >= :start_at::timestamptz
  and created_at < :end_at::timestamptz
group by 1, 2, 3, 4
order by events desc;

-- 2. iOS App Store CTA funnel by source, surface, placement, and status.
select
  event_type,
  metadata->>'source' as source,
  metadata->>'surface' as surface,
  metadata->>'placement' as placement,
  metadata->>'platform' as platform,
  metadata->>'destination_type' as destination_type,
  metadata->>'destination_status' as destination_status,
  count(*) as events,
  count(distinct coalesce(user_id::text, session_id::text)) as visitors
from public.user_events
where event_type in ('cta_impression', 'cta_click')
  and metadata->>'cta_family' = 'ios_app'
  and created_at >= :start_at::timestamptz
  and created_at < :end_at::timestamptz
group by 1, 2, 3, 4, 5, 6, 7
order by source, surface, placement, event_type;

-- 3. Pricing and founding-access waitlist funnel.
select
  event_type,
  metadata->>'source' as source,
  metadata->>'surface' as surface,
  metadata->>'cta_type' as cta_type,
  metadata->>'cta_text' as cta_text,
  metadata->>'cta_copy_variant' as cta_copy_variant,
  count(*) as events,
  count(distinct coalesce(user_id::text, session_id::text)) as visitors
from public.user_events
where event_type in ('signup_cta_view', 'signup_cta_click')
  and metadata->>'cta_type' = 'founding_access_waitlist'
  and created_at >= :start_at::timestamptz
  and created_at < :end_at::timestamptz
group by 1, 2, 3, 4, 5, 6
order by source, event_type;

-- 4. Launch blog cross-link clicks into downstream surfaces.
select
  metadata->>'blog_slug' as blog_slug,
  metadata->>'placement' as placement,
  metadata->>'cta_text' as cta_text,
  metadata->>'destination_type' as destination_type,
  metadata->>'destination_path' as destination_path,
  count(*) as events,
  count(distinct coalesce(user_id::text, session_id::text)) as visitors
from public.user_events
where event_type = 'cta_click'
  and metadata->>'cta_family' = 'launch_blog_cross_link'
  and metadata->>'launch_campaign' = 'go_live_2026_05'
  and created_at >= :start_at::timestamptz
  and created_at < :end_at::timestamptz
group by 1, 2, 3, 4, 5
order by events desc;

-- 5. Launch-attributed auth outcomes by session.
with launch_sessions as (
  select distinct session_id
  from public.user_events
  where session_id is not null
    and metadata->>'launch_campaign' = 'go_live_2026_05'
    and created_at >= :start_at::timestamptz
    and created_at < :end_at::timestamptz
)
select
  e.event_type,
  count(*) as events,
  count(distinct coalesce(e.user_id::text, e.session_id::text)) as visitors
from public.user_events e
join launch_sessions s on s.session_id = e.session_id
where e.event_type in (
  'auth_modal_opened',
  'auth_method_selected',
  'auth_provider_selected',
  'signup_started',
  'signup_form_submitted',
  'signup_success',
  'login_success'
)
  and e.created_at >= :start_at::timestamptz
  and e.created_at < :end_at::timestamptz
group by 1
order by events desc;

-- 6. App Store prompt/beta prompt observability during launch window.
select
  event_type,
  metadata->>'source' as source,
  metadata->>'device_mode' as device_mode,
  metadata->>'platform_guess' as platform_guess,
  metadata->>'destination_url' as destination_url,
  count(*) as events,
  count(distinct coalesce(user_id::text, session_id::text)) as visitors
from public.user_events
where event_type in (
  'apple_beta_prompt_eligible',
  'apple_beta_prompt_viewed',
  'apple_beta_prompt_qr_rendered',
  'apple_beta_prompt_open_testflight_clicked',
  'apple_beta_prompt_copy_link_clicked',
  'apple_beta_prompt_dismissed'
)
  and created_at >= :start_at::timestamptz
  and created_at < :end_at::timestamptz
group by 1, 2, 3, 4, 5
order by event_type;
