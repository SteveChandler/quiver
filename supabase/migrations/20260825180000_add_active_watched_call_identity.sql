begin;

alter table public.alert_rules
  drop constraint if exists alert_rules_preset_type_check;

alter table public.alert_rules
  add constraint alert_rules_preset_type_check
  check (preset_type in (
    'glass_off',
    'big_day',
    'clean_groundswell',
    'mellow_session',
    'tide_window',
    'dawn_patrol',
    'epic_conditions',
    'similarity_alert',
    'similarity_match',
    'daily_check_in',
    'weekend_warrior',
    'after_work',
    'watched_call'
  ));

create unique index if not exists alert_rules_active_watched_call_identity_uidx
  on public.alert_rules (
    user_id,
    ((conditions #>> '{watched_call,dedupeKey}'))
  )
  where enabled = true
    and preset_type = 'watched_call'
    and conditions #>> '{watched_call,dedupeKey}' is not null;

commit;
