# Phase 11 Live QR Checklist

**Status:** blocked; production headers pass, but live browser proof fails
**Last checked:** 2026-05-31T14:01:52Z
**Canonical URL:** `https://www.quiversurf.app/pbsc`
**Live QR asset:** `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/flyers/assets/qr-pbsc-live.svg`

## Approval Gate

| Action | Status |
|--------|--------|
| Deploy current PBSC route changes | Approval required |
| Push current branch or merge to a deploy-triggering branch | Approval required |
| Promote or change a Vercel alias | Approval required |
| Print sponsor-table flyers or QR handouts | Approval required |
| Send outbound PBSC email, DM, or reply | Approval required |
| Post social content or Reddit content | Approval required |
| Write campaign trackers or attendee lists | Approval required |
| Pay sponsorship, print, ad, or vendor costs | Approval required |

No push, deploy, alias promotion, print, outbound send, social post, tracker write, payment, or unrelated production mutation was performed.

## Approved Release Action

Current thread approval: `approve read-only production verification only; no deploy/push/alias`

This authorizes only production verification. It does not authorize a deploy, push, Vercel alias change, print run, outbound send, social post, campaign tracker write, payment, or unrelated production mutation.

## Current Production Status

Command:

```bash
curl -I -L --max-time 20 https://www.quiversurf.app/pbsc
```

Result: **AVAILABLE ON PRODUCTION**

| Header | Observed value |
|--------|----------------|
| HTTP status | `HTTP/2 200` |
| date | `Sun, 31 May 2026 14:01:52 GMT` |
| x-matched-path | `/pbsc` |
| x-vercel-cache | `HIT` |
| x-vercel-id | `sfo1::kvdg5-1780236112539-bc1a06555fce` |

Production now resolves through the dedicated `/pbsc` route. This was a read-only check only; no deploy, push, alias promotion, print, outbound send, social post, tracker write, payment, or unrelated production mutation was performed in this thread.

## Current Dev Status

Command:

```bash
curl -I -L --max-time 20 https://dev.quiversurf.app/pbsc
```

Result: **AVAILABLE ON DEV**

| Header | Observed value |
|--------|----------------|
| HTTP status | `HTTP/2 200` |
| date | `Sun, 31 May 2026 14:01:52 GMT` |
| x-matched-path | `/pbsc` |
| x-nextjs-prerender | `1` |
| x-vercel-cache | `HIT` |
| x-vercel-id | `sfo1::9q9ws-1780236112710-78b09db7ec7d` |

Dev still resolves through `/pbsc`, but it serves the same stale PBSC UI as production.

## QR Asset And Print Readiness

- QR asset path: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/flyers/assets/qr-pbsc-live.svg`
- Brand-Vault README identifies this asset as the QR code for `https://www.quiversurf.app/pbsc`.
- Decoded QR proof: PASS. `sharp` + `jsqr` decoded `qr-pbsc-live.svg` to `https://www.quiversurf.app/pbsc`.
- Flyer copy review: pending before print. The current flyer source still includes lines like `Open Tourmaline on Quiver` and `Scan Tourmaline live on Quiver`, which should be reviewed against the conversion-only route behavior before any approved print run.

## Live Browser Proof

| Surface | Required proof | Status |
|---------|----------------|--------|
| Desktop/default production browser | Android waitlist primary, no web fallback | FAIL: observed App Store link, `/map` link, and `Use Quiver on web`; observed 0 Android waitlist buttons |
| iOS production browser or real iOS Safari | App Store primary | FAIL: App Store link is present, but stale web fallback is still present |
| Android production browser or real Android Chrome | Android waitlist primary | FAIL: observed App Store link, `/map` link, and `Use Quiver on web`; observed 0 Android waitlist buttons |
| QR target | `https://www.quiversurf.app/pbsc` | PASS: decoded QR target matches canonical URL |

Production Playwright evidence:

```json
{"surface":"desktop","status":200,"titleVisible":true,"iphoneLinks":1,"androidButtons":0,"webFallbackText":1,"mapLinks":1}
{"surface":"ios","status":200,"titleVisible":true,"iphoneLinks":1,"androidButtons":0,"webFallbackText":1,"mapLinks":1}
{"surface":"android","status":200,"titleVisible":true,"iphoneLinks":1,"androidButtons":0,"webFallbackText":1,"mapLinks":1}
```

Dev Playwright evidence:

```json
{"surface":"dev-desktop","status":200,"iphoneLinks":1,"androidButtons":0,"webFallbackText":1,"mapLinks":1}
{"surface":"dev-ios","status":200,"iphoneLinks":1,"androidButtons":0,"webFallbackText":1,"mapLinks":1}
{"surface":"dev-android","status":200,"iphoneLinks":1,"androidButtons":0,"webFallbackText":1,"mapLinks":1}
```

Targeted production E2E command:

```bash
BASE_URL=https://www.quiversurf.app TEST_ENV=prod PLAYWRIGHT_PROD_READONLY=true SKIP_AUTH_SETUP=true npx playwright test e2e/guest-pbsc.spec.ts --project=guest
```

Result: **FAIL**. All 3 PBSC guest tests failed against production because the live page still contains the deprecated web fallback and does not render the Android waitlist branch for Android or desktop.

Root-cause finding: the checked-in route implementation has `export const dynamic = "force-dynamic"` and no `Use Quiver on web` copy, but production/dev headers include `x-nextjs-prerender: 1` and the live HTML contains `Open Quiver on iPhone`, `Use Quiver on web`, and `/map`. The deployed aliases are serving an older PBSC implementation even though the URL now matches `/pbsc`.

## Next Checkpoint

Plan 11-01 implementation and local validation are complete. Task 1 of Plan 11-02 recorded current live route truth.

Execution remains blocked. The next step requires an exact approved remediation action, such as a deploy/push/alias path, or an explicit `do not deploy`.
