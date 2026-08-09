# Summary 07-04: iOS CTA Rendering Validation

## Completed

- Ran scoped ESLint for iOS constants, iOS analytics, app-store components, landing CTA/hero/forecast components, root metadata, and targeted tests.
- Ran targeted Jest for shared App Store constants, iOS CTA analytics, iPhone banner, Apple beta prompt, landing hero, forecast section, CTA section, and root smart banner metadata.
- Ran Node 22 typecheck.
- Reviewed nearby E2E docs and guest Apple beta/pricing specs.
- Ran the Apple beta prompt guest Playwright spec.
- Captured desktop/mobile landing screenshots and an iPhone Chrome pricing-page banner screenshot.

## Verification

- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && ./node_modules/.bin/eslint --max-warnings=0 lib/constants/app-store.ts lib/analytics/ios-app-cta-tracking.ts components/app-store/iphone-app-banner.tsx components/app-store/apple-beta-prompt.tsx components/landing-page/hero-section.tsx components/landing-page/forecast-section.tsx components/landing-page/cta-section.tsx components/landing-page.tsx app/page.tsx app/layout.tsx __tests__/lib/constants/app-store.test.ts __tests__/lib/analytics/ios-app-cta-tracking.test.ts __tests__/components/app-store/iphone-app-banner.test.tsx __tests__/components/app-store/apple-beta-prompt.test.tsx __tests__/components/landing/hero-section.test.tsx __tests__/components/landing-page/forecast-section.test.tsx __tests__/components/landing-page/cta-section.test.tsx __tests__/app/root-app-store-metadata.test.ts` — passed.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && corepack yarn test:unit __tests__/lib/constants/app-store.test.ts __tests__/lib/analytics/ios-app-cta-tracking.test.ts __tests__/components/app-store/iphone-app-banner.test.tsx __tests__/components/app-store/apple-beta-prompt.test.tsx __tests__/components/landing/hero-section.test.tsx __tests__/components/landing-page/forecast-section.test.tsx __tests__/components/landing-page/cta-section.test.tsx __tests__/app/root-app-store-metadata.test.ts` — passed, 8 suites / 30 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && corepack yarn typecheck` — passed.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx playwright test --list e2e/guest-apple-beta-prompt.spec.ts e2e/guest-pricing.spec.ts` — passed/listed 4 guest tests.
- `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && BASE_URL=http://localhost:3000 npx playwright test e2e/guest-apple-beta-prompt.spec.ts --project=guest` — passed, 2 tests.
- Local Playwright browser capture script for `/`, mobile `/`, and iPhone Chrome `/pricing` — passed with no horizontal overflow, visible `Open App Store` CTAs, and smart banner metadata.

## Browser Evidence

- `/tmp/quiver-phase7-landing-desktop.png`
- `/tmp/quiver-phase7-landing-mobile.png`
- `/tmp/quiver-phase7-iphone-banner-pricing.png`

## Result

Phase 7 is complete. The web iOS source of truth, CTA rendering, TestFlight separation, smart-banner metadata, and Brand-Vault launch asset guidance are aligned to the current live Apple preorder state.
