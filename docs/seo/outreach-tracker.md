# SEO Outreach Tracker

Last updated: 2026-03-30

## How This File Works

This tracker is read and updated by the weekly "SEO Outreach Drafter" scheduled agent. It:
1. Reads targets below to avoid duplicate outreach
2. Researches new targets via web search
3. Drafts personalized emails as Gmail drafts
4. Updates this file with new entries and status changes

Steven reviews Gmail drafts and sends. Status updates happen here.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `queued` | Identified, not yet contacted |
| `drafted` | Gmail draft created, awaiting review |
| `sent` | Email sent |
| `follow-up` | Follow-up email sent |
| `responded` | Target responded |
| `embed-live` | Widget embed confirmed live |
| `declined` | Target declined or no response after follow-up |
| `backlink-confirmed` | Referring domain confirmed in Ahrefs |

---

## Surf School Targets (Playbook Section 1.3)

> **Verified live 2026-08-04, data re-checked 2026-08-05.** Every row was checked: DNS, homepage
> status, real contact channel, and an embed slug confirmed to return HTTP 200 **and to render actual
> conditions**. Three rows were dead or misidentified (see Rejected); two more are blocked on missing
> forecast data. **Do not draft to a row whose contact channel or beach slug is blank or BLOCKED.**
>
> **HTTP 200 is not sufficient.** `/embed/conditions/<slug>` returns 200 even when the widget renders
> "No conditions available". Grep the response body for that string, not just the status code.
>
> **CORRECTION 2026-08-05:** an earlier revision of this note listed
> `south-padre-island-isla-blanca-park-south-padre-island-tx`, `deerfield-beach-pier-deerfield-beach-fl`
> and `12th-street-jetty-sea-isle-city-nj` as "dataless". **That was wrong.** All three have data; they
> were merely **stale**, and the widget blanked instead of showing it — the bug in
> `quiver/.planning/embed-freshness-fix-and-refactor-20260805.md`. Verified on the fix branch:
> `deerfield-beach-pier` is blank on prod yet renders conditions plus "as of Wed, Aug 5 at 10:30 AM"
> once the widget stops discarding stale rows. **No target is blocked on missing beach data.** A blank
> widget is a symptom of the freshness bug, not evidence of absent data — do not classify a beach from
> the rendered output until that fix ships.

### California
| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |
|--------|---------|---------------------------|----------------------------|--------|------|-------|
| Surf Diva | surfdiva.com | `la-jolla-shores` | askadiva@surfdiva.com | sent | 2026-08-03 | |
| Pacific Surf School | pacificsurfschool.com | `pacific-beach` | pacificsurf@pacificsurf.org | sent | 2026-08-03 | |
| Corky Carroll's Surf School | corkysurfschool.com | `huntington-beach-pier` | info@surfschool.net | sent | 2026-08-03 | |
| Santa Cruz Surf School | santacruzsurfschool.com | `steamer-lane-santa-cruz-ca` | **needs manual check** — site 200, no email/phone in raw HTML (JS-rendered) | queued | | |
| Nor Cal Surf Shop | norcalsurfshop.com | `linda-mar-pacifica-ca` | mia@norcalsurfshop.com | queued | | Contact form also present |

### Hawaii
| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |
|--------|---------|---------------------------|----------------------------|--------|------|-------|
| Hans Hedemann Surf School | hhsurf.com | `waikiki-beach` | info@hhsurf.com | queued | | **Runs own YouTube cam `c5vgnhcxgYU`** — lead with the cam partnership, not the widget |
| North Shore Surf Girls | northshoresurfgirls.com | `haleiwa` | 808-637-2977 (contact form; no email published) | queued | | |
| Hawaiian Surfing Adventures | hawaiiansurfingadventures.com | `hanalei-bay-kauai` | 808-482-0749 (no email published) | queued | | |

### East Coast
| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |
|--------|---------|---------------------------|----------------------------|--------|------|-------|
| Island Water Sports | islandwatersports.com | `deerfield-beach-pier-deerfield-beach-fl` | contact form + 954-427-4929 | queued | | **Was wrongly listed as OBX.** Actually Deerfield Beach FL, 4 South FL stores, since 1978. Previously marked blocked for "no data" — that was wrong; the beach has data and blanked only because of the stale-widget bug. Unblocked once that fix ships |
| Ron Jon Surf School | ronjonsurfschool.com | `cocoa-beach-pier-cocoa-beach-fl` | rjss1993@gmail.com | queued | | **Runs own YouTube cam `MNFZ08D5L40`** — lead with the cam partnership |
| Cocoa Beach Surf School | cocoabeachsurfingschool.com | `cocoa-beach-pier-cocoa-beach-fl` | **HTTP only** — `http://www.cocoabeachsurfingschool.com/`; HTTPS fails | queued | | Verify contact manually |

### Rejected — do not draft (verified dead or out of scope 2026-08-04)
| Target | Website | Reason |
|--------|---------|--------|
| Zuma Jay Surfboards | zmjay.com | **NXDOMAIN** — domain does not resolve. Was listed as a ready draft candidate in the 2026-08-03 weekly report |
| Breakers Surf School | breakerssurfschool.com | **NXDOMAIN** — domain does not resolve |
| Big Island Surf Company | bigislandsurfco.com | **Australian company** ("Big Island Surf Co Australia"), contact@bigislandsurfco.com.au. Outside Quiver's US/HI/Baja coverage |

**Verification procedure — run before drafting to any new row:**

1. `host <domain>` — reject on NXDOMAIN.
2. `curl -sIL --max-time 15 -A "Mozilla/5.0" -o /dev/null -w "%{http_code} %{url_effective}" https://<domain>/` — note HTTP-only sites.
3. Find the real contact channel on the live page. **Do not assume a `/contact` path exists** — two of
   the three form-based targets in the 2026-07 batch had no such page.
4. Confirm the business's actual location from its own site, not from this tracker.
5. `curl -sL -o /dev/null -w "%{http_code}" https://www.quiversurf.app/embed/conditions/<slug>` —
   require `200`. A wrong slug returns a clean 404, so this check is meaningful.
6. Check for an existing cam (`youtube.com/embed/` or `youtu.be/` in the page source). If they have
   one, lead with the cam partnership instead of the widget.

---

## Surf Bloggers & Micro-Influencers

| Target | Website/Channel | Nearest Beach | Status | Date | Notes |
|--------|----------------|---------------|--------|------|-------|
| Ben Gravy | YouTube 520K | East Coast | queued | | Great for EC coverage angle |
| Kale Brock | YouTube 157K | lifestyle | drafted | 2026-07-14 | Widget for his site |
| Surf Simply | surfsimply.com | education | drafted | 2026-07-14 | Align with /learn content |
| Barefoot Surf | YouTube | education | queued | | Beginner intent alignment |

---

## Coastal Businesses (Hotels, Tourism, Shops)

| Target | Website | Nearest Beach | Status | Date | Notes |
|--------|---------|---------------|--------|------|-------|
| | | | | | Agent will populate via web search |

---

## Directory Submissions (Playbook Section 1.1)

### Priority A
| Directory | URL | Status | Date | Notes |
|-----------|-----|--------|------|-------|
| Wannasurf | wannasurf.com | queued | | Community surf directory |
| Surf-Forecast.com | surf-forecast.com | queued | | Links to related tools |
| BeachReviews.org | beachreviews.org | queued | | Beach info directories |
| Surfer Today | surfertoday.com/resources | queued | | Surf education resources |
| SurfingMagazine.com | surfingmagazine.com | queued | | Contact about tools page |

### Priority B
| Directory | URL | Status | Date | Notes |
|-----------|-----|--------|------|-------|
| OutdoorProject | outdoorproject.com | queued | | Water sports section |
| Recreation.gov | recreation.gov | queued | | Coastal recreation tools |
| American Canoe Association | americancanoe.org | queued | | Marine conditions tools |
| US Sailing | ussailing.org/resources | queued | | Weather/conditions tools |
| NOAA CoastWatch | coastwatch.noaa.gov | queued | | Academic credibility signal |

---

## Publication Pitches (Playbook Sections 2.1-2.2)

| Publication | DA | Contact | Angle | Status | Date |
|-------------|----|---------|---------| --------|------|
| The Inertia | 65 | editorial form | Transparency + ML angle | drafted | 2026-07-27 |
| Adventure Journal | 45 | editor about page | Surf data story | queued | |
| Outside Online | 90 | contributor portal | Outdoor sports + data | drafted | 2026-07-27 |
| Weatherwise | 50 | editor contact | Wave forecast methodology | queued | |
| REI Co-op Journal | 80 | content editor | Water sports safety | queued | |

---

## HARO/Qwoted Platforms

| Platform | URL | Account Status | Notes |
|----------|-----|---------------|-------|
| Qwoted | qwoted.com | not registered | Journalists seeking expert quotes |
| Featured.com | featured.com | not registered | Expert roundups, links back |
| Help a B2B Writer | helpab2bwriter.com | not registered | Content creators |
| SourceBottle | sourcebottle.com | not registered | AU and US media requests |
| ProfNet | profnet.com | not registered | Larger media outlets |

---

## Weekly Rotation Schedule

The SEO Outreach Drafter agent follows this rotation:
- **Week 1** (of each month): Surf schools
- **Week 2**: Surf bloggers and micro-influencers
- **Week 3**: Coastal businesses (hotels, tourism boards, shops)
- **Week 4**: Guest post / data story pitches to publications
- **Week 5+**: Cycle back with new targets found via web search

---

## Monthly Metrics

| Month | Outreach Sent | Responses | Embeds Live | New Referring Domains |
|-------|--------------|-----------|-------------|----------------------|
| April 2026 | | | | |
| May 2026 | | | | |
| June 2026 | | | | |
