# Phase 11: PBSC Event Route Deploy And QR Verification - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the printed PBSC QR destination work as a focused event scan
path at `https://www.quiversurf.app/pbsc`, then verifies the live public route
before PBSC materials are treated as usable. The implementation target is the
existing `/pbsc` route, not a broader campaign rebuild.

</domain>

<decisions>
## Implementation Decisions

### QR Scan Destination Outcome
- **D-01:** `/pbsc` should choose the primary conversion action by visitor OS:
  iOS visitors get the App Store path first; every non-iOS visitor gets the
  Android waitlist first.
- **D-02:** The non-iOS path should render an event-specific Android waitlist
  CTA in the `/pbsc` page itself, using the existing Android waitlist
  action/pending-intent flow rather than sending users to `/plans` first.
- **D-03:** Desktop, tablet, Android phone, and other non-iOS scanners all get
  the Android waitlist as the primary action. Do not reserve the waitlist only
  for Android phones.
- **D-04:** Remove the web fallback from the PBSC scan path. The page should
  focus on OS-specific conversion only: iOS/App Store and non-iOS/Android
  waitlist.

### Existing Safety Gates
- **D-05:** Production deploy, alias promotion, printing, outbound sends, social
  posts, tracker writes, and any other production-impacting action remain
  approval-gated. Plans may include those as manual or `autonomous: false`
  verification/release tasks, but should not assume approval.
- **D-06:** The canonical QR destination stays
  `https://www.quiversurf.app/pbsc`. The planner must preserve this URL in
  route, flyer, QR, and verification references.

### Review-Added Planning Constraints
- **D-07:** The plan must explicitly choose how the OS split is implemented.
  `app/pbsc/page.tsx` is currently a server component with static links, so the
  planner must decide between a hydration-safe client wrapper and a server
  user-agent strategy. The plan must include coverage for iPhone/iOS, Android,
  desktop, and tablet behavior.
- **D-08:** PBSC App Store clicks should not remain untracked by accident. The
  plan must either use the existing iOS CTA tracking path with PBSC-specific
  metadata or explicitly document why PBSC iOS CTA tracking is out of scope.
- **D-09:** The Android waitlist signup return path needs verification.
  Anonymous waitlist clicks on `/pbsc` should store the PBSC waitlist intent,
  open signup, return to `/pbsc`, and confirm the same event-specific waitlist
  intent after auth.
- **D-10:** Copy must not overpromise immediate web/Tourmaline access after the
  web fallback is removed. If flyer/page copy says "Open Tourmaline on Quiver"
  or "Scan Tourmaline live," the route experience must either support that
  promise or the copy must be tightened to match the App Store / Android
  waitlist conversion path.
- **D-11:** Production verification is required, not optional. Phase completion
  must include `curl -I -L https://www.quiversurf.app/pbsc` returning HTTP 200
  after approved deploy/alias work, plus desktop and mobile browser proof for
  the live QR destination. Current `www` status is a blocker, not a warning.

### the agent's Discretion
- The user did not choose detailed proof depth in this discussion. Planner may
  select the smallest meaningful proof chain, but it should include current live
  route checks because `www.quiversurf.app/pbsc` was still HTTP 404 while
  `dev.quiversurf.app/pbsc` was HTTP 200 during context gathering.
- The user did not choose exact PBSC copy changes beyond the OS-specific CTA
  outcome. Keep copy aligned with Brand-Vault PBSC messaging and avoid
  unrelated copy rewrites.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD And Launch State
- `.planning/ROADMAP.md` - Phase 11 scope and dependency on Phase 10.
- `.planning/PROJECT.md` - launch campaign constraints, approval gates, and
  Brand-Vault-first asset source rule.
- `.planning/STATE.md` - current project state and live-route blockers.
- `.planning/phases/10-go-live-verification/10-CONTEXT.md` - prior live-route
  mismatch pattern and verification boundary.
- `.planning/phases/10-go-live-verification/10-GO-LIVE-CHECKLIST.md` - release
  gates, live-check command style, and approval-gated actions.

### PBSC Route And Conversion Components
- `app/ARCHITECTURE.md` - App Router route conventions.
- `app/pbsc/page.tsx` - current PBSC landing route to update.
- `components/pricing/ARCHITECTURE.md` - Android waitlist rules and pricing
  claim limits.
- `components/pricing/android-waitlist-cta.tsx` - existing Android waitlist
  CTA, pending intent, auth modal, and profile confirmation flow.
- `components/app-store/ios-app-store-cta.tsx` - existing tracked App Store CTA
  component for PBSC-specific iOS CTA measurement if reused.
- `actions/android-waitlist-actions.ts` - server action that persists Android
  waitlist intent.
- `lib/analytics/ios-app-cta-tracking.ts` - iOS CTA view/click tracking helper
  that dual-fires product analytics and internal CTA events.
- `lib/constants/android-waitlist.ts` - Android waitlist CTA text and status
  constants.
- `lib/constants/app-store.ts` - App Store URL, CTA, and destination status.
- `lib/utils/user-agent-parser.ts` - existing device and OS parser for user
  agent based routing decisions.

### Deploy And Live Verification
- `next.config.mjs` - Next.js config and headers.
- `.vercelignore` - deploy inclusion/exclusion behavior.
- `vercel.json` - ignored-build command and Vercel project behavior.
- `e2e/ARCHITECTURE.md` - Playwright project and environment conventions.
- `e2e/README.md` - local/dev/prod E2E run guidance.
- `e2e/guest-smoke.spec.ts` - existing guest smoke style and public route
  assertion patterns.

### PBSC Campaign Source Of Truth
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/README.md` - PBSC event frame, QR destination, message, and asset list.
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/event-capture-checklist.md` - event-day QR verification and table checklist.
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/flyers/pbsc-flyers.html` - printed flyer and handout copy using the `/pbsc` QR.
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/flyers/assets/qr-pbsc-live.svg` - live QR asset for `https://www.quiversurf.app/pbsc`.
- `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/email-drafts.md` - PBSC email draft URL/copy guardrail; do not send without approval.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AndroidWaitlistCta`: client component that tracks Android waitlist CTA view
  and click, stores anonymous pending intent, opens signup, and confirms the
  profile flag after auth.
- `IosAppStoreCta`: client component that wraps the App Store URL with existing
  iOS CTA view/click tracking and accepts `source`, `surface`, and `placement`
  metadata.
- `IOS_APP_STORE_URL`: current App Store destination. iTunes lookup during
  context gathering returned Quiver version `1.0`, bundle
  `app.quiversurf.mobile`, `formattedPrice=Free`, and release date
  `2026-05-25T07:00:00Z`.
- `parseUserAgent`: existing OS/device parsing utility can support the
  iOS-vs-non-iOS split if the route needs server-side or client-side device
  classification.
- `public/images/seo-dioramas/spot-backgrounds/tourmaline-photo.webp`: current
  image used by `/pbsc`, matching the Brand-Vault PBSC flyer asset.

### Established Patterns
- Android waitlist copy and behavior should stay inside the existing waitlist
  component/action path instead of inventing a second waitlist primitive.
- Public offer and pricing copy must avoid prices, checkout links, purchase
  availability, or cross-platform entitlement claims.
- Guest-facing tests should use existing Playwright error detection helpers and
  scoped route assertions.
- Production alias/deploy work is approval-gated; route proof can be planned,
  but execution must respect approval boundaries.

### Integration Points
- `/pbsc` currently has two static `Link` CTAs to App Store and web map. The
  plan should replace the web fallback with the OS-specific Android waitlist
  flow and preserve the event context in CTA metadata.
- The implementation must account for the current server-component shape of
  `app/pbsc/page.tsx`; introducing client-only device branching should avoid
  hydration flashes where the wrong CTA appears before client detection settles.
- Tests should prove the intended CTA would fail if the OS split regressed:
  iPhone/iOS sees App Store primary and no Android primary; Android, desktop,
  and tablet see Android waitlist primary and no web fallback.
- Live route checks during context gathering:
  - `https://dev.quiversurf.app/pbsc` returned HTTP 200 and matched `/pbsc`.
  - `https://www.quiversurf.app/pbsc` returned HTTP 404 and matched `/[intent]`.

</code_context>

<specifics>
## Specific Ideas

- iOS scanners should see the App Store primary path.
- Everyone else should see Android waitlist primary.
- The Android waitlist should be in-page on `/pbsc`, not a redirect to `/plans`.
- No web fallback should remain in the PBSC scan experience.
- Anonymous Android waitlist flow should preserve event attribution through
  signup and return to `/pbsc`.
- Final proof should include production `www` 200, not only local or dev route
  proof.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 11-PBSC Event Route Deploy And QR Verification*
*Context gathered: 2026-05-26*
