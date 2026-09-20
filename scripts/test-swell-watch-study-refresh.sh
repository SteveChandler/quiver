# Sourced only by the disposable PostgreSQL harness.
query 'CREATE DATABASE study_refresh TEMPLATE postgres'
study_database=study_refresh
# The refresh cycle uses the reviewed 12-hour age window, not the legacy activation fixture's six.
run_file <(sed 's/"maximum_forecast_age_hours":6/"maximum_forecast_age_hours":12/' "$study_root/__tests__/fixtures/swell-watch-study-activation.sql") >/dev/null
run_file "$study_root/__tests__/fixtures/swell-watch-study-receipts.sql" >/dev/null
run_file "$study_root/__tests__/fixtures/swell-watch-study-refresh-receipts.sql" >/dev/null
run_file "$study_root/__tests__/fixtures/swell-watch-study-refresh.sql" >/dev/null
refresh_artifact="$study_root/docs/operations/swell-watch-study-refresh-ocean-beach-sf.sql"
refresh_revoke="$study_root/docs/operations/swell-watch-study-revoke-refreshed.sql"
refresh_expect_error() {
  local artifact="$1" expected="$2" error before after
  before=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a')
  if error=$(run_file "$artifact" 2>&1); then
    echo "Expected rejection: $expected" >&2; exit 1
  elif [[ "$error" != *"$expected"* ]]; then
    echo "$error" >&2; exit 1
  fi
  after=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a')
  if [ "$before" != "$after" ]; then echo 'Rejected artifact changed authority' >&2; exit 1; fi
}
refresh_expect_error "$refresh_revoke" 'reviewed epoch2 refresh required'
query 'CREATE DATABASE study_refresh_sends TEMPLATE study_refresh'
study_database=study_refresh_sends
query "SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'armed','fixture')"
refresh_expect_error "$refresh_artifact" 'reviewed active evaluation policy and disabled sends required'
study_database=study_refresh
# Extra computation-input drift must not be incorporated into the refreshed hash.
query 'CREATE DATABASE study_refresh_drift TEMPLATE study_refresh'
study_database=study_refresh_drift
query "UPDATE public.beaches SET lat=lat+0.001 WHERE id='01330afc-00d3-461b-88f3-b173774766f4'"
refresh_expect_error "$refresh_artifact" 'only approved Ocean Beach SF longitude correction permitted'
study_database=study_refresh
run_file "$refresh_artifact" >/dev/null
refresh_before=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a')
run_file "$refresh_artifact" >/dev/null
refresh_after=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a')
if [ "$refresh_before" != "$refresh_after" ]; then echo 'Refresh retry changed authority' >&2; exit 1; fi
query 'CREATE DATABASE study_refresh_retry_sends TEMPLATE study_refresh'
study_database=study_refresh_retry_sends
query "SELECT set_config('app.swell_watch_internal_write','on',false); INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'armed','fixture')"
refresh_expect_error "$refresh_artifact" 'reviewed active evaluation policy and disabled sends required'
study_database=study_refresh
query 'CREATE DATABASE study_refresh_retry_drift TEMPLATE study_refresh'
study_database=study_refresh_retry_drift
query "UPDATE public.beaches SET terrain_enabled=NOT coalesce(terrain_enabled,false) WHERE id='01330afc-00d3-461b-88f3-b173774766f4'"
refresh_expect_error "$refresh_artifact" 'only approved Ocean Beach SF longitude correction permitted'
study_database=study_refresh
run_file "$study_root/__tests__/fixtures/swell-watch-study-refresh-check.sql" >/dev/null
# Exact revoked retry must preserve both temporal fields, not just config hash.
for validity_field in not_before expires_at; do
  query "CREATE DATABASE study_refresh_revoke_$validity_field TEMPLATE study_refresh"
  study_database="study_refresh_revoke_$validity_field"
  query "INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at) SELECT 3,'revoked',policy_hash,cohort,scope_inputs,config_hash,target_days,provider_contract_ref,evidence_sha256,reviewer,not_before+CASE WHEN '$validity_field'='not_before' THEN interval '1 second' ELSE interval '0 seconds' END,expires_at+CASE WHEN '$validity_field'='expires_at' THEN interval '1 second' ELSE interval '0 seconds' END FROM public.swell_watch_study_authorities WHERE epoch=2"
  refresh_expect_error "$refresh_revoke" 'unexpected refreshed study revocation'
  study_database=study_refresh
done
run_file "$refresh_revoke" >/dev/null
refresh_before=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a')
run_file "$refresh_revoke" >/dev/null
refresh_after=$(query 'SELECT jsonb_agg(to_jsonb(a) ORDER BY epoch) FROM public.swell_watch_study_authorities a')
if [ "$refresh_before" != "$refresh_after" ]; then echo 'Refresh revoke retry changed authority' >&2; exit 1; fi
query "SELECT public.study_refresh_assert(public.read_swell_watch_study_health()->>'status'='blocked','revoked refresh blocked')"
query "SELECT public.study_refresh_assert((SELECT jsonb_agg(to_jsonb(a)) FROM public.swell_watch_study_acceptances a WHERE authority_epoch=1)=(SELECT acceptances FROM public.study_refresh_history) AND (SELECT jsonb_agg(to_jsonb(e)) FROM public.swell_watch_study_evaluations e WHERE authority_epoch=1)=(SELECT evaluations FROM public.study_refresh_history) AND (SELECT count(*) FROM public.swell_watch_study_evaluations)=2,'revocation retains both epochs evidence history')"
refresh_expect_error "$refresh_artifact" 'unexpected study authority epoch'
study_database=postgres
