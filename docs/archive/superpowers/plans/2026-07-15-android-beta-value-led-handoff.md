# Android Beta Value-Led Handoff Implementation Plan

**Goal:** Remove the public free-Pro promise for new Android testers, lead with the product available now, and preserve a release-safe path for honoring everyone who saw the earlier offer.

**Grandfathering constraint:** The eligibility cutoff is the production deployment completion time for the copy-removal commit. Before that deployment, export Google Group membership and query `android_beta_leads.created_at` plus `profiles.android_waitlist_joined_at`; do not store tester identities in git.

## Task 1: Lock the public contract with failing tests

1. Assert the Android beta page names current product value and contains no free-Pro, pricing, or queue-priority promise.
2. Assert shared Android acquisition copy on plans, landing, download, and feature-card surfaces is incentive-free.
3. Assert HTML and plain-text beta instructions contain the ordered Group → Play → install steps without the retired offer.
4. Preserve the existing tests for ungated links, optional email confirmation, and distinct analytics destinations.

## Task 2: Replace incentive copy with immediate value

1. Lead the handoff with personalized surf decisions, best-window guidance, 279+ beaches, saved spots, alerts, session logging, and native access.
2. Reframe the fourth tester step around shaping Android quality and reporting useful feedback.
3. Remove the free-year language from the landing status strip, plans CTA, download page, feature data, and beta instruction email.
4. Do not introduce a replacement discount, founding price, priority promise, or future waitlist language.

## Task 3: Make grandfathering auditable

1. Record the pre-change evidence audit without tester identities.
2. Define the deployment-time cutoff and exact SQL evidence queries for leads and profile flags.
3. Require a Google Group member export immediately before production cutover because group-only testers are not represented in the database.
4. Document deduplication, 14-day participation verification, entitlement fulfillment, and a non-PII completion log.

## Task 4: Verify and finish the code change

1. Run focused Jest, scoped ESLint, typecheck, targeted Playwright, full Jest, preview build, and `git diff --check`.
2. Review every active public Android surface and both email formats for retired incentive copy.
3. Commit only issue files after all local gates pass.
4. Leave the GitHub issue open until the production timestamp and Google Group export complete the grandfathering cutoff.
