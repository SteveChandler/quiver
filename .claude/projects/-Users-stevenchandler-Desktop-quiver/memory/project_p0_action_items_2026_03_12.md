---
name: P0 Action Items from Production Data Review
description: Status of P0 measurement fixes from March 12 2026 production data review - dashboard fixes, email CTA verification, Apple auth
type: project
---

## P0 Action Items (2026-03-12)

### P0.1 + P0.2: App-Stats Dashboard Fix — DONE
- Fixed `LEFT JOIN` on `user_events` queries (Q5, Q7, Q9, Q10) to include anonymous events
- Added 3 new queries: Q15 (Signup Funnel Breakdown), Q16 (Onboarding Steps), Q17 (Daily Anon vs Auth)
- `signup_cta_view` and `signup_cta_click` are now separated in the dashboard output
- **Why:** Anonymous events were being undercounted 27-77% because `JOIN profiles` dropped rows where `user_id` is NULL

### P0.3: One-Tap Email CTA — NOT WIRED IN
- Re-engagement email primary CTA: `/beaches/{slug}` (beach page, not one-tap)
- Secondary CTA: `/sessions/new?mode=log` (old multi-step form)
- `lib/utils/email-token.ts` supports `log_session` purpose but it's NOT used in the re-engagement email
- **Action needed:** Wire one-tap token into re-engagement email CTA (P1 priority)

### Apple Auth — FIXED (2026-03-14)
- Code is fully wired up (`lib/mobile/apple-sign-in.ts`, unified auth modal)
- Apple Developer credentials: Team ID `QBA8TA48NG`, Key ID `PY23BCF63G`, Services ID `app.quiversurf.mobile.web`
- **Root cause of "invalid_client":** Supabase had wrong `client_id` — was set to App ID (`QBA8TA48NG.app.quiversurf.mobile`) instead of Services ID (`app.quiversurf.mobile.web`). Secret was also a hex string, not a JWT.
- **Fix:** Used Supabase Management API (`PATCH /v1/projects/{ref}/config/auth`) to update both `external_apple_client_id` and `external_apple_secret`.
- **JWT expires:** 2026-09-13. Regenerate via `node scripts/generate-apple-secret.mjs /path/to/AuthKey_PY23BCF63G.p8`.
- **Note:** Google One Tap shows FedCM errors on localhost — this is expected, works in production.

### Welcome Emails — FIXED (2026-03-14)
- Were failing at 94% delivery rate due to SPF/DKIM/DMARC misconfiguration in Resend.
- User reports emails are now working after Resend dashboard configuration update.
