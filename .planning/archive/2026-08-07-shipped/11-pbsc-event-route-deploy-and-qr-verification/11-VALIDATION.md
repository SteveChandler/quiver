---
phase: 11
slug: pbsc-event-route-deploy-and-qr-verification
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
---

# Phase 11 - Validation Strategy

Per-phase validation contract for PBSC route, CTA, and live QR proof.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Jest 29, Playwright |
| Config files | `jest.config.js`, `playwright.config.ts` |
| Quick run command | `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx` |
| Full suite command | `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck && npx playwright test e2e/guest-pbsc.spec.ts --project=guest` |
| Estimated runtime | 90-240 seconds locally, excluding deploy/live QR checks |

## Sampling Rate

- After each source task: run the focused Jest command for touched unit or
  component tests.
- After E2E task completion: run `npx playwright test --list` for the PBSC
  spec, then run the guest PBSC spec.
- Before phase verification: run typecheck, scoped ESLint, targeted Jest, and
  targeted guest Playwright.
- After approved deploy or alias promotion: run live `curl` and browser checks
  against `https://www.quiversurf.app/pbsc`.
- Max local feedback latency target: under 4 minutes for scoped checks.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 11-01 | 1 | PBSC-01 / PBSC-03 | T-11-01 / T-11-03 | Server-side OS split avoids wrong first-paint CTA and uses tracked PBSC metadata | typecheck | `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck` | Yes | passed |
| 11-01-02 | 11-01 | 1 | PBSC-02 | T-11-02 / T-11-06 | Anonymous waitlist intent returns to `/pbsc` after auth | unit/component | `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx` | Yes | passed |
| 11-01-03 | 11-01 | 1 | PBSC-04 | T-11-01 / T-11-03 | iOS sees App Store, non-iOS sees waitlist, web fallback absent | e2e/lint | `source ~/.nvm/nvm.sh && nvm use 22 && npx playwright test --list e2e/guest-pbsc.spec.ts && npx playwright test e2e/guest-pbsc.spec.ts --project=guest && npx eslint --max-warnings=0 app/pbsc/page.tsx app/pbsc/pbsc-scan-ctas.tsx actions/android-waitlist-actions.ts __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx e2e/guest-pbsc.spec.ts` | Yes | passed |
| 11-02-01 | 11-02 | 2 | PBSC-04 / PBSC-05 | T-11-07 / T-11-09 | Current live truth and approval gates are documented before release work | docs/curl | `test -f .planning/phases/11-pbsc-event-route-deploy-and-qr-verification/11-LIVE-QR-CHECKLIST.md && rg -n "https://www\\.quiversurf\\.app/pbsc|https://dev\\.quiversurf\\.app/pbsc|Approval required|x-matched-path" .planning/phases/11-pbsc-event-route-deploy-and-qr-verification/11-LIVE-QR-CHECKLIST.md` | Yes | passed |
| 11-02-02 | 11-02 | 2 | PBSC-05 | T-11-08 | Release/deploy/print/send actions wait for explicit approval | checkpoint | `N/A - blocking human checkpoint before production-impacting action` | N/A | pending |
| 11-02-03 | 11-02 | 2 | PBSC-04 / PBSC-05 | T-11-08 / T-11-10 | Production QR URL resolves to `/pbsc` with HTTP 200 after approval | live/manual | `curl -I -L --max-time 20 https://www.quiversurf.app/pbsc | tee /tmp/pbsc-prod-headers.txt && grep -q "HTTP/2 200" /tmp/pbsc-prod-headers.txt && grep -q "x-matched-path: /pbsc" /tmp/pbsc-prod-headers.txt && rg -n "Desktop proof: PASS|iOS proof: PASS|Android proof: PASS|QR target: https://www\\.quiversurf\\.app/pbsc" .planning/phases/11-pbsc-event-route-deploy-and-qr-verification/11-LIVE-QR-CHECKLIST.md` | No | pending |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Approved production deploy or alias promotion | PBSC-LIVE-QR | Production-impacting action is approval-gated | Get explicit approval, deploy or promote, then verify live URL returns HTTP 200 |
| iOS QR scan | PBSC-IOS-LIVE | Real iOS scanner/App Store behavior is device-dependent | Scan the PBSC live QR on iOS Safari and verify App Store primary path |
| Android QR scan | PBSC-ANDROID-LIVE | Real Android scanner/auth behavior is device-dependent | Scan the PBSC live QR on Android Chrome and verify Android waitlist primary path |
| Print/send approval | PBSC-APPROVAL | User required approval before print, send, post, or pay actions | Stop before any print, send, social post, tracker write, deploy, or alias promotion without explicit approval |

## Validation Sign-Off

- [x] All planned tasks have automated verification or a documented manual gate.
- [x] No three consecutive implementation tasks lack automated feedback.
- [x] Local focused checks are required before any release-gated action.
- [x] Production `www` route proof is required after approved deploy/promotion.
- [x] `nyquist_compliant: true` set in frontmatter after concrete plan tasks
  exist.

Approval: approved 2026-05-26
