# Swell Watch acquisition rollout — September 9, 2026

Status: acquisition rollout COMPLETE; provider qualification and study evaluation remain incomplete.

## Live acquisition receipt

Production deployment `dpl_2MU1JzRPBq7zSGdW6wM2qhDWTuPK` READY at www.quiversurf.app; production build/TypeScript passed. Clean detached checkout remains unchanged. Only acquisition is enabled; shadow evaluation and both send flags remain false. Existing Vercel schedule is hourly at minute 15.

Authenticated GET succeeded at `2026-09-10T02:51:05.721Z` (September 9, 7:51 p.m. Pacific), HTTP 200, no-store, qualification `prototype_unqualified`, enqueued=0:

- Issuance: `2963872a-76f7-453b-a96d-e4c3ad82837b`
- Run batch: `dd28a1f3-119c-4349-a723-c871d8475d59`
- Revision set: `e7c5bc11-61a9-4299-9ceb-a6a8315b6741`

Fresh database verification: 10 revision-set members and 3,360 components; zero completed batches, evaluations, notification bindings, recipient announcements, and push authorities; send control disabled. Unauthenticated acquisition remains 401; authenticated evaluation remains disabled. No provider attestations or notification sends occurred. The first scheduled hourly execution has not yet been observed.

Commands: `vercel deploy --prod --force --with-cache --yes --no-wait` twice PASS, both builds/TypeScript PASS; scoped `pg_dump` and `pg_restore --list` PASS; exact install via `supabase db query --linked --file` PASS; authenticated/unauthenticated Node fetch assertions and database checks PASS; clean-checkout `git diff --check` PASS. Full backup attempt timed out and initial git redeploy was canceled, both superseded by successful scoped backup and clean CLI deployments. No unit or E2E tests rerun for this configuration rollout. No application source changes, commits, pushes, or OTA publication. This document and automation follow-through are the local changes; production changes are the five configuration values, deployment, one policy row, and raw acquisition receipt records.

Disabled production deployment `dpl_BCUjhatXhSJoctyidtYtN7uX2A9y` READY; build including TypeScript passed. Authenticated acquisition GET/evaluation POST both verified 200 disabled/enqueued=0; unauthenticated calls both 401; all no-store.

Executed exact approved install SQL via owner `supabase db query --linked --file .../swell-watch-no-send-policy-install.sql`. PASS: one active epoch-1 policy, expected hash, expiry `2026-10-25T02:45:47.591003Z`; send control disabled, zero push authorities and notification bindings. Enabled acquisition configuration only; second production build pending. Evaluation remains false.

Independent Sol changed-target review PASS. The three inventory differences and shared cron observability change do not affect acquisition compatibility. Config/install/revoke hashes match the frozen plan.

Full database backup timed out after 240 seconds; partial private artifact retained, not valid rollback evidence. Focused `pg_dump --format=custom --table=public.swell_watch*` succeeded: `backups/swell-watch-no-send-20260909/swell-tables.dump`, 110,874 bytes, SHA-256 `9361fb4d552f4e1b1708fe2e21e8e10cd47bc0a8f8c8c1f9d0879c13490bad5f`. `pg_restore --list` verified schema/data entries including evaluation policies, control, and production authority. This covers the tables affected by the policy-only write; no function or schema mutation is planned. No restore was performed.

Installed the exact producer config and four explicit false flags in Vercel production. First redeploy `dpl_2ej6fpBVeYuoAMgemF9oVCn8eMT2` canceled due to the unchanged-source ignored-build rule. Retrying from clean detached production commit in `../acquisition-release-20260909` using CLI force deployment; no source edits or branch promotion.

Current production is already PR #702 plus subsequent releases: commit `6b076071d41665c77c0ef197a8668e61be68c864`, deployment `dpl_773LGoHpK8vkLE6onQHQK1joUmXd`, project `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`. Rebuild this production source; do not promote additional main changes or upload a dirty worktree.

The frozen 58-file inventory differs only in the evaluation route test, surf-call route, and forecast types. Independent Sol compatibility review requested. The acquisition route and hourly minute-15 schedule are present. Current authenticated acquisition GET and evaluation POST both return 200, disabled, zero enqueues, with private/no-store headers.

Production database read: owner postgres, send control disabled, zero live push authorities, zero evaluation policies. The production configuration has no acquisition/evaluation flags or producer configuration installed.

Follow the existing approved runtime launch plan. Because the old backup is stale, create a new private, ignored backup at `backups/swell-watch-no-send-20260909/pre-policy.dump`; preserve the old backup. Validate archive contents before the exact policy installation. Preserve both send flags and shadow evaluation as false. Enable only acquisition after disabled-deployment verification and policy checks. Capture raw provider receipts without attestation or claims of qualifying study days.
# Latest qualification update — 2026-09-10 03:11 UTC

Supersedes earlier zero-completed/evaluation-disabled status below: one provider batch is now provenance-accepted and completed (`60b88e41-6cbf-415e-bafb-080a23eabcb5`). Shadow evaluation is enabled with both sends disabled. Policy-handling fix deployed as `dpl_4wLcUtUXemxvHdwNZY4N55HK4fzq`. Live evaluation returned `ambiguous_partition_path`, zero enqueues; database still has zero event evaluations, announcements, or notification bindings. Complete qualifying study days remain zero. Also retain the 25 unavailable component tuples (Outer Banks 24, Rincon 1). Do not conflate accepted provenance with a successful evaluation or count hourly captures as distinct qualifying days. Free-tier evaluation/prototyping use is documented by the provider; commercial delivery approval was not granted. Future runs still require evidence review, not automatic attestation.

Full result and commands: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/acquisition-release-20260909/docs/operations/swell-watch-evaluation-result-20260909.md`. Daily launch health should report the current partition ambiguity/coverage blockers, not the resolved evaluation-policy rejection.
