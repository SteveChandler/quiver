---
phase: 21
slug: multi-forecaster-forecast-adjustment-and-production-ingestio
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-27
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for production multi-forecaster ingestion, deterministic forecast adjustment, atomic audit persistence, and private serving.

---

## Test Infrastructure

| Property | Quiver | Seaside | Database |
|----------|--------|---------|----------|
| **Framework** | Jest 29.7 | pytest, Python 3.11 | pgTAP through Supabase CLI |
| **Config file** | `jest.config.js` | Repository pytest configuration | `supabase/config.toml` |
| **Quick run command** | Focused forecast command below | Focused ingestion command below | Focused pgTAP command below |
| **Full suite command** | `yarn test:unit --bail=0` | `PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 python -m pytest -p no:cacheprovider tests/ -v --tb=short` | `supabase test db` |
| **Estimated runtime** | Focused: under 2 minutes | Focused: under 2 minutes once environment exists | Focused: under 2 minutes once Docker is running |

### Focused Quiver command

```bash
source ~/.nvm/nvm.sh
nvm use 22
yarn test:unit --runInBand --runTestsByPath \
  lib/services/forecast/__tests__/trusted-forecast-adjustment.test.ts \
  lib/services/forecast/__tests__/trusted-forecast-persistence.test.ts \
  lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts \
  lib/services/forecast/__tests__/log-display-prediction.test.ts \
  __tests__/migrations/trusted-external-forecast-adjustments.test.ts
```

### Focused Seaside command

```bash
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/uv run --isolated \
  --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 \
  python -m pytest -p no:cacheprovider \
  tests/test_fetch_trusted_forecasts.py \
  tests/test_scheduler_registration.py \
  -q
```

### Focused database command

```bash
yarn db:reset
supabase test db supabase/tests/database/trusted_external_forecast_adjustments.test.sql
```

---

## Sampling Rate

- **After every task commit:** Run the smallest focused command for the files changed.
- **After every plan wave:** Run both focused repository gates and the focused database gate when schema or RPC behavior changed.
- **Before `$gsd-verify-work`:** Full Quiver, Seaside, and database suites must be green.
- **Before serving rollout:** Run the read-only live verifier against all 17 configured sources and complete the privacy/audit checks.
- **Max feedback latency:** 2 minutes for focused unit checks; database and full-suite gates may take longer.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-00 | 01 | 1 | MFA-01 | T21-SC | Isolated Python 3.11/pytest environment is reproducible without manifest changes | preflight | Existing Seaside tests through `uv` | ✅ tool exists | ⬜ pending |
| 21-01-01 | 01 | 1 | MFA-01, MFA-02, MFA-03 | T21-01, T21-02 | Fixed HTTPS transport plus all 17 source-specific parser contracts, lineage/evidence, rejection, and immutable revisions | pytest unit + bounded corpus | Exact isolated uv focused command | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | MFA-01, MFA-08 | T21-03 | Default-on six-hour job persists partial results but reports aggregate unhealthy on enabled-source failure | pytest integration | Exact isolated uv focused command | ❌ W0 | ⬜ pending |
| 21-02-00 | 02 | 1 | MFA-06 | T21-SC | Docker and disposable local Supabase are healthy before schema work | preflight | `docker info && yarn db:reset && supabase test db` | ✅ Docker app | ⬜ pending |
| 21-02-01 | 02 | 1 | MFA-02, MFA-06 | T21-04, T21-05 | Private append-only issue, decision, application, alert, run, and receipt storage | pgTAP | Focused database command | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | MFA-06, MFA-07 | T21-04–T21-07 | Canonical atomic RPC, exact replay, constrained acknowledgement, and least privilege | pgTAP | Focused database command | ❌ W0 | ⬜ pending |
| 21-02-03/04 | 02 | 1 | MFA-06, MFA-08 | T21-08 | Only singleton migration `20260727231500` is authorized/pushed from a clean detached worktree at the authorized SHA after mechanical SHA/project/checksum/pending checks | approval + guarded CLI | Exact singleton dry-run/push plus read-only post-checks | Manual gate | ⬜ pending |
| 21-03-01 | 03 | 2 | MFA-03, MFA-04 | T21-03 | Provider mirrors/models dedupe before authority and spot/regional/exposure precedence is deterministic | Jest unit | Focused Quiver command | ⚠️ rewrite | ⬜ pending |
| 21-03-02 | 03 | 2 | MFA-02, MFA-03 | T21-03, T21-04 | One normalized Seaside issue conforms to SQL and TypeScript contracts | Jest contract | `trusted-forecast-contract.test.ts` | ❌ W0 | ⬜ pending |
| 21-03-03 | 03 | 2 | MFA-04, MFA-05 | T21-03 | One decision per IANA local day, nearest-edge conflict rule, exact signed bands, raw 0–168h boundary | Jest unit | Focused Quiver command | ⚠️ expand | ⬜ pending |
| 21-04-01 | 04 | 3 | MFA-06 | T21-05, T21-06 | Persistence reconciles receipts and server-only reads load eligible issues plus durable decisions without false empty results | Jest transport/repository | Focused Quiver command | ❌ W0 | ⬜ pending |
| 21-04-02 | 04 | 3 | MFA-05, MFA-06, MFA-07 | T21-06, T21-07 | Builder durable reuse, no-baseline ambiguity/collision, immutable first-write rows, privacy scan, and changelog all hold | Jest integration + negative scan | Focused Quiver command | ⚠️ expand | ⬜ pending |
| 21-05-01/02 | 05 | 4 | MFA-08 | T21-01–T21-07 | Sanitized source verifier, exact-target abort-before-write smoke runner, and all local gates pass before production | pytest/Jest + full suites | Exact smoke-runner test, isolated uv, broader gates | ❌ W0 | ⬜ pending |
| 21-05-03–06 | 05 | 4 | MFA-01, MFA-08 | T21-08 | Ongoing ingestion writes precede separate deploy approval; deploy runs only from a clean detached Seaside worktree at the authorized SHA for `quiver-ml` | approval + guarded operational | Worktree HEAD/status, Fly app, health, scheduler, immediate run, verifier | Manual gates | ⬜ pending |
| 21-05-07–10 | 05 | 4 | MFA-05, MFA-06, MFA-08 | T21-06, T21-08 | Recurring forecast writes and exact target precede separate deploy; the prod merge must contain the authorized main/previous-prod tips and expected tree, and smoke runs from a clean `DEPLOYED_PROD_SHA` worktree after exact Vercel project/deployment/production/READY/commit comparison | approval + provenance guard | Ancestry/tree and Vercel API guards, then `trusted-forecast-production-smoke.ts --mode=forecast` | Manual gates | ⬜ pending |
| 21-05-11/12 | 05 | 4 | MFA-06, MFA-08 | T21-06, T21-08 | Exact audit target executes from a clean `DEPLOYED_PROD_SHA` worktree only after the same ancestry/tree and Vercel provenance guards | approval + provenance guard | Ancestry/tree and Vercel API guards, then `trusted-forecast-production-smoke.ts --mode=audit` | Manual gate | ⬜ pending |
| 21-05-13/14 | 05 | 4 | MFA-08 | T21-08 | Exact launchd service retires recoverably only after parity/audit | approval + operational | Exact service/plist verification | Manual gate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Normal default-on rollout has no production env/secret mutation task. Any future enable/disable/secret/env change is outside this task map and requires a fresh, separately scoped authorization.

---

## Threat References

| ID | Threat | Required proof |
|----|--------|----------------|
| T21-01 | SSRF or unsafe redirect through a provider response | Manual HTTPS redirect handling, fixed host allowlists, response-size and hop limits, no forwarded credentials |
| T21-02 | Malformed or stale source content becoming authority | Source-specific grammar; real publication time; local validity, basis, and range validation; no `fetched_at` fallback |
| T21-03 | Mirrors, model pages, or incompatible exposures creating false agreement | Persisted provider lineage/evidence class, lineage dedupe, versioned coverage policy, exposure compatibility |
| T21-04 | Private trusted data readable by public roles | RLS, revoked defaults, service-role-only tables/RPCs, privilege tests |
| T21-05 | Caller-controlled hash, replay, or partial commit corrupting audit evidence | Database canonicalization/SHA-256, advisory transaction lock, exact counts, receipt-last transaction |
| T21-06 | Adjusted output escaping without durable attribution | Matching receipt before serving; unresolved transport ambiguity throws retriable error; first-write snapshots stay unchanged |
| T21-07 | Source content or internal IDs leaking through DTOs, analytics, or logs | Server-private types, response allowlists, negative contract tests, sanitized operational output |
| T21-08 | Premature/default-on mutation or dirty/unapproved release provenance | Ordered approvals; singleton schema push; clean detached worktrees; authorized main/previous-prod ancestry and expected tree; exact Fly/Vercel target and deployed-prod commit checks before deploy/write; parity before retirement |
| T21-SC | Test setup drifting from project dependencies or mutating manifests | Isolated `uv` environment with Python 3.11, repository requirements, pinned pytest, and no manifest edits; disposable local Supabase after Docker preflight |

---

## Wave 0 Requirements

- [ ] `seaside/tests/test_fetch_trusted_forecasts.py` and a bounded fixture corpus covering every source-specific parser function.
- [ ] `seaside/scripts/verify_trusted_forecast_ingestion.py` read-only live verifier.
- [ ] `scripts/trusted-forecast-production-smoke.ts` plus focused tests proving mandatory beach/local-date/build-key equality and abort-before-write; operational validation separately proves authorized main/previous-prod ancestry and tree, clean `DEPLOYED_PROD_SHA` worktree, and exact Vercel project/deployment/commit provenance before runner invocation.
- [ ] `lib/services/forecast/__tests__/trusted-forecast-persistence.test.ts` for RPC and receipt reconciliation states.
- [ ] Rewrite `trusted-forecast-adjustment.test.ts` for lineage, IANA local days/DST, nearest-edge conflict, exact signed bands, and raw horizon boundaries.
- [ ] Replace the `log-display-prediction.test.ts` assertion that permits mutation of existing first-write rows.
- [ ] `supabase/tests/database/trusted_external_forecast_adjustments.test.sql` for grants, append-only triggers, rollback, canonical hashing, exact counts, and snapshot immutability.
- [ ] Complete Plan 21-02 Task 0 to start Docker Desktop and prove disposable local Supabase/pgTAP availability.
- [ ] Complete Plan 21-01 Task 0 using `/opt/homebrew/bin/uv`, Python 3.11, repository requirements, and pinned pytest without changing manifests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 17 live endpoints still match their approved parser contracts | MFA-01, MFA-08 | Third-party markup changes independently of fixtures | Run the isolated `uv` Python 3.11 command for `scripts/verify_trusted_forecast_ingestion.py --live --no-write`; require 17 configured results, valid parser versions/freshness, sanitized output, and zero enabled-source failures |
| Production Seaside ingestion matches local evidence before serving | MFA-08 | Requires separately approved ongoing write scope and deploy | Deploy only from a clean detached Seaside worktree whose HEAD equals both approvals and app is `quiver-ml`; then verify scheduler/immediate run and sanitized parity |
| Production adjusted forecasts have complete receipts/applications and unchanged first-write snapshots | MFA-06, MFA-08 | Requires approved recurring write scope, deploy, exact target, and immutable deployment provenance | Prove the prod merge contains the authorized main/previous-prod tips and expected tree; from a clean detached worktree at `DEPLOYED_PROD_SHA`, compare exact Vercel deployment ID/project/production/READY/commit, then run authorized target arguments; any mismatch causes zero writes |
| Local launchd job is retired only after parity | MFA-08 | Mutates OS-registered state and requires explicit approval | After approval, `bootout` only `gui/501/com.quiver.surf-forecast-ingest`, move its plist recoverably, verify `launchctl print` fails for that exact service, and preserve prior snapshots |

---

## Broader Gates

```bash
# Quiver
yarn typecheck
yarn typecheck:forecast-gate
NODE_OPTIONS="--max-old-space-size=8192" yarn lint
yarn test:unit --runInBand --runTestsByPath scripts/__tests__/trusted-forecast-production-smoke.test.ts
yarn test:unit --bail=0
VERCEL_ENV=preview yarn build

# Seaside
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/uv run --isolated \
  --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 \
  python -m pytest -p no:cacheprovider \
  tests/ -v --tb=short

# Database
supabase test db
```

No browser E2E is required unless implementation changes a route or UI contract beyond the forecast value. Privacy is primarily proven by server contract and database privilege tests.

---

## Validation Sign-Off

- [x] All planned task groups have automated verification or Wave 0 dependencies.
- [x] Sampling continuity: no three consecutive implementation tasks lack automated verification.
- [x] Wave 0 covers every currently missing test or tool.
- [x] No watch-mode flags.
- [x] Focused feedback target is under two minutes where dependencies are available.
- [x] `nyquist_compliant: true` is set in frontmatter.
- [ ] Plan 21-02 Task 0 has made Docker/local Supabase available and the focused pgTAP gate passes.
- [ ] Plan 21-01 Task 0 proves the isolated `uv` Python 3.11/pytest command.

**Approval:** pending
