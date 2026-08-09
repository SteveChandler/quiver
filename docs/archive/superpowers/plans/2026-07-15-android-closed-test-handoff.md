# Android Closed-Test Handoff Implementation Plan

**Goal:** Route every public Android acquisition CTA through `/android-beta`, keep Google Group → Play opt-in → install in the correct order, and make email capture optional rather than an access gate.

**Product contract:** The Google account used for the tester group must match the Play Store account. Existing authorized testers get a direct Play shortcut from the handoff page. Email remains an optional communication channel and does not control visibility of either required link.

## Task 1: Lock the ungated handoff with failing tests

**Files:**
- Modify: `__tests__/app/android-beta-page.test.tsx`
- Modify: `__tests__/components/pricing/android-waitlist-cta.test.tsx`

1. Assert the Google Group and Play opt-in links render before email submission.
2. Assert optional email submission shows a confirmation without changing or hiding the required links.
3. Assert anonymous and authenticated public CTAs are links to the canonical `/android-beta` destination, not inline capture/confirmation actions.
4. Assert outbound handoff analytics retain source, surface, placement, auth state, and destination metadata.
5. Run both focused suites and confirm RED before production edits.

## Task 2: Centralize public acquisition routing

**Files:**
- Modify: `components/pricing/android-waitlist-cta.tsx`
- Modify: `components/pricing/founding-access-cta.tsx`
- Modify: `components/pricing/ARCHITECTURE.md`

1. Preserve the public component API used by landing, features, invite, partner, plans, and session surfaces while rendering one canonical link.
2. Keep impression/click analytics and identify the destination as the Android beta handoff.
3. Remove inline lead/profile confirmation behavior from acquisition CTAs; the canonical handoff owns optional capture.
4. Update signed-in and plans copy so no CTA claims to confirm access when it now opens instructions.

## Task 3: Make the handoff page complete without email

**Files:**
- Modify: `app/android-beta/android-beta-client.tsx`
- Modify: `e2e/guest-android-beta.spec.ts`

1. Render the ordered Group and Play actions before, during, and after optional email submission.
2. Label the email form as optional communication and keep its explicit saved state.
3. Keep same-account guidance, contact path, QR handoff, and outbound analytics intact.
4. Update the browser flow to prove access without email, then prove optional signup confirmation separately.

## Task 4: Verify and finish

1. Run focused Jest, scoped ESLint, typecheck, the targeted guest Playwright flow, and `git diff --check`.
2. Run full Jest because the shared CTA appears across multiple acquisition surfaces.
3. Run a preview build because browser routing and public UI changed.
4. Review for accidental edits to the unrelated SEO worktree changes, dropped analytics, gated links, raw outbound URLs on public acquisition surfaces, or misleading access copy.
5. Commit only the issue files after every required gate passes; do not push or deploy.
