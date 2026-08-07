# Daylight-constraint audit — Quiver web (2026-07-29)

Context: quiver-native `src/lib/onboarding/find-best-window.ts` recommended 2-3 AM "best surf
windows" (hourly scorer had no daylight bound; calm night wind dominates). Native fix bounds
candidates to beach-local hours [6, 20). This audit swept web surfaces that compute or present
"best window / best time" recommendations. Companion Seaside findings:
`../seaside/.planning/2026-07-29-daylight-constraint-audit-findings.md`.

## Fixed (branch `fix/daylight-window-audit-20260729`, worktree `.worktrees/daylight-window-audit-20260729`)

| # | Surface | File | Flaw | Fix |
|---|---------|------|------|-----|
| 1 | Condition alerts (CRITICAL, live) | `lib/alerts/sunrise.ts:13-25` | `filterToDaylight` computed sunrise/sunset from `forecasts[0]` only; SunCalc solar-day rollback → **0 rows kept for America/Chicago beaches year-round**, so TX Gulf users' alert rules were never evaluated (silent, no metric) | Per-row daylight window; unit tests incl. Galveston + multi-day |
| 2 | Weekly recap "Best days" (latent) | `lib/alerts/best-days.ts:94-121` | Scores all hourly rows over 7 days, no hour bound; would email "Tuesday 3am" the moment `weekly-recap-email/route.ts:309` stops hardcoding `bestDays: []` | Beach-local [6,20) filter before the match-score RPC + night regression test |
| 3 | Beach detail "Best Window" card | `lib/scoring/window-calculator.ts` (`calculateMultipleWindows`, `calculateOptimalWindow`) | Scores every row, no hour bound, no tz; drives `best-surf-window.tsx` + board pick via `use-condition-intelligence.ts:88` | `beachTimezone` option + [6,20) filter; empty ⇒ no window (never night fallback) |
| 4 | Card fallback "Most Favorable Window" | `lib/scorers/session-window-scorer.ts` (`findNextBestWindow`) | No lower hour bound; time bonus used `getUTCHours()` so `MORNING_BONUS` rewarded 23:00-02:00 PDT; caller stripped `forecast_at` | Local-hour [6,20) filter, beach-local bonus hour, `forecast_at` threaded from `best-surf-window.tsx` |
| 5 | Outlook days 2-12 "Best time" labels | `lib/utils/horizon-strip-utils.ts` (`findBestForecast`) + `lib/scoring/native-condition-score.ts` (`pickBestNativeForecastSlot`) + `lib/utils/enriched-day-summary.ts` (`deriveTimeSlot`) | Max-score slot over all 24h for days 2-12 (today is guarded by `resolveTodayHeadline`); slot bucketing parsed the **UTC** `forecast_time` text and was unbounded — 23:00 PDT labeled "Dawn Patrol", real 6 AM labeled "Afternoon" | Optional `beachTz` filter in the picker (fallback to unfiltered for ranking-only use); beach-local hour + [6,20] clamp in slot derivation |
| 6 | Magic Hour night-bleed | `lib/services/magic-hour/magic-hour-finder.ts:93` | Correct 6-20 filter, but fell back to unfiltered (night) slots when no daylight slots in the slice | Return null result instead of night fallback |

## Verified safe (no change)

- **Onboarding payoff "Your Best Window"** (`components/onboarding/steps/payoff-step.tsx:410-457`) —
  read-only consumer of `beach_daily_intel.best_window_start/end`; producer is double-bounded
  (04:00-13:00 beach-local query + hour 6-10 reject in `session-window-scorer.ts:440-453`).
- **Discovery window selector** (`window-selector-core.ts:170-226, 968-974, 1041`) — beach-local
  6-20 (6-17 without sun data) plus civil-twilight/sunset checks at entry, exit, and post-refinement;
  fallback path reduces only over daylight rows. `mode=now` bypass is intentional and documented.
- **Discovery TimeSlot buckets** (`types/personalization.ts:39-45`) — 6-21 ranges; note daylight for
  `'any'` is enforced by the explicit hour check, not the bucket (bucket is skipped for `'any'`).
- **Similarity alerts / swell watch** — hard 6-19 beach-local + 22-06 reject (`similarity-alerts`
  route, `similarity-best-pick.ts`, `swell-watch-detector.ts`).
- **First-session nudge** — double-guarded (producer hour 6-10; email formatter rejects <5 / ≥21).
- **Week scout, home morning call, beginner window, topMorningWindows, /best-time-to-surf SEO** — bounded.

## Filed, not fixed (candidates for follow-up)

1. **Condition-alert dusk cap** — `window-finder.ts` keeps rows through sunset inclusive; calm
   glass-off slot can win → "Good Around 8:00 PM" pushes with no upper send-time clamp. Sibling
   similarity path was deliberately tightened to 6-19. Fixing changes alert semantics (evening
   sessions are legitimate) — product call needed. (`lib/alerts/window-finder.ts:57-104`,
   `condition-alert-evaluate/route.ts:298-325`.)
2. **`alert_date` timezone mismatch** — evaluate cron derives `userLocalDate` from the *home* beach tz
   but day bounds from the *rule* beach tz (`condition-alert-evaluate/route.ts:140-141,184`); cross-tz
   rules can evaluate the wrong local day and dedupe on a different clock.
3. **`getUtcDayBounds` fragile offset math** (`lib/alerts/timezone-utils.ts:11-21`) — mis-signs at
   UTC±12, no half-hour zones. Harmless for current beaches.
4. **`WindowCalculatorOptions.horizonHours` is a silent no-op** — declared but never read;
   `scripts/morningIntel.ts:456` passes it believing it bounds hours (manual CLI, not the production
   intel path). Implement or delete the option.
5. **`forecast-digest-service.ts`** — dead code (test-only importer); server-local `getHours()` in
   copy generation (lines 477, 489, 515). Revive-with-tz or delete.
6. **Week scout** — `evening` bucket has no ceiling (`endHour: null` → hours 21-23 included) and
   bucketing uses request tz while the daylight gate uses beach tz; protected transitively by the
   window selector today. (`week-scout.ts:190-222,634-637`.)
7. **`lib/alerts/sunrise.ts` boundary semantics** — even fixed, `t >= sunrise && t <= sunset` is
   instant-based; consider aligning to the [6,20) clock convention used everywhere else.
8. **`lib/surf/windows.ts`** — dead code with a string-typed `localHour` cast (`as unknown as number`)
   and incompatible internal signatures; delete.
9. **Seeded default alert presets** (`mellow_session`, `clean_groundswell`) set no
   `local_time_start/end`, relying entirely on `filterToDaylight` for their time bound
   (`lib/alerts/presets.ts`, `seed-default-rule.ts:59-65`).
10. **Orphaned email templates** with best-window props and no producer:
    `ConditionsAlertEmail.tsx`, `SwellWatchEmail.tsx`.
