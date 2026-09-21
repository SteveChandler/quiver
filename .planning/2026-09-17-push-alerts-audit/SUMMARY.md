# Push alerts audit — synthesis (2026-09-17)

Two Codex packets (gpt-5.6-sol, high reasoning) audited `origin/main` of quiver plus the native client, read-only, against production rows pulled from quiverDB. Claude verified the load-bearing claims against prod and the code afterwards. Full detail: `REPORT_A.md` (root cause of the two pushes, similarity engine, manual rules), `REPORT_B.md` (every push producer, coordination, copy, delivery health, native client, product ranking), `EVIDENCE.md` (raw prod data).

## Why you got "Go Osprey Point" and "Go PB Point"

Both came from the auto-created similarity rule "Similar to your best at Scripps". Tide was not the trigger. Verified chain:

1. **The personal profile behind both pushes is one session.** The SQL match function builds the "profile peak" from rating-4/5 sessions in the last 12 months that have a forecast snapshot *and* a break type compatible with the candidate beach. For the point-break candidates that left exactly one row: Terramar Point, 2026-07-31, rating 4, 2.8 ft @ 13s. That is the "profile peak 2.8 ft". Every 2–3 ft day at any point break in the radius now scores GOOD/EPIC against it. (Verified by running the query against prod.)
2. **The cron then reports `sessionCount: 0` and confidence "high".** The TypeScript hard-codes zero (`app/api/cron/similarity-alerts/route.ts:1111`) and the SQL's confidence is computed from the *global* rated-session count, not the one-row sample that formed the peak. Nothing gates on either.
3. **A GOOD/EPIC personal label forces verdict `go`** regardless of the physical score (`lib/recommendations/canonical-decision/engine.ts:139`). PB Point's physical score was 65 ("Maybe"); the n=1 personal match overrode it to "Go".
4. **The rule is not scoped to Scripps.** It searches every recommendation-eligible beach within ~30 miles of your last device location and picks the single best hour in the next 72h. Scripps is only provenance. The name shown in the app is a false contract.
5. **The push hides the reason.** The registry keeps only two context details (wind, tide) and drops the "profile peak" reason, so the lock screen reads like an objective call.
6. **Timing.** Send is fixed at 60 minutes before the window. Osprey was picked Tuesday's scan for Wednesday 8am; PB Point was picked Wednesday 6am for 11am. Overlapping 72h scans plus a beach-keyed dedupe let both land on the same day.
7. **No cross-rule cap.** Similarity deliberately bypasses the 24h cooldown and 10/week user cap that manual rules use. Same-beach arbitration exists; cross-beach does not. Hence Blacks 6:06, Osprey 7:05, PB Point 10:05.

Also confirmed: migration `20260811183000_fix_match_score_core_board_aliases` **is applied** in prod despite its "NOT YET APPLIED" header (Packet A open question 4 resolved).

## Why your other rules never fire

Seven of nine enabled manual rules have never matched. The evaluator compares `swell_period_min` against `swell_1_period` (primary swell) not the dominant `wave_period` the app displays, and every clause is an exact AND. Your Scripps rule needs a 16s primary swell; Del Mar and Pacific Beach need 14s; the three OB Pier rules need exactly-classified offshore wind at ≤5–10kt. The form gives no feasibility feedback and accepts these combinations silently.

## System-wide (30 days)

- **At least 49 users had matching rules silently skipped by a production allowlist** (312 email + 143 push `skipped_allowlist`). They set up alerts and got nothing.
- `skipped_stale_forecast` is the top outcome for mellow_session (176 email, 105 push). It means "no longer matches at delivery time", not data age. The name is misleading and the volume suggests evaluator/deliverer disagreement.
- Similarity push reached 3 users in 30 days. You are one of them.
- Swell watch and daily digest are dead delivery surfaces. Home morning call, weekend window, and swell watch are all default-off flags whose prod values cannot be read from the repo.
- The native app never sends `installation_id`, so registration uses the legacy RPC and accumulates device rows (you have 11, 3 active). A single event is marked `sent` if any one target succeeds.

## What a useful alert should be (Packet B's framing, endorsed)

One scarce, action-changing message per morning: unusual conditions relative to *demonstrated* behaviour, early enough to plan, explicit about why and how confident, linked to the evidence. A normal 2 ft day clearing a numeric threshold is not that.

## Ranked fixes (merged from both packets)

| # | Change | Effort |
|---|---|---|
| 1 | **Gate similarity on real evidence.** Return the break-compatible contributing-session count from SQL, carry it into `personalMatch.sessionCount`, and require a minimum (e.g. ≥5) before any push. Below that, no push or inbox-only "possible match". Stop hard-coding 0. | S |
| 2 | **Never let a personal label override a physical "Maybe" into "Go".** Imperative copy only when physical verdict is also go; otherwise "Matches your best" / "Worth a look". | S |
| 3 | **One surf push per user per morning.** User-level budget across similarity, manual, home call, watched-call; bundle losers into the destination screen; safety transitions exempt. Reverse the similarity throttle bypass. | M |
| 4 | **Fix the similarity rule's contract.** Either scope it to the configured beach or rename it "Best match near you" and stop showing it under Scripps in Alert Center. | S |
| 5 | **Show the reason in the push and carry it through the tap.** Keep the "why", confidence/sample, and window; harmonise Go / Worth a look / It's firing to one rubric. | S–M |
| 6 | **Manual rules: compare period to the displayed wave train** (or relabel the field), and add "would have matched N times in 30 days" feedback plus rare-combination warnings in the form. | M |
| 7 | **End silent allowlist gating** or label excluded users; add a matched-but-withheld metric. | S |
| 8 | **Lead time.** Send plan-worthy windows the evening before or early morning; fix the selector that stays eligible 15 min after the best hour. | M |
| 9 | **Observability.** Split `skipped_disabled` into causes, rename `skipped_stale_forecast`, store `best_score` for similarity rows, write campaign logs from terminal outcomes not enqueue. | S–M |
| 10 | **Native installation identity** so device rows stop multiplying and partial failures are visible. | M |

Items 1, 2, 4 together remove the specific pushes you complained about and are each small, testable changes.
