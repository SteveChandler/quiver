# Swell Watch read-only operational inventory — 2026-09-06

Operator authorized reading production configuration and curated beach metadata.
No deployment, runtime configuration, policy, attestation or other application
data was written. No provider forecast acquisition, notification or OTA ran.

## Verified state

- Supabase linked project: `vawdnbbgawichorsjiwe`.
- At `2026-09-06 19:29:44.419779+00`: evaluation policies **0**, provider
  attestations **0**, completed batches **0**. No operational policy hash exists
  in that ledger; do not manufacture one from fixture approval evidence.
- Public curated scope filter: `deleted_at IS NULL AND is_private=false AND
  owner_id IS NULL`. Count **495**, of which **0** have `region_id` populated.
  No user IDs, relationships, devices or private/custom beach rows were returned.
- Existing main-checkout Vercel link identifies project
  `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`, organization
  `team_9st9wbCT5DNu5s7vq7SKQZsu`; CLI resolves it to
  `stcha0004-9905s-projects/v0-prd-design-concept`.
- Complete production environment-variable listing contains only
  `SWELL_WATCH_ENABLED` among `SWELL_WATCH*` names. Its value is encrypted and was
  not decrypted. `SWELL_WATCH_PRODUCER_CONFIG`,
  `SWELL_WATCH_ACQUISITION_ENABLED`, `SWELL_WATCH_SHADOW_EVALUATION_ENABLED` and
  `SWELL_WATCH_PUSH_ENABLED` are absent from that listing. This is project
  configuration evidence, not proof of flags baked into an existing deployment.

## Proposed ten-beach pilot — not installed or approved launch scope

Use explicit stable configuration region keys, not the empty `region_id` column.
The adjacent San Diego and Orange County pairs exercise regional consolidation;
the other locations broaden coast, direction and timezone coverage. These are
candidate operational samples, not proof of coverage for all eligible users.

| Beach | Verified public UUID | Proposed region key | Latitude | Longitude |
|---|---|---|---:|---:|
| Blacks Beach | `01330afc-00d3-461b-88f3-b173774766f4` | `san-diego` | 32.887 | -117.252 |
| Scripps | `4b0cf129-c706-4e24-8210-2219defc5ea7` | `san-diego` | 32.867 | -117.2573 |
| Huntington Beach Pier Northside | `72726bcb-bed0-4b76-8336-f90d7fb57159` | `orange-county` | 33.6552 | -118.0022 |
| Huntington Beach Pier Southside | `025cfc18-8357-49d6-994e-e0abf0a16f6d` | `orange-county` | 33.6542 | -118.0022 |
| Steamer Lane | `2609a9ff-d247-4e0b-888f-a793ff7177a5` | `santa-cruz` | 36.9506 | -122.025 |
| Ocean Beach SF – Middle | `e8a921b7-c2b5-4259-9e5c-bd06765f7ae4` | `san-francisco` | 37.7601 | -122.513 |
| Pipeline | `6a0674ac-3e6d-49f3-9fd4-a4f1857c408a` | `oahu-north` | 21.6644 | -158.0517 |
| Waikiki – Canoes | `2ac8b200-fdf2-4822-bcb1-3ec336b83d05` | `oahu-south` | 21.27625 | -157.82925 |
| Cape Hatteras Lighthouse | `d264fbf8-0525-4d31-adb5-9a0742eaeb7e` | `outer-banks` | 35.226608 | -75.523723 |
| Sandy Beach Rincón | `f11ccd59-b778-4ea1-a8ff-88bffb447cd8` | `rincon-pr` | 18.370386 | -67.25763 |

All ten returned non-null swell-window center/halfwidth and timezone, and
`terrain_enabled=true`. At `2026-09-06T19:32:00.604Z`, all ten also passed the actual
`loadSwellWatchAcquisitionScope` schema, including terrain arrays and shoaling,
against fresh read-only SQL rows. The check used an in-memory query adapter, not
PostgREST; it does not validate deployed HTTP access. Provider selected-grid
suitability has not run. Do not silently drop a failing beach.
Region keys above are proposed detector grouping choices, not verified catalog
IDs. General beach forecasts and source selection remain unchanged.

## Commands and limits

PASS `supabase db query --linked <SELECT> --output json` for:

1. `information_schema.columns` inspection of `public.beaches`.
2. Curated region/state counts and swell-window/region-ID completeness, limited
   to 40 groups (not claimed exhaustive).
3. Curated named-beach candidates, limited to 35 rows (20 returned).
4. The timestamped configuration/count query:

```sql
SELECT now() AS observed_at,
  (SELECT count(*) FROM public.swell_watch_evaluation_policies) AS evaluation_policy_rows,
  (SELECT count(*) FROM public.swell_watch_provider_run_attestations) AS attestation_rows,
  (SELECT count(*) FROM public.swell_watch_provider_run_completed_batches) AS completed_batch_rows,
  (SELECT count(*) FROM public.beaches WHERE deleted_at IS NULL AND is_private=false AND owner_id IS NULL) AS curated_beaches,
  (SELECT count(*) FROM public.beaches WHERE deleted_at IS NULL AND is_private=false AND owner_id IS NULL AND region_id IS NOT NULL) AS curated_with_region_id;
```

PASS `vercel env ls production --cwd /Users/stevenchandler/Desktop/dev/quiver`;
repeated once with output filtered in memory to the project and Swell Watch names
to avoid a truncated listing. No environment file was pulled or overwritten.
`vercel env run --help` was unavailable in the shell CLI version (exit 2); no
environment command or app process ran through it. The older CLI help invocation
also returned exit 2; environment listing itself succeeded.

Exact query text and tool outputs remain in this task transcript. No source or
test files changed; unit/E2E tests were not run for this inventory. Full release
E2E remains incomplete. No new entitlement is asserted: retain the user-selected
free endpoint, with hosted-service commercial-use restrictions still unresolved.
The loader check passed via `node_modules/.bin/tsx -e <read-only SQL/loader check>`;
the exact command is retained in the task transcript. No mocked beach data was
used; only the query adapter was supplied locally.

## No-send policy proposal

`docs/operations/swell-watch-no-send-policy-proposal.json` is a review proposal,
not an installed or production-approved policy. It uses the existing fixture
threshold values plus the operator-approved rolling 24-hour window and the
proposed no-send-only twelve-hour freshness limit justified below, with
`provenance=pending_review` and no approval evidence. This is a starting point
for collecting distributions, not an assertion of empirical calibration or safe
live-send caps. Its canonical policy hash is
`4c9ec372e9dff824039956ef5d2f46e6d3445b9d0d80d6626cac9932de436ecd`.
The policy remains a documentation artifact; runtime code does not import it.
Installing any evaluation-policy row still requires the production plan protocol.

Next: review this cohort/policy proposal and bind the consolidated runtime plan
to an exact release revision, owner procedure and stop conditions. The real
30-day qualifying window has not started.

## Independent pilot review and local guard fix

### Observed timing and proposal revision

One no-retry metadata GET at `2026-09-06T19:40:37.201Z` returned GFS initialization
`2026-09-06T12:00:00Z`, modification/availability `2026-09-06T17:19:49Z`, hourly
resolution and six-hour update cadence. Source:
`https://marine-api.open-meteo.com/data/ncep_gfswave016/static/meta.json`.
This is marine availability metadata, not proof of Single Runs archive availability
or a completed evaluation. The web reader could not open that URL; the bounded
Node fetch succeeded with redirects rejected and a 20-second abort timeout.

For this observed metadata, replication eligibility is 17:29:49; the proposed
hourly `:15` schedule first reaches it at 18:15. Initialization age is then 6.25
hours, so the original six-hour proposed policy would suppress even before owner
review. Revised only the unapproved no-send proposal to twelve hours, covering
two nominal six-hour cycles as an operational experiment. This does not establish
a calibrated live threshold or guarantee timely review. Record actual latency and
stale-run gaps; never relabel availability/attestation time as initialization.
The old proposal hash `2715fe0fec403f6e0dbaf671731e93f980325f5c5dceac7db72a4e10f858f082`
is superseded, not approved or installed. Fixture/live authority and code unchanged.

Production read-only checks at 19:40 UTC found zero `/api/cron/swell-watch-evaluate`
cron rows and zero scheduled commands directly referencing `cron_runs`. This is
not a retention guarantee: indirect/external cleanup and future changes remain
unverified. A 30-day report must retain and verify its own evidence exports.
Commands: `supabase db query --linked <cron.job metadata SELECT> --output json`,
the route-filtered `cron_runs` aggregate SELECT, and `node --input-type=module -e
<bounded metadata fetch>`, all successful. Initial multi-statement SQL returned
only the last result, so cron metadata was queried separately rather than assumed.

Follow-up: the existing `withObservedCron` wrapper already stores the response
envelope in `cron_runs.summary`, including suppressed results. The missing demand
row is therefore not proof that all suppression observability is absent. Route
tests now use the real wrapper; a regression verifies the actual route response's
batch ID, policy hash, suppression reason and null counts reach the summary update.
Database/evaluator boundaries are mocked in this test; it is not deployed-write
proof. Writes are best-effort and summaries over 8 KB are omitted, so operational
coverage requires confirmed records/export retention, not HTTP 200 or `status=ok`
alone. Missing summaries are evidence gaps. No additional table is proposed.

PASS 3 suites/49 tests with:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/api/cron/swell-watch-evaluate.test.ts __tests__/lib/cron/observability.test.ts __tests__/lib/alerts/swell-watch/shadow-evaluation.test.ts
node_modules/.bin/eslint --max-warnings=0 __tests__/api/cron/swell-watch-evaluate.test.ts
```

The initial test run had one mock-setup failure (undefined default client); fixed
the test default to an empty client, leaving production behavior untouched, then
reran successfully. This increment changes one existing route test and this report
only. No browser/Maestro E2E, production reads/writes or sends in this increment.

Terra review found the pending-review policy honest, but not ready for operational
installation without explicit approval for detection writes, real audience reads
and demand recording. It also confirmed two unresolved pilot risks:

- Freshness is measured from initialization: the proposed six-hour limit must
  accommodate provider availability, acquisition and owner-review latency. It is
  not yet demonstrated to yield usable runs; no threshold was loosened.
- Any unavailable component across all 168 hours suppresses a beach; the first
  suppressed beach aborts the cohort. The no-send evaluator returns before demand
  recording, so a suppressed attempt lacks durable outcome evidence there. Both
  retained seven-day runs have eight missing S2 samples. Retain suppression and
  coverage evidence separately before launch; do not turn unknown counts into
  zeroes, silently shrink the cohort or treat elapsed time as qualification.

Fixed the bounded runtime curated-scope finding locally in
`lib/alerts/swell-watch/provider-run-store.ts`: filter `is_private=false` and
`owner_id IS NULL` before exact membership validation. The existing unit test
asserts both predicates; the existing disposable worker drill changes its own
generated neighbor to private, then publicly owned, and proves whole-cohort
rejection in each case before restoring/confirming both curated members.
Independent incremental review found no actionable regression.

PASS commands:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent --runTestsByPath __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/lib/alerts/swell-watch/acquisition.test.ts __tests__/api/cron/swell-watch-evaluate.test.ts
bash scripts/test-swell-watch-worker-postgres.sh
yarn typecheck
node_modules/.bin/eslint --max-warnings=0 lib/alerts/swell-watch/provider-run-store.ts __tests__/lib/alerts/swell-watch/provider-run-store.test.ts __tests__/notifications/swell-watch-worker-postgres.drill.ts
git diff --check
```

Focused units: 3 suites/34 tests, 0.98s. Real disposable database drill: 10 cases,
31.766s, exit zero, recording-only delivery adapter. Typecheck: 10.62s. These are
local test results, not real sends or qualifying production evaluations. No
browser/Maestro E2E reviewed, added or run; release E2E remains incomplete. One
production source file and two existing tests changed, plus this report. No
schema change, production write, commit, push, deployment, activation or OTA.
