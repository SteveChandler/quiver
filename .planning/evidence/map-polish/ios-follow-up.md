# iOS map follow-up — September 5, 2026

## Result

Fixed two shared-web defects found through the installed iOS native app:

1. Nested CSS scale transforms inflated WebKit accessibility rectangles. Pin construction and subsequent selection/hover updates now size the dot directly; the decorative dot is hidden from accessibility. The visible sizes and 44px button targets are preserved.
2. iOS `react-native-webview` injects commands with `window.dispatchEvent(new MessageEvent('message', {data}))`, whose source is null. The embed rejected these commands, so the native Play button toggled without advancing the map. The receiver now accepts null-source messages only when the native bridge exists. Other-frame messages and ordinary browser auth messages remain rejected; Android document delivery is unchanged.

The installed Quiver dev client successfully selected Osprey by accessibility label, advanced the actual forecast beyond Now, paused with the correct beach selected, and opened Osprey's native detail through Full forecast. All actions use labels/IDs, with no coordinate substitute in the final flow.

## Environment and boundaries

- Simulator: Quiver Swell Watch Fixture, iOS 26.5, `4123DB86-1864-455A-B01E-98F384EDDFA7`.
- Installed app: `app.quiversurf.mobile`, running this native worktree's bundle through Metro on 8083.
- The served bundle's generated `EXPO_PUBLIC_API_BASE_URL` was inspected and verified as `http://localhost:3107`; the local optimized web build uses the existing production database configuration.
- Existing test account and simulated San Diego location. No session, save, follow, purchase, or custom-spot mutations were exercised. Routine sign-in/analytics may occur; no direct production database writes, deployments, commits, or pushes were performed.
- Ignored local environment/build prerequisites were copied into the native worktree. Expo's generated environment initially retained the dev URL despite a shell override; the ignored `.env.local` was corrected before trusting native results.
- Intermittent overlapping dev-client launches crashed in Expo `NotificationCenterManager.addDelegate` / `PushTokenModule` (Swift release/EXC_BAD_ACCESS). The final single-launch test completed. This is not a release-binary crash certification or a notification-module fix.
- A cold local native map load took about 27 seconds. Subsequent render-health samples reached 56–60 fps, but these are debug-simulator observations, not physical-device performance certification.

## Files changed in this follow-up

Production web files:

- `components/map/map-marker-builder.ts` — direct visual sizing and decorative accessibility exclusion.
- `components/map/interactive-map.tsx` — keep selection/hover updates from reintroducing nested scaling.
- `app/embed/map/embed-map-client.tsx` — support the actual iOS native message source while preserving frame/auth boundaries.

Tests:

- `__tests__/components/map/map-condition-summary.test.ts` — selected/unselected sizing, no nested transform, decorative semantics.
- `__tests__/components/map/interactive-map.test.tsx` — verifies the selection update preserves direct dimensions and does not restore a transform.
- `__tests__/components/map/embed-map-native-messages.test.tsx` (new) — real embed receiver coverage for iOS/Android playback, pause, layers, auth, and source rejection.
- `e2e/guest-map-polish.spec.ts` — assert the rendered pin remains transform-free.
- `.planning/evidence/map-polish/ios-webkit.yaml` — restored label-based Safari tap and strict selected-callout assertion.
- Native `.planning/evidence/map-polish/native-map.yaml` — native selection, observable time advancement, pause, and detail navigation.

No native production source change remains from this follow-up. Temporary native message logging was removed; earlier forecast tuple changes remain in the native worktree.

## E2E reviewed

Reviewed native discovery `explore-s1-only.yaml`, `explore-beach-detail.yaml`, readiness/login helpers, `.maestro/AGENTS.md`, `.maestro/README.md`, and the read-only runner. Reviewed the existing web guest map specs and their isolated live-read configuration.

## Commands and evidence

All web commands run in `quiver/.worktrees/map-polish`, native commands in `quiver-native/.worktrees/map-polish`.

| Command | Result |
|---|---|
| `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` | PASS, final build 110.93s (`/tmp/map-ios-build3.log`) |
| `yarn test:unit --runInBand __tests__/components/map` | PASS, 394 tests / 30 suites before the final selection-effect correction |
| `yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx __tests__/components/map/embed-map-native-messages.test.tsx __tests__/components/map/map-condition-summary.test.ts` | PASS, 64 tests after that correction |
| `./node_modules/.bin/eslint components/map/map-marker-builder.ts components/map/interactive-map.tsx app/embed/map/embed-map-client.tsx --max-warnings=0` | PASS |
| `npm run typecheck` | PASS |
| `npm test -- --runInBand src/__tests__/swell-field-model.test.ts src/__tests__/webview-map-bridge.test.ts` | PASS, 43 tests |
| `maestro --device 4123DB86-1864-455A-B01E-98F384EDDFA7 test .planning/evidence/map-polish/native-map.yaml --debug-output /tmp/map-native-live5` | PASS; all selection, actual playback, pause and native detail assertions completed |
| `git diff --check` | PASS |

Earlier native attempts failed due to launch/setup interruptions, reproduced wrong-beach targeting, and exposed a weak button-only playback assertion. The assertion now requires Now to disappear through actual forecast advancement. The first direct-sizing patch missed the selection updater; the repeat run caught this and the updater was corrected. No failing result was counted as final verification.

## Screenshots reviewed

Native evidence directory: `/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/map-polish/.planning/evidence/map-polish/`:

- `native-osprey-selected.png` — original arrows and correct selected beach.
- `native-playback-selected.png` — forecast advanced to Mon 9 AM, paused, Osprey retained.
- `native-osprey-detail.png` — native beach-detail title confirms correct navigation.

Safari and final desktop/mobile browser results are appended below.

## Remaining limits

The targeted iOS selection and command-delivery defects are fixed. This is an installed dev-client simulator check, not a signed release artifact or physical iOS/Android check. Exact Windy model/component parity remains unverified. Full repository tests, purchase flows, and exhaustive VoiceOver navigation were not run. No claim of universal production readiness follows from these scoped results.

## Safari WebKit result: PASS

`maestro --device 4123DB86-1864-455A-B01E-98F384EDDFA7 test .planning/evidence/map-polish/ios-webkit.yaml --debug-output /tmp/map-ios-safari-final` — PASS. The accessibility-label tap selects Osprey and the strict Osprey surf-conditions assertion passes. `ios-webkit-selected.png` was reviewed; this replaces the earlier coordinate-only workaround.

## Final browser E2E result: PASS

`BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0` — **11/11 PASS**, 1.3 minutes, no retries (`/tmp/map-ios-web-final.log`). This includes the live marker transform assertions, selected-circle zoom sizing, arrow motion, regional colors, rate-limit recovery, and land clipping. Native and browser runs were sequential to avoid combining their API bursts.

Final status: native app flow PASS; Safari WebKit flow PASS; desktop/mobile Chromium flows PASS. The targeted iOS blocker from the previous report is resolved. Full release/device and model-parity limitations above remain.
