# Phase 11 Live QR Checklist

**Status:** blocked at release approval checkpoint
**Last checked:** 2026-05-26T02:18:45Z
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

## Current Production Status

Command:

```bash
curl -I -L --max-time 20 https://www.quiversurf.app/pbsc
```

Result: **BLOCKED**

| Header | Observed value |
|--------|----------------|
| HTTP status | `HTTP/2 404` |
| date | `Tue, 26 May 2026 02:18:45 GMT` |
| x-matched-path | `/[intent]` |
| x-vercel-cache | `MISS` |
| x-vercel-id | `sfo1::iad1::gwsg2-1779761925077-5a724310d52e` |

Production is not ready for QR use. The canonical URL still resolves through the dynamic `/(intent)` match instead of the dedicated `/pbsc` route.

## Current Dev Status

Command:

```bash
curl -I -L --max-time 20 https://dev.quiversurf.app/pbsc
```

Result: **AVAILABLE ON DEV**

| Header | Observed value |
|--------|----------------|
| HTTP status | `HTTP/2 200` |
| date | `Tue, 26 May 2026 02:18:45 GMT` |
| x-matched-path | `/pbsc` |
| x-nextjs-prerender | `1` |
| x-vercel-cache | `HIT` |
| x-vercel-id | `sfo1::pk8c4-1779761925080-00e203de64b0` |

Dev proves the route exists on a deployed preview/dev alias, but this does not make the printed production QR destination usable.

## QR Asset And Print Readiness

- QR asset path: `/Users/stevenchandler/Desktop/dev/Brand-Vault/marketing/pbsc-summer-longboard-classic-2026/flyers/assets/qr-pbsc-live.svg`
- Brand-Vault README identifies this asset as the QR code for `https://www.quiversurf.app/pbsc`.
- Physical or decoded QR proof: pending until the release checkpoint is approved.
- Flyer copy review: pending before print. The current flyer source still includes lines like `Open Tourmaline on Quiver` and `Scan Tourmaline live on Quiver`, which should be reviewed against the conversion-only route behavior before any approved print run.

## Live Browser Proof

| Surface | Required proof | Status |
|---------|----------------|--------|
| Desktop/default production browser | Android waitlist primary, no web fallback | Pending production 200 |
| iOS production browser or real iOS Safari | App Store primary | Pending production 200 |
| Android production browser or real Android Chrome | Android waitlist primary | Pending production 200 |
| QR target | `https://www.quiversurf.app/pbsc` | Pending QR decode or scan proof |

## Next Checkpoint

Plan 11-01 implementation and local validation are complete. Task 1 of Plan 11-02 recorded current live route truth.

Execution must stop here until the current thread contains the exact approved release action, or the phrase `do not deploy`.
