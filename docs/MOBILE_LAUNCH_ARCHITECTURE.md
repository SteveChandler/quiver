# 📱 Quiver Mobile Launch — Architecture Plan

Date: September 2025  
**Status**: Phase 1 Complete - Ready for Native Build Generation  
**Last Updated**: January 2025

See also: `docs/ARCHITECTURE_REVIEW.md` (primary reference), `hooks/ARCHITECTURE.md`, `components/ARCHITECTURE.md`, `lib/ARCHITECTURE.md`, `supabase/ARCHITECTURE.md`.

---

## 1) Objectives & Constraints

- Deliver an iOS/Android experience quickly by wrapping the existing Next.js + Supabase product with Capacitor while preserving feature completeness (social graph, media, 10‑day forecasts, session logging).
- Satisfy store-review expectations with tangible native value (Share sheet, push-ready scaffolding, deep links, offline caching).
- Maintain a single source of truth for product logic, tests, and Supabase integrations to avoid fragmenting the stack.

---

## 2) Current Web Architecture Snapshot

- **Frontend**: Next.js 14 App Router with React, Tailwind, and shadcn/ui. Code organized under `app/`, `components/`, `hooks/`. Server actions, reusable UI, and data fetching follow the patterns in `hooks/ARCHITECTURE.md` (required `useDataFetcher` pattern).
- **Backend & Data**: Supabase Postgres with RLS, realtime subscriptions, and domain services in `lib/` and `supabase/` powering social feeds, forecasts, and session logs.
- **Testing**: Comprehensive Jest and Playwright coverage to ensure regression safety as we introduce a mobile shell (see `docs/E2E_TEST_PLAN.md`, `test-utils/ARCHITECTURE.md`).

---

## 3) Target Mobile Architecture

| Layer                             | Responsibilities                                                                                                                                           | Key Assets                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Capacitor Shell (iOS/Android)** | Host the web app, expose native APIs (Share, Push, filesystem), manage splash/icon assets, configure deep links, and wrap OTA delivery.                    | `capacitor.config.ts`, native projects in `ios/` and `android/` (generated)             |
| **Web App Core**                  | Continue to serve UI, routing, state management, and business logic for forecasts, sessions, media, and social interactions.                               | Existing Next.js modules under `app/`, `components/`, `hooks/`, `lib/`                  |
| **Native Bridge Adapters**        | Lightweight wrappers to expose Capacitor plugins to React (e.g., share session, schedule notifications) via TypeScript utilities or hooks.                 | New utilities in `lib/mobile/` (proposed) with typed interfaces                         |
| **Offline & Caching Layer**       | PWA manifest, service worker, and IndexedDB caching of key Supabase queries (forecasts, recent sessions) to satisfy review and provide offline resilience. | `public/manifest.json`, `public/sw.js`, caching hooks `hooks/useOffline*`               |
| **Observability & Config**        | Extend logging/analytics to capture device info, push token registration, and track mobile-specific funnels.                                               | Reuse analytics pipeline in `lib/analytics`, extend Supabase tables for device metadata |

---

## 4) Cross-Cutting Concerns

- **Authentication & Deep Linking**: Allow Supabase auth redirects through `quiver://auth` (iOS) and HTTPS App Links; ensure OAuth providers accept new redirect URLs.
- **Realtime & Background Behavior**: Maintain Supabase subscriptions for social feeds but gate background usage (pause channels when app is backgrounded to save battery).
- **Media Handling**: Reuse Supabase storage flow; optionally add native photo picker via Capacitor Camera in later iterations.
- **Analytics & Metrics**: Track acquisition (store installs), activation (first logged session), retention (7/30-day), virality (shares/invites) as highlighted in the 30‑day growth plan.
- **Deep Link Files**: Serve Android `assetlinks.json` and Apple's `apple-app-site-association` from `/app/.well-known`. Configure via env vars (`ANDROID_APP_PACKAGE`, `ANDROID_SHA256_FINGERPRINTS`, `APPLE_TEAM_ID`/`APPLE_APP_BUNDLE_ID` or `APPLE_APP_ID`, optional `APPLE_APP_SITE_ASSOCIATION_PATHS`, `APPLE_WEB_CREDENTIALS_APP_IDS`).

---

## 5) Platform-Specific Design

### iOS

- Associated Domains for universal links (`applinks:quiversurf.app`).
- Privacy manifests aligned with existing Supabase analytics; declare Push and Background Modes only if implemented.
- Provide Xcode build pipeline for `.ipa` using Capacitor’s generated project.

### Android

- `assetlinks.json` served from `/.well-known` via Next.js `app/.well-known/route.ts`.
- Sign with Play App Signing; ensure push permission prompts follow Android 13+ requirements.
- Generate `.aab` via Android Studio or CI.

---

## 6) Native Feature Surface (Phase 1)

- **Share Sheet Integration**

  - Add `@capacitor/share` and expose `shareSession(sessionId)` util that deep‑links to the hosted session permalink, complementing existing social‑share efforts.

- **Push Notification Scaffolding**

  - Install `@capacitor/push-notifications`, request permission post‑onboarding, capture device tokens into Supabase for future campaigns.

- **Offline Forecast Cache**

  - Service worker caches last‑viewed forecasts and tides so store reviewers see native value even offline.

- **Splash/Icon Assets**
  - Use `@capacitor/assets` with provided brand palette.

---

## 7) Infrastructure & CI/CD

- **Repository Structure**: Keep mobile config within main repo to leverage existing tests. Add scripts: `mobile:sync`, `mobile:build:ios`, `mobile:build:android`.
- **CI Enhancements**: Extend GitHub Actions to lint `capacitor.config.ts`, ensure `npx cap sync` runs during release branches, and optionally trigger EAS‑like build pipelines.
- **Secrets Management**: Store Apple/Google credentials in GitHub Actions secrets for later automation; continue to manage Supabase keys via `.env` but avoid bundling secrets in native builds.

---

## 8) Security & Privacy

- Reuse Supabase RLS and auth policies; ensure mobile app respects same token storage (Capacitor Secure Storage recommended vs. `localStorage` for refresh tokens).
- Update privacy policy to reflect mobile data collection (device identifiers, push tokens).
- Ensure PWA/service worker complies with anti‑stale‑data principle by validating cached forecasts before display, falling back to error states when outdated.

---

## 9) Implementation Status & Next Steps

### ✅ **COMPLETED (Phase 1 - Web App Readiness)**

| Component                  | Status      | Implementation Details                                                                             |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| **PWA Foundation**         | ✅ Complete | `public/manifest.json` with shortcuts, icons, protocol handlers                                    |
| **Service Worker**         | ✅ Complete | `public/sw.js` with forecast caching, TTL validation, anti-stale-data policy                       |
| **Capacitor Config**       | ✅ Complete | `capacitor.config.ts` with production URL, push config, splash settings                            |
| **Native Bridge Adapters** | ✅ Complete | `lib/mobile/` with share, push, platform detection utilities                                       |
| **Push Infrastructure**    | ✅ Complete | `hooks/use-native-push-registration.ts`, `actions/mobile-actions.ts`, database schema              |
| **Deep Link Support**      | ✅ Complete | `app/.well-known/` routes for Android `assetlinks.json` and Apple `apple-app-site-association`     |
| **Mobile Scripts**         | ✅ Complete | `package.json` scripts: `mobile:sync`, `mobile:build:ios`, `mobile:build:android`, `mobile:assets` |
| **PWA Listeners**          | ✅ Complete | `components/analytics/pwa-and-push-listeners.tsx` for SW registration and PWA install tracking     |
| **Mobile Assets**          | ✅ Complete | `mobile/assets/` with app icons and splash screens, `mobile/capacitor-assets.config.ts`            |

### 🚧 **NEXT STEPS (Phase 2 - Native Build Generation)**

| Priority   | Task                             | Dependencies                                 | Timeline |
| ---------- | -------------------------------- | -------------------------------------------- | -------- |
| **HIGH**   | Generate iOS/Android projects    | Run `npm run mobile:sync`                    | 1 day    |
| **HIGH**   | Configure iOS Associated Domains | Apple Developer account, domain verification | 2-3 days |
| **HIGH**   | Set up Android App Links         | Google Play Console, domain verification     | 2-3 days |
| **MEDIUM** | Test native builds on devices    | iOS Simulator, Android Emulator              | 3-5 days |
| **MEDIUM** | Implement secure token storage   | Capacitor Secure Storage plugin              | 2-3 days |
| **LOW**    | Set up CI/CD for mobile builds   | GitHub Actions, Apple/Google credentials     | 5-7 days |

### 📋 **IMMEDIATE ACTIONS REQUIRED**

1. **Run Native Project Generation**:

   ```bash
   npm run mobile:sync
   npm run mobile:build:ios    # Opens Xcode
   npm run mobile:build:android # Opens Android Studio
   ```

2. **Configure Deep Links**:

   - Set environment variables: `ANDROID_APP_PACKAGE`, `ANDROID_SHA256_FINGERPRINTS`, `APPLE_TEAM_ID`, `APPLE_APP_BUNDLE_ID`
   - Verify `.well-known` routes are accessible at `https://quiversurf.app/.well-known/`

3. **Test PWA Features**:
   - Verify service worker registration in browser dev tools
   - Test offline forecast caching
   - Validate push notification permission flow

### 🎯 **STORE SUBMISSION READINESS (Week 3-4)**

| Requirement                       | Status     | Notes                                            |
| --------------------------------- | ---------- | ------------------------------------------------ |
| **Native Share Integration**      | ✅ Ready   | `shareSession()` utility with Capacitor fallback |
| **Push Notification Scaffolding** | ✅ Ready   | Device token registration, permission flow       |
| **Offline Functionality**         | ✅ Ready   | Forecast caching with TTL validation             |
| **Deep Link Support**             | ✅ Ready   | Universal links and app links configured         |
| **PWA Manifest**                  | ✅ Ready   | Icons, shortcuts, protocol handlers              |
| **Privacy Compliance**            | ⚠️ Pending | Update privacy policy for mobile data collection |
| **Store Assets**                  | ⚠️ Pending | App Store screenshots, Play Store graphics       |

---

## 10) Current Implementation Details

### **Mobile Infrastructure Components**

#### **PWA & Offline Support**

- **Service Worker**: `public/sw.js` implements forecast caching with 6-hour TTL
- **Manifest**: `public/manifest.json` includes app shortcuts, protocol handlers, and PWA metadata
- **Anti-Stale-Data Policy**: Cached forecasts are timestamped and validated before serving

#### **Native Bridge Architecture**

- **Platform Detection**: `lib/mobile/platform.ts` detects iOS/Android vs web
- **Share Integration**: `lib/mobile/share.ts` provides fallback chain: Capacitor → Web Share → Copy URL
- **Push Notifications**: `lib/mobile/push-client.ts` handles device token registration
- **Push Hook**: `hooks/use-native-push-registration.ts` manages permission flow and analytics

#### **Database Schema**

- **Push Devices Table**: `public.push_devices` with RLS policies for secure token storage
- **Migration**: `supabase/migrations/20250922100000_create_push_devices_table.sql`

#### **Deep Link Infrastructure**

- **Android App Links**: `app/.well-known/assetlinks.json/route.ts` serves verification file
- **iOS Universal Links**: `app/.well-known/apple-app-site-association/route.ts` serves verification file
- **Environment Configuration**: Supports `ANDROID_APP_PACKAGE`, `APPLE_TEAM_ID`, etc.

#### **Build & Asset Pipeline**

- **Capacitor Config**: `capacitor.config.ts` with production URL and plugin settings
- **Asset Generation**: `mobile/capacitor-assets.config.ts` for icons and splash screens
- **Build Scripts**: `mobile:sync`, `mobile:build:ios`, `mobile:build:android`, `mobile:assets`

### **Integration Points**

#### **Analytics & Tracking**

- Push opt-in events tracked via `lib/analytics`
- PWA install events captured in `components/analytics/pwa-and-push-listeners.tsx`
- Share events include channel detection and fallback tracking

#### **Authentication Flow**

- Supabase auth redirects configured for mobile deep links
- Token storage respects mobile security requirements
- OAuth providers support mobile redirect URIs

---

## 11) Risks & Mitigations

### **✅ MITIGATED RISKS**

- **Store Rejection for Web‑Only Experience** → **RESOLVED**

  - ✅ Native Share integration implemented with Capacitor fallback
  - ✅ Offline forecast caching with TTL validation
  - ✅ Push notification scaffolding ready
  - ✅ PWA manifest with native-like shortcuts and protocol handlers

- **Offline Cache Staleness** → **RESOLVED**
  - ✅ Service worker implements timestamp validation
  - ✅ 6-hour TTL with stale data detection
  - ✅ Anti-stale-data policy enforced (fails instead of serving stale data)

### **⚠️ ACTIVE RISKS**

- **Auth Redirect Breakage**

  - **Risk**: OAuth providers may reject new mobile redirect URIs
  - **Mitigation**: Test deep link flows early with staging environment
  - **Status**: Deep link infrastructure ready, needs OAuth provider configuration

- **Native Build Complexity**

  - **Risk**: iOS/Android project generation may require additional configuration
  - **Mitigation**: Start with `npm run mobile:sync` and address issues incrementally
  - **Status**: Capacitor config complete, ready for project generation

- **Store Review Timeline**
  - **Risk**: App Store/Play Store review process may take longer than expected
  - **Mitigation**: Submit early with comprehensive review notes and demo credentials
  - **Status**: All technical requirements met, pending store assets and privacy policy updates

### **📋 POST-LAUNCH CONSIDERATIONS**

- **Advanced Native Features**: Camera integration, background refresh, biometric auth
- **Performance Optimization**: Bundle size analysis, native module optimization
- **Platform-Specific Enhancements**: iOS widgets, Android shortcuts, platform-specific UI patterns

---

### Alignment With Existing Patterns

- Follows `hooks/ARCHITECTURE.md` data fetching pattern (`useCallback` + `useDataFetcher`).
- Uses centralized API and server action utilities documented in `lib/ARCHITECTURE.md`.
- Keeps growth‑first priorities from `docs/ARCHITECTURE_REVIEW.md` front‑and‑center (social sharing, virality, community).
