-- Only the production-shaped ledger fields consumed by the exact activation artifact.
-- This database is cloned from the disposable migrated schema and never contacts production.
INSERT INTO public.beaches(id) VALUES
  ('01330afc-00d3-461b-88f3-b173774766f4'),('025cfc18-8357-49d6-994e-e0abf0a16f6d'),
  ('2609a9ff-d247-4e0b-888f-a793ff7177a5'),('2ac8b200-fdf2-4822-bcb1-3ec336b83d05'),
  ('4b0cf129-c706-4e24-8210-2219defc5ea7'),('6a0674ac-3e6d-49f3-9fd4-a4f1857c408a'),
  ('72726bcb-bed0-4b76-8336-f90d7fb57159'),('d264fbf8-0525-4d31-adb5-9a0742eaeb7e'),
  ('e8a921b7-c2b5-4259-9e5c-bd06765f7ae4'),('f11ccd59-b778-4ea1-a8ff-88bffb447cd8');
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'revoked',repeat('a',64),'{"volume_caps":{"maximum_candidates_per_region":50,"maximum_recipients_per_event":1000,"maximum_projected_sends_per_window":1000},"provider_failure_hold":{"window_minutes":60,"maximum_failure_rate":0.05,"minimum_samples":20},"staleness":{"maximum_forecast_age_hours":6},"cadence":{"evaluation_interval_minutes":60},"partition_matching":{"maximum_arrival_delta_hours":6,"maximum_period_delta_s":2,"maximum_direction_delta_deg":25}}',
  'fixture',repeat('b',64),'2026-09-01T00:00Z','2026-10-25T02:45:47.591003Z');
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
SELECT 2,'active','86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f',policy_values,
  'fixture','6ac158d19ffd55505609efae9ce6b634bea9d92342c133333fdc91fe29471403',not_before,expires_at
FROM public.swell_watch_evaluation_policies WHERE epoch=1;
SELECT set_config('app.swell_watch_internal_write','on',false);
INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'disabled','study_activation_fixture');
