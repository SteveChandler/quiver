# Proposed v2 no-send rollout — approval required

Local code/replay review passed; this plan has NOT been executed. Source: branch `orch/readiness-implementation`, reviewed local changes and 75 passing focused tests. Full evidence and exact commands: `swell-watch-readiness-result.md`.

## Authorized scope requested

Commit and integrate only the reviewed Swell Watch changes through the repository's normal main/prod review gates; deploy that source; replace the evaluation configuration with the separate proposed v2 configuration; append a new evaluation-only policy ledger entry bound to that exact configuration hash; execute one fresh no-send evaluation after independently qualifying the selected acquired run. No push authority, sends, cohort reduction, automatic attestation, study-day claim, or silent validity extension.

## Execution gates

1. Recheck branch/worktree diff, current production revision, CI, current configuration and evaluation ledger read-only. Preserve unrelated production changes. The production base may have advanced since local review; any conflict or runtime-path delta requires review before integration.
2. Prepare exact owner SQL and rollback using current ledger state, then review/test them before executing. Do NOT rerun the old initial-install SQL: it explicitly accepts only the original v1 policy and epoch 1. The append-only table requires next epoch, not overwriting historical rows.
3. Bind proposed policy hash `86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f` and SHA-256 of the actual proposed configuration file. Lock control, require disabled send control/no production push authority, and fail on unexpected ledger state. Preserve the existing approved expiry rather than granting another 45 days. If expired or changed, stop for a new decision. Label technical review/operator approval accurately.
4. Before the policy write, take and validate a fresh focused backup. Disable shadow evaluation during config/policy transition; keep acquisition unchanged and both send flags false. Historical fixtures never substitute for fresh live authority or freshness checks.
5. Integrate/deploy through repository gates; verify deployed source, private/no-store auth behavior, and exact server config. Install the separately reviewed evaluation-only ledger transition, then enable shadow evaluation. Abort on config/policy hash mismatch.
6. Independently inspect a fresh acquired run's raw hashes, issuance, complete scope, and missingness before any attestation/completion write. No blanket qualification of future runs. Execute one authenticated no-send evaluation; record actual per-scope outcomes. A legitimate suppressed result is not a successful full-coverage study day.
7. Verify zero announcements/notification bindings and no send authority. Record deployment, ledger epoch, evaluation and rollback receipts; update daily launch health with fresh evidence.

## Rollback

Disable shadow evaluation first. Preserve all acquisitions/evaluations and append-only policy evidence. Restore the previously verified configuration/deployment only if compatible with current production changes; append a separately reviewed policy revocation or restoration epoch, never delete history or restore a stale dump over newly acquired records. Keep sends disabled throughout.

## Separate accounting decision

The 30-qualifying-observed-day requirement lacks a verified timezone/cadence/completeness contract. This rollout does not invent one. Daily launch health must continue reporting that accounting is unestablished, with accepted runs, successful evaluations, distinct initializations and missingness shown separately. Full goal completion still requires resolving this definition and verifying it against actual observations.
