# Swell Watch no-send runtime launch — approval plan

Status: proposed, not executed. Approval means authorization for this bounded
launch after the review and verification prerequisites below; not release readiness.

## Exact target and artifacts

- Web worktree: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-current`.
- Branch: `orch/phase-26-no-send-current`; base `8813c02df5b43744106fd0eab8e50c48685f57c5`.
- Main and prod checked live at preparation: main equals the base above; prod
  `b087d1ac0ebb41f96ea14c5e1b65bb486e8b75ac`. Their tracked trees are identical.
- Vercel project `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`, organization
  `team_9st9wbCT5DNu5s7vq7SKQZsu`, production environment.
- Supabase project `vawdnbbgawichorsjiwe`, existing production owner connection.
  Never substitute the deprecated migrator or grant runtime owner privileges.
- Source inventory: `docs/operations/swell-watch-no-send-source-manifest.json`;
  sorted 58-file list hash `55b39945e11a89b425ea6592ed5445b90a814fd40826889fc9fb818a6603ff31`.
- Configuration: `docs/operations/swell-watch-no-send-producer-config.json`;
  SHA-256 `f8d3549aec17646288a8a00bb174075973f2ab461b7506315c5c5aab5784d977`.
- Install SQL: `docs/operations/swell-watch-no-send-policy-install.sql`;
  SHA-256 `4aa3d2db810f96282ff240176e263e88706e42d56d7bd68417dcfecfcbc65058`.
- Revoke SQL: `docs/operations/swell-watch-no-send-policy-revoke.sql`;
  SHA-256 `6bf03adaa6ffb69009ce67ba46afcdfc192746df8b786e9fc421167844696561`.
- Policy-value hash: `4c9ec372e9dff824039956ef5d2f46e6d3445b9d0d80d6626cac9932de436ecd`.

Artifact paths above are relative to the named worktree. Hashes bind bytes, not
scientific evidence. Configuration remains pending-review with null provider/release
approval evidence; do not change it to production-approved to bypass a guard.

## Prerequisites and permitted sequence

1. Obtain required final code/contract review and operator sign-off. Recheck exact
   changed-file membership and hashes, remote heads, live CI and deployment target.
   Any changed source, target, policy or scope needs renewed review; no blind rebase.
2. Approval covers scoped commits, push/PR and normal main-to-prod promotion of
   these reviewed changes and accompanying evidence docs, subject to repository
   review/CI gates. Do not merge unrelated dirty files or bypass required review.
   Produce a fresh production build with production configuration; never upload
   the local localhost/placeholder-credential build.
3. Existing credential access is limited to Vercel configuration/deployment,
   cron authentication, and Supabase owner backup/read/write operations described
   here. Never print secrets, copy them to tracked files, or obtain paid API keys.
4. Before any owner policy write, create and verify a fresh backup less than 24
   hours old at `backups/swell-watch-no-send-20260906/pre-policy.sql.backup` plus
   its checksum in that ignored private directory. Confirm backup contents and
   restoration scope cover the affected ledger/control/authority schema and data.
   A missing/failed backup prevents the write. Do not overwrite an existing backup.
5. Set `SWELL_WATCH_ENABLED=false` and `SWELL_WATCH_PUSH_ENABLED=false` explicitly.
   Set acquisition and shadow-evaluation flags false for the initial deployment.
   Install the exact configuration JSON as `SWELL_WATCH_PRODUCER_CONFIG` using
   existing secure configuration tooling. Preserve every unrelated environment
   value and notification schedule.
6. Verify the new deployment identity and actual disabled HTTP responses, auth
   rejection and no-store headers. Confirm current database send control disabled
   and no live Swell Watch push authority. Any mismatch stops this launch.
7. Execute exactly the install SQL above as owner. It only inserts the initial
   no-send evaluation policy: reviewer Steven Chandler by this approval,
   configuration-review hash, start at transaction time, administrative expiry
   45 days later. This allows room for 30 qualifying observed days; it does not
   start the qualifying clock, waive missing days or renew automatically.
   Verify exactly one matching row, unchanged control/authority, and no new
   Swell Watch notification rows. Do not reapply the already installed migrations.
8. Enable only `SWELL_WATCH_ACQUISITION_ENABLED=true`, verify the resulting
   deployment/configuration, and run one authenticated acquisition GET. Inspect
   exact cohort/receipt IDs, qualification=`prototype_unqualified`, enqueued=0,
   and retained outcome. Hourly minute-15 collection then uses the existing lease
   and bounded provider timeout. No tight retry loop or cohort auto-shrinking.
9. Keep `SWELL_WATCH_SHADOW_EVALUATION_ENABLED=false` until genuine owner-reviewed
   provider evidence is available. Raw collection may proceed without claiming
   independent evaluations. Record failures/missingness honestly. Free provider
   only; do not infer commercial entitlement from a successful HTTP response.

## Exclusions and qualification boundary

This plan does NOT authorize provider attestations, accepting unverified runs,
device sends, Swell Watch enqueue/delivery, push authority, production activation,
OTA publication, paid subscriptions, schema expansion or user-data deletion.
Actual owner attestation/completion must be tied to separately reviewed real
evidence, not this configuration hash. The evaluation POST is not a GET cron.
Until that boundary is satisfied, this is scheduled raw collection, not an
unattended qualifying 30-day study. Full Phase 26/native/provenance gates remain.

## Stop and rollback authorization

On failed invariants or operator stop: set acquisition/evaluation flags false,
verify disabled endpoints, and retain both send flags false. If the policy must
be revoked, execute only the exact revoke SQL above: append the matching epoch-2
revocation, never delete or update history. Verify no matching-policy fallback
and unchanged send control. Preserve all evidence tables and records.
Do not restore an older deployment that could re-enable sends; reversion requires
verification of its flags/behavior. Do not touch unrelated delivery jobs.

## Evidence available and remaining

Current-base full units: 18,021 passed; final forecast fix separately 46 passed.
Typecheck passed. Cache/route tests 33 passed; schedule/auth tests 19 passed.
Post-cache-fix build passed; eight compiled default-off HTTP checks passed.
Actual disposable SQL install/retry/revoke/reinstall-rejection checks passed;
temporary database cleaned up. Details and known local build warnings are in
`docs/operations/swell-watch-package-validation.md` and the launch-review document.
No browser/native E2E or enabled-production acquisition is proved by these checks.

Production mutations require `APPROVE: <SHA-256 of this plan file>`. An approval
does not remove any prerequisite or authorize the exclusions above.
