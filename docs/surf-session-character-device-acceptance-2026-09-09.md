# Surf-session character: device acceptance and release handoff

## Decision

Local correctness fixes are ready for operator review. Remote release approval remains **blocked**: no designated, authorized staging schema was found, so compatibility with that schema has not been established. A shipping artifact was not built or tested. Nothing was committed, pushed, merged, deployed, or migrated remotely; production flags and forecasting thresholds were not changed.

This supplements `docs/surf-session-character-release-2026-09-09.md`; it does not replace that historical review or reopen the retrospective. No predictive improvement is demonstrated. The rejected stored-period substitution remains rejected. No barrel, consistency, or lull predictions were added.

## Additional findings fixed

- `quiver-native/src/components/home/beach-hero.tsx`: compact presentation hid all character pills, including scoped `skip` warnings. It now retains only explicit skip warnings while continuing to omit ordinary compact character labels.
- The clickable hero's accessibility label omitted the displayed warning. It now includes explicit skip warnings, without changing the existing objective-only accessibility contract for ordinary labels.
- `quiver-native/src/screens/home.tsx`: passes the already-resolved character category alongside its label. Existing beach/time alignment guards remain unchanged. Standard Beach Detail presentation remains unchanged.
- Added `src/__tests__/session-character-warning-presentation.test.tsx`: four cases covering visible/accessibly named warnings, wrapping, absent labels, unknown categories, and ordinary compact labels.

Only those two production TypeScript files and one new test were changed in this continuation. This handoff is the only additional web file; the existing web application patch and migration are unchanged. The complete accumulated file manifest and binary patches are in the private evidence directory below.

## Device and real-network acceptance

Device: dedicated iPhone 17 Pro simulator, iOS 26.5, `7B612FE7-4778-49F7-A22E-5A7996357769`. Used installed Quiver debug build 17 with current task JavaScript, rebuilt through a cleared Metro cache after the final code changes. This is not evidence for a signed shipping artifact or a physical/Android device.

All writes used a synthetic local actor, loopback services, and disposable database `quiver_character_release_20260909`. Native used real local GoTrue authentication, PostgREST saves, and the actual local Next.js edit API. Authenticated HTTP read-back verified all four sessions and their owner-scoped snapshots; SQL checks independently verified persistence and saved-history invariants.

| Case | Result |
| --- | --- |
| New session, untouched forecast hints | PASS: characteristic tags and quality remained null. Forecast-prefilled height is still not an independently sourced observation. |
| Explicit manual characteristics | PASS: `clean` and `powerful` persisted in session and snapshot. |
| Unknown-origin restored draft | PASS: preserved `clean`/`fat`; rating changes did not confirm them. Removing `clean` left `fat` uncertain and saving remained blocked. App restart preserved that state. Explicit confirmation then saved only `fat`. |
| Omit uncertain characteristics | PASS: omission removed selections and allowed the otherwise valid session to save with null tags. |
| Subsequent edit and clearing | PASS: notes-only edit preserved manual tags; explicit clearing set session and snapshot tags to null. Saved forecast JSON and snapshot creation timestamps remained unchanged. |

These are four new synthetic sessions, not five independent observations; the edit/clear case reuses the manual session. Time/beach-change and broader retry-state assertions remain covered by the prior isolated tests, not additional physical-device exercises here.

Warning acceptance also passed on the final simulator bundle. A real native API refetch produced a same-beach, currently applicable warning that was displayed and exposed through the accessible hero label. Frequency/wait values were null in the local API response and no numeric estimate or invented replacement claim appeared in the checked Home surface. The warning wrapped without clipping or overlap.

Separately, controlled **synthetic query-cache presentation fixtures** exercised matching, wrong-beach, wrong-time, and missing-context inputs. All four passed. Negative cases removed the warning, retained physical measurements, and did not show positive/negative verdict badges or a firing claim. These fixture checks are native presentation evidence, not real server predictions or substitutes for network save tests.

An earlier real response was for a future window and correctly did not appear in Now. Generated/served output was therefore not assumed displayed. Final runtime receipts plus screenshots establish display only in this QA simulator, not that a real user viewed a response.

## Commands and results

Run native commands from the existing native task worktree. `E` below is the private device evidence directory; `SIM` is the simulator UUID above. Maestro commands also used per-run `--debug-output` directories preserved under `E`.

```sh
npm test -- --runInBand src/__tests__/session-character-warning-presentation.test.tsx src/__tests__/beach-hero-width.test.tsx src/__tests__/beach-hero-fix1.test.tsx src/__tests__/current-surf-translation.test.ts src/__tests__/surf-decision.test.ts src/__tests__/home-decision-stack.test.ts src/__tests__/surf-call-card-home.test.tsx src/__tests__/surf-call-card-home-decision.test.tsx
npm run typecheck
npx eslint src/screens/home.tsx src/components/home/beach-hero.tsx src/__tests__/session-character-warning-presentation.test.tsx --format json
git diff --check
node "$E/acceptance-readback.cjs"
node "$E/authenticated-readback.cjs"
```

Final results: **8 suites / 160 tests PASS**, typecheck PASS, scoped ESLint exit 0 with **34 warnings versus the same 34 at task base**, no new or removed normalized lint findings; diff checks PASS in both worktrees. Read-back scripts PASS. The initial broad accessibility-label change failed two existing assertions; narrowing the change to warnings restored both without weakening the assertions. No unrelated lint/dead-code cleanup was made. Prior web lint/Knip baseline comparisons and the 301-test web result remain in the previous release report; web application code did not change and those gates were not rerun in this continuation.

Successful logging flows, each invoked with `maestro --device "$SIM" test "$E/<name>.yaml"`:

- `hints-save`, `manual`, `unknown-review` (retry after local launch confirmation), `unknown-confirm`, `unknown-omit`, `edit-notes`, `edit-clear`: PASS.
- `warning-visible-final`: PASS after loading the final bundle, both for the synthetic matching fixture and after an actual native API refetch.
- `node "$E/set-presentation-case.cjs" <mode>` followed by `warning-absent`: PASS for `wrong-beach`, `wrong-time`, and `missing-context`.

Existing production-targeting Maestro launch/login flows were inspected, not run unchanged. Task-only flows kept every save on loopback. Initial failures from missing Expo config resolution, IPv4/IPv6 Metro binding, launch confirmation, stale Metro cache, synthetic forecast configuration, and debugger-helper syntax/runtime support are retained as failed setup receipts, not counted as product passes. The real hidden-warning/accessibility findings were fixed and retested.

## Database compatibility and provenance limits

The earlier full local-schema checks remain valid for the unchanged migration: 167 public tables, 317 policies; trigger interactions, explicit grants/revocations, ownership/beach guards, representative 100-row backfill, and saved forecast JSON/timestamps were checked in disposable clones. Actual native edits and authenticated read-back now additionally exercise the installed trigger path.

Current authorized staging comparison is **not complete**. Local environment files identify local or production Supabase. Authenticated read-only management listings found the production project, an unrelated inactive project, and two preview branches belonging to other named tasks; none was identified as staging. No production database schema was substituted, unrelated branch was mutated, or paused project was resumed.

The local clone retains the legacy `(beach_id, forecast_date, forecast_time)` uniqueness constraint alongside canonical forecast time, and lacks the newer optional recommendation-hold table. Synthetic forecast fixtures also initially lacked source and beach-skill metadata. Fixture values were corrected only in the disposable database; no application rule or schema was changed to force a warning. These facts must not be represented as a current staging-schema comparison.

Backfill risk remains as previously measured: the 10,000-row isolated fixture took about 277 ms for UPDATE and 5 ms for COMMIT with approximately 187-byte forecast JSON. Table locks included ShareRowExclusiveLock on sessions and snapshots. This is a small-fixture measurement, not a production duration estimate; real JSON sizes, indexes, concurrent writes, WAL and transaction duration determine the operational cost. The benchmark wrapper's post-check shell failure remains documented in its original receipt.

Persisted sessions do not contain durable condition-origin or client/build provenance. `source` and `tide_data_source` are not substitutes; this QA's `maestro_smoke` source does not certify independent observations. Old clients can continue submitting forecast-prefilled tags after release. Do not classify all post-release records as clean, certify old draft choices, or retroactively relabel old records. The separate compatible provenance proposal remains unimplemented in `docs/surf-session-character-next-evaluation.md`.

## Proposed release and rollback order, not executed

1. Operator reviews the exact uncommitted diffs and evidence. Identify the designated staging project/schema export; run the existing read-only preflight and repeat rehearsal in its isolated full-schema clone. Assess actual relation/JSON sizes and competing writers.
2. After explicit release authorization, apply the unchanged migration before the dependent application rollout. Use bounded lock/statement timeouts and check migration history before retrying after an uncertain acknowledgement; CREATE TRIGGER is not a blind-retry operation.
3. Roll out the web correctness changes and then the approved native artifact. Smoke-test the actual shipping artifact through the approved non-production path. Retain older-client compatibility and unknown provenance. Legacy scored-API numeric retirement remains a separate contract task.
4. Prefer application rollback while retaining the database integrity guards and synchronized tags. An uncommitted migration failure rolls back atomically. Do not blindly reverse the backfill or restore old tags over later user edits. Dropping guards after commit requires a separately reviewed compensating migration because it reopens association-integrity risks.

Remaining release blockers: designated staging compatibility/preflight and operator approval, plus shipping-artifact-specific verification. Local checks do not authorize deployment. The next evaluation task remains proposal-only: reuse existing mechanisms to preserve exact pre-session output/input/code/configuration/beach/window provenance and observation origin, distinguishing generated, served and actually displayed outputs without assuming user attention.

## Identities and private evidence

- Web HEAD/task base: `c0fa2bfd8bbad44e7d56c1fbffd1208bbd011dcb`.
- Native HEAD/task base: `68dabb8b85f20a19e7ddae2a50a6529b41de68b2`.
- Both existing branches: `orch/surf-session-character-20260908`. There are no new commit SHAs; changes remain uncommitted.
- Private directory: `/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/device-acceptance-20260909`.
- `release-identity.json`, `web-final.patch`, and `native-final.patch` capture final complete diff identities, including untracked task files. `verification.md` indexes detailed commands and receipts. `cleanup.json` records task-only service/account cleanup; disposable clones and evidence are retained for operator inspection.
- All 13 files in the frozen retrospective manifest matched their original SHA-256 values. No additional historical observations or model experiments were introduced.
