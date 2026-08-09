# Phase 11: PBSC Event Route Deploy And QR Verification - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/pbsc/page.tsx` | App Router page | request header -> server render | `app/e2e/apple-beta-prompt/page.tsx`, `app/pbsc/page.tsx` | exact |
| `app/pbsc/pbsc-scan-ctas.tsx` | client CTA component | server prop -> tracked client CTA | `app/features/page.tsx`, `components/app-store/ios-app-store-cta.tsx`, `components/pricing/android-waitlist-cta.tsx` | exact |
| `actions/android-waitlist-actions.ts` | server action | authenticated profile update | `actions/android-waitlist-actions.ts` | exact |
| `__tests__/app/pbsc-page.test.tsx` | Jest route/component test | render assertions | `__tests__/app/features-page.test.tsx`, `__tests__/app/pricing-page.test.tsx` | exact |
| `__tests__/components/pricing/android-waitlist-cta.test.tsx` | Jest component test | storage/auth modal/action assertions | existing same file | exact |
| `e2e/guest-pbsc.spec.ts` | Playwright guest spec | browser route assertions | `e2e/guest-smoke.spec.ts` | exact |
| `.planning/phases/11-pbsc-event-route-deploy-and-qr-verification/11-LIVE-QR-CHECKLIST.md` | release checklist | live route evidence capture | `.planning/phases/10-go-live-verification/10-GO-LIVE-CHECKLIST.md` | role-match |

## Pattern Assignments

### `app/pbsc/page.tsx` (App Router page, request header -> server render)

**Analogs:** existing `app/pbsc/page.tsx` and `app/e2e/apple-beta-prompt/page.tsx`

**Current PBSC CTA pattern** (`app/pbsc/page.tsx` lines 83-96):

```tsx
<div className="mt-8 flex flex-col gap-3 sm:flex-row">
  <Link href={IOS_APP_STORE_URL}>Open Quiver on iPhone</Link>
  <Link href={WEB_APP_URL}>Use Quiver on web</Link>
</div>
```

**Headers pattern** (`app/e2e/apple-beta-prompt/page.tsx` lines 23-28):

```tsx
export default async function AppleBetaPromptE2EPage(...) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
}
```

**Apply to Phase 11:**

- Keep `app/pbsc/page.tsx` as the route owner.
- Import `headers` from `next/headers` and call `await headers()` inside the async page, matching the Next 16 pattern.
- Import `parseUserAgent` from `lib/utils/user-agent-parser.ts`.
- Remove `WEB_APP_URL` and every `/map` fallback link from `/pbsc`.
- Pass `isIosVisitor={parseUserAgent(userAgent).os === "iOS"}` into the route-local CTA component.

### `app/pbsc/pbsc-scan-ctas.tsx` (client CTA component, server prop -> tracked client CTA)

**Analogs:** `app/features/page.tsx`, `components/app-store/ios-app-store-cta.tsx`, `components/pricing/android-waitlist-cta.tsx`

**Feature route CTA composition** (`app/features/page.tsx` lines 167-184):

```tsx
<IosAppStoreCta
  source="features-hero-app-store"
  surface="features-page"
  placement="hero_primary"
>
  {IOS_APP_STORE_CTA}
</IosAppStoreCta>
<AndroidWaitlistCta
  source="features-hero-android-waitlist"
  surface="features-page"
  placement="hero_secondary"
>
  Android waitlist
</AndroidWaitlistCta>
```

**iOS tracking wrapper** (`components/app-store/ios-app-store-cta.tsx` lines 22-79):

```tsx
export function IosAppStoreCta({ source, surface, placement, className, children }: IosAppStoreCtaProps): ReactElement {
  ...
  return <a href={IOS_APP_STORE_URL} onClick={() => trackIosAppCtaClick({ source, surface, placement, ... })}>{children}</a>;
}
```

**Android waitlist wrapper** (`components/pricing/android-waitlist-cta.tsx` lines 81-225):

```tsx
export function AndroidWaitlistCta({ source, surface, placement, ... }: AndroidWaitlistCtaProps): ReactElement {
  const pathname = usePathname();
  ...
  <UnifiedAuthModal source={source} returnTo={pathname || "/plans"} />
}
```

**Apply to Phase 11:**

- Create a route-local client component, `PbscScanCtas`, with explicit props:
  `isIosVisitor: boolean`, `placement: "hero_primary" | "bottom_primary"`.
- Use `IosAppStoreCta` only when `isIosVisitor` is true.
- Use `AndroidWaitlistCta` for every non-iOS branch.
- Use PBSC metadata:
  - iOS source: `pbsc-event-app-store`
  - Android source: `pbsc-event-android-waitlist`
  - surface: `pbsc-page`
  - placement: `hero_primary` or `bottom_primary`
- Keep CTA classes within the existing PBSC route visual language and UI-SPEC colors.

### `actions/android-waitlist-actions.ts` (server action, authenticated profile update)

**Analog:** existing same file

**Validation and ownership pattern** (`actions/android-waitlist-actions.ts` lines 12-44):

```ts
const androidWaitlistIntentSchema = z.object({
  source: z.string().trim().min(1).max(120),
  surface: z.string().trim().min(1).max(80),
  placement: z.string().trim().min(1).max(80),
});

return withAuthenticatedAction(async (user, supabase) => {
  ...
  await supabase.from("profiles").update(profileUpdate).eq("id", user.id)
});
```

**Current revalidation list** (`actions/android-waitlist-actions.ts` lines 82-85):

```ts
revalidatePath("/features");
revalidatePath("/plans");
revalidatePath("/pricing");
revalidatePath("/profile");
```

**Apply to Phase 11:**

- Do not change validation schema or Supabase write semantics.
- Add `revalidatePath("/pbsc")` if the action is touched, so the event route is included in the waitlist confirmation invalidation set.

### `__tests__/app/pbsc-page.test.tsx` (Jest route/component test, render assertions)

**Analogs:** `__tests__/app/features-page.test.tsx`, `__tests__/app/pricing-page.test.tsx`

**Route render test pattern** (`__tests__/app/features-page.test.tsx` lines 1-24):

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import FeaturesPage, { metadata } from "@/app/features/page";
...
jest.mock("@/components/pricing/android-waitlist-cta", () => ({ ... }));
```

**Render assertions** (`__tests__/app/features-page.test.tsx` lines 57-128):

```tsx
render(<FeaturesPage />);
expect(screen.getByRole("heading", { name: /a surf app that gets personal/i })).toBeInTheDocument();
expect(screen.queryByText(/home-break finder/i)).not.toBeInTheDocument();
```

**Apply to Phase 11:**

- Mock `next/image` like `features-page.test.tsx`.
- Mock `IosAppStoreCta` and `AndroidWaitlistCta` so tests can assert `data-source`, `data-surface`, and `data-placement`.
- Test the route-local CTA component for iOS, Android/non-iOS, and web fallback absence.
- If testing the async route directly, mock `next/headers` and render `await PbscPage()`.

### `__tests__/components/pricing/android-waitlist-cta.test.tsx` (Jest component test, storage/auth modal/action assertions)

**Analog:** existing same file

**Pathname mock pattern** (`__tests__/components/pricing/android-waitlist-cta.test.tsx` lines 13-15):

```ts
jest.mock("next/navigation", () => ({
  usePathname: () => "/features",
}));
```

**Anonymous return path assertion** (`__tests__/components/pricing/android-waitlist-cta.test.tsx` lines 136-166):

```tsx
await user.click(screen.getByRole("button", { name: /android waitlist/i }));
expect(screen.getByTestId("auth-modal")).toHaveAttribute("data-return-to", "/features");
```

**Apply to Phase 11:**

- Change the `next/navigation` mock to expose a mutable pathname value or add a focused `describe` block that returns `/pbsc`.
- Add a PBSC-specific anonymous test that asserts:
  - stored intent source is `pbsc-event-android-waitlist`
  - surface is `pbsc-page`
  - placement is `hero_primary` or `bottom_primary`
  - auth modal `data-return-to` is `/pbsc`

### `e2e/guest-pbsc.spec.ts` (Playwright guest spec, browser route assertions)

**Analog:** `e2e/guest-smoke.spec.ts`

**Guest storage and error detection pattern** (`e2e/guest-smoke.spec.ts` lines 11-30):

```ts
import { test, expect } from '@playwright/test';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Smoke: Critical Pages', () => {
  let errorCapture: ErrorCapture;
  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });
});
```

**CTA assertions** (`e2e/guest-smoke.spec.ts` lines 53-58):

```ts
await expect(page.getByRole('link', { name: /open app store/i }).first()).toHaveAttribute('href', IOS_APP_STORE_URL);
await expect(page.getByRole('button', { name: /android waitlist/i }).first()).toBeVisible();
```

**Apply to Phase 11:**

- Name the file `guest-pbsc.spec.ts` because anonymous tests must be `guest-*.spec.ts`.
- Use `browser.newContext({ userAgent })` or project-level page user-agent overrides to create iPhone, Android, and desktop checks.
- Assert `/pbsc` responds 200, the correct primary CTA appears, and `Use Quiver on web` is absent.
- Use `assertNoErrors(page, errorCapture, { context: "PBSC ..." })` after each browser flow.

### `11-LIVE-QR-CHECKLIST.md` (release checklist, live route evidence capture)

**Analog:** `.planning/phases/10-go-live-verification/10-GO-LIVE-CHECKLIST.md`

**Apply to Phase 11:**

- Create a Phase 11 checklist only after code/test validation is complete or in the approval-gated release plan.
- Record exact command output summaries for:
  - `curl -I -L --max-time 20 https://www.quiversurf.app/pbsc`
  - `curl -I -L --max-time 20 https://dev.quiversurf.app/pbsc`
  - desktop browser proof
  - iOS mobile proof
  - Android mobile proof
  - QR asset decode/scan proof for `https://www.quiversurf.app/pbsc`
- Preserve approval gates for deploy, alias promotion, print, send, post, pay, and tracker writes.

## Shared Patterns

### Authenticated Server Action

**Source:** `actions/android-waitlist-actions.ts`
**Apply to:** Android waitlist confirmation path

Use `withAuthenticatedAction`; do not expose unauthenticated profile writes.

### CTA Tracking

**Source:** `components/app-store/ios-app-store-cta.tsx` and `components/pricing/android-waitlist-cta.tsx`
**Apply to:** PBSC iOS and non-iOS CTAs

Use existing `source`, `surface`, and `placement` metadata rather than adding new analytics event types.

### User-Agent Branching

**Source:** `lib/utils/user-agent-parser.ts`
**Apply to:** `app/pbsc/page.tsx`

Use the existing `parseUserAgent(userAgent).os === "iOS"` branch. Non-iOS includes Android, desktop, tablet, empty UA, and unknown UA.

### Guest E2E

**Source:** `e2e/guest-smoke.spec.ts`
**Apply to:** `e2e/guest-pbsc.spec.ts`

Use guest storage state, error capture setup, route response assertions, accessible role selectors, and no arbitrary sleeps.

## No Analog Found

None.

## Metadata

**Analog search scope:** `app/`, `components/`, `actions/`, `lib/`, `__tests__/`, `e2e/`, `.planning/phases/10-go-live-verification/`
**Files scanned:** 14 targeted files plus grep results
**Pattern extraction date:** 2026-05-26

## PATTERN MAPPING COMPLETE
