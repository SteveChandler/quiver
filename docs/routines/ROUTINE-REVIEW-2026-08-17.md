# Routine Review — 2026-08-17

Review of the four scheduled routines currently in rotation, what each one is
actually producing, and what changed today.

## Verdict in one line

Three of the four routines failed for the same reason: **they were placed where
they could not do their job.** The fourth worked, found five real product defects,
and left all five in a chat transcript where nothing acted on them.

---

## Cross-cutting finding: placement

| Capability | Cloud routine | Local scheduled task |
| --- | --- | --- |
| Read Supabase (`.env.local`) | no | yes |
| Outbound HTTPS to `quiversurf.app` | no (403) | yes |
| `git push` / GitHub write | no (403) | yes |
| Gmail connector | yes | yes |

**Rule:** a routine that needs the database, the live site, or a commit must be a
local scheduled task. A cloud routine can only do work that lives entirely inside
Gmail plus its own reasoning.

The backlink scan ran correctly and produced nothing because it could not fetch
`sitemap.xml`. The SEO outreach routine drafted eight good emails and then lost
its tracker update to a 403. Neither is a bug in the routine; both are a bug in
where the routine runs.

---

## 1. Weekly founder-feedback emails

`weekly-welcome-new-users` · local · Mondays 08:01 · **working**

Produced nine correct drafts. Then reported that four users had "no activity."

**That was false.** The script it depends on reads 4 event types. The database
has **98 distinct event types and 14,758 events in the last 7 days** — the
routine was seeing about 6% of the stream. Two of those "inactive" users had 3
and 5 events; one had none at all; and one of the four types it reads
(`beach_search`) did not fire even once this week.

### Changed today

- `scripts/list-new-users-week.ts` now reads the **whole** event stream and adds
  an `activity` block per user: event count, platform, first/last event, span,
  top events, and friction events. Version D now means the account was genuinely
  silent, not that it avoided four specific events.
- New `scripts/weekly-signup-intel.ts` writes a dated decision document to
  `docs/growth/signup-intel/YYYY-MM-DD.md` — cohort table, acquisition funnel,
  activation funnel, friction gates, and an action list where every line is
  either `[SEND EMAIL]` or `[APPLY FIX]`.

### Still to do

- **Sender address.** The Gmail connector's `create_draft` has no `from`
  parameter — drafts inherit the account's default send-as. To get
  `steven@quiversurf.app` on them, set it as default in Gmail Settings →
  Accounts and Import → Send mail as → make default. Then the routine's drafts
  come out right with no code change.

---

## 2. SEO outreach

cloud · weekly rotation by week-of-month · **working, output lost**

Drafted five coastal-business emails and three follow-ups. Correct targets,
correct rotation category, verified beach slugs. Then the tracker commit
(`88cfe03`) could not push — 403 from both git and the GitHub MCP — so
`docs/seo/outreach-tracker.md` still does not know those eight emails exist.
Next week's run will re-pick the same targets.

### Recommendation

Move it to a local scheduled task. Everything it needs (`seo:outreach-digest`,
the tracker file, Gmail) works locally, and the tracker edit becomes an ordinary
file write instead of a push.

The lost tracker also caused a **duplicate**. Cleanline Surf was already drafted
on 2026-08-05 using `cannon-beach-ecolaindian` — Quiver does have a Cannon Beach
slug, and it renders conditions (verified 2026-08-17). The 2026-08-17 run,
having no tracker row for the first draft, drafted Cleanline again with Short
Sands, 15 miles south. Both drafts are sitting in Gmail. The same thing happened
to the three surf-school follow-ups, which were drafted on 08-10 and again on
08-17.

Recovered into `docs/seo/outreach-tracker.md` on 2026-08-17 from the Gmail
drafts, which were the only surviving record.

---

## 3. Weekly backlink scan

cloud · weekly · **cannot work where it runs**

`seo:technical-audit` got a 403 fetching `quiversurf.app/sitemap.xml`, so the
broken-link checker had no URLs. `seo:backlink-proxy` returned empty referrer
lists because no Vercel/Ahrefs/GSC export was present. The report was written,
committed locally, and lost to the same 403. It is not in the repo — the last
backlink report is still `2026-06-15.md`.

### Recommendation

1. Move to local. The audit can then actually crawl the site.
2. It still needs data dropped in `Brand-Vault/seo-audit/YYYY-MM-DD/`:
   `VERCEL-EXPORT.json`, `AHREFS-WEBMASTER-TOOLS.csv`, `GSC-LINKS.csv`. Without
   at least one, the backlink half has nothing to report regardless of placement.
3. Until those exist, the honest version of this routine is the broken-link scan
   alone. Say that in the prompt rather than reporting empty backlink sections
   every week.

---

## 4. AEO citation audit

cloud · weekly · **hard-blocked every run**

The routine stops on a missing `docs/seo/AEO_CITATION_AUDIT.md`. That file has
never existed in git history.

There is a worse problem underneath it. The 2026-07-27 run reported **26.7%**
all-query citation. The 2026-08-17 run reported **83.3%**. Nothing changed by a
factor of three in three weeks; the method changed, and with no pinned runbook
there was nothing to detect that. The routine's blocker was, accidentally, the
only thing preventing an unusable number from being published as a trend.

### Changed today

- Wrote `docs/seo/AEO_CITATION_AUDIT.md`. It pins the search method, requires the
  report to list which queries surfaced (a bare percentage is not auditable),
  requires a Movement section against the prior run, and **treats a swing of more
  than 20 points with no declared method change as a defect in the run rather
  than a finding**.
- The report format now ends in an action list, same contract as the other
  routines.

---

### Moved 2026-08-17

All three cloud routines are now local scheduled tasks:

| Task | Schedule |
| --- | --- |
| `weekly-seo-outreach` | Mondays 09:10 |
| `weekly-backlink-scan` | Tuesdays 08:40 |
| `weekly-aeo-citation-audit` | Wednesdays 08:32 |

Verified locally before writing the prompts: `seo:technical-audit` crawls and
returns a real empty findings array (the cloud returned one "crawl blocked"
finding), `seo:outreach-digest` reads all 30 tracker rows, and
`quiversurf.app/sitemap.xml` resolves 307 → 200 on `www`.

Two gotchas are written into the prompts: `seo:technical-audit` silently ignores
`--audit-date`, and the Brand-Vault audit folder is named by **UTC** date, so
after ~17:00 Pacific it is tomorrow's.

**The cloud versions must be disabled**, or both copies run and draft duplicate
emails. That is exactly the failure already visible in Gmail this week.

## The pattern worth keeping

Every routine should end in a dated document whose last section is an action
list, and every line in that list should be either an email to send or a change
to make. Chat output does not survive the session; the five defects the outreach
routine found last week are proof.

Two rules the new gates encode, both learned this week:

1. **Report distribution, not counts.** 28 session-log validation failures looked
   like a population-wide problem. 21 of them are one `flow_id` hitting
   `wave_height_required` twenty times in a row — one person stuck in a loop. The
   fix for those two readings is completely different.
2. **Exclude benign reasons before gating.** `auth_failed` looked like a 47%
   failure rate. Seven of nine were `reason: cancelled` — users closing an OAuth
   sheet, which is not a defect. Excluding them drops it to 2 events and the gate
   correctly stops firing.

## What this week's data says

From `docs/growth/signup-intel/2026-08-17.md`:

- **1,294 signup CTA views produced 7 taps (0.5%).** This is the biggest number
  on the page and it is not a paywall or an activation problem.
- **2 of 11 new accounts produced zero events after signup.** Accounts created,
  never used.
- **127 `client_error` on `location/sync_snapshot`**, mostly HTTP 400 — a client
  sending a payload the API rejects, not flaky network.
- **50 × `map_no_beaches_in_viewport`** — the map's most common outcome this week
  was showing nothing.
