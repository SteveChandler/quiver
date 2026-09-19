# SEO Outreach Tracker

Last updated: 2026-09-14 (09:20 PT weekly run: Gmail reconciliation + 3 follow-up drafts; see the 2026-09-14 run log)

## How This File Works

This tracker is read and updated by the weekly "SEO Outreach Drafter" scheduled agent. It:
1. Reads targets below to avoid duplicate outreach
2. Researches new targets via web search
3. Drafts personalized emails as Gmail drafts
4. Updates this file with new entries and status changes

Steven reviews Gmail drafts and sends. Status updates happen here.

**No-email guard (2026-08-24):** `buildOutreachDigest` (`lib/seo/agent-workflow/outreach-digest.ts`)
emits every queued row in the current rotation, marking rows without an `@` address in `Contact` as
requiring contact research. The live drafter must find and verify a direct email before creating a
Gmail draft; it must never draft to a phone number, contact form, or blank address. This currently includes:
North Shore Surf Girls, Hawaiian Surfing Adventures, and Island Water Sports (phone/form only),
Cocoa Beach Surf School (no email on its HTTP-only site), and the Santa Cruz "needs manual check" row.
Those rows stay `queued` until a Gmail draft exists; a verified email from research (or a different
outreach channel, e.g. a DM) is required before drafting.

**Gmail-vs-tracker reconciliation (2026-08-24):** the tracker had drifted badly. Gmail is the
surviving record and was trusted over this file wherever they disagreed. Corrections applied this run:

- The five "drafted 2026-08-17" coastal-business rows were **sent on 2026-08-18**, including the
  Cleanline **Short Sands** draft the previous note said to delete. Deleting it is no longer possible.
- The surf-school follow-ups were **sent on 2026-08-18**, not left as duplicate drafts.
- A batch of outreach on **2026-08-20** (HSS Surf sent; Whalebone, Skudin, Cape Hatteras, Padre Island,
  Safari Town, Cannon Beach Surf Lessons, Cleanline, Kale Brock, Barefoot Surf drafted) had **no rows
  at all** here. They are recorded below.
- Three targets that had already replied — Stab Magazine, Surf Simply, Hawaii Public Radio — were
  recorded as `queued`/`drafted`/absent. See **Warm leads** below; two of them went unanswered for
  weeks.

**Gmail-vs-tracker reconciliation (2026-08-31):** Gmail was diffed against this file again.
Two findings, both of which stop this week's run:

1. **The August sent count was stale again — 15 recorded, 34 actual.** Two separate omissions: the
   whole 2026-08-25 batch (15 sends) post-dated the 08-24 recount, and an entire **2026-08-03 batch
   of 7** had never been counted at all. Four of those seven targets have no row anywhere in this
   file. Recounted from Gmail below.
2. **An unsent-draft backlog of 15 outreach drafts.** Drafts from 08-20, 08-25 and 08-31 are all
   still sitting unsent. Per the routine's Step 4 that is a hard stop: adding more is how a batch
   goes out at once and lands as spam. **No new drafts were created this run.**

**Two drafts created 2026-08-31 05:08 PT carry defective copy and must not be sent as written**
(Hans Hedemann Surf School, Nor Cal Surf Shop). The fault is in the template, not the drafts:

- **A false claim.** `lib/seo/agent-workflow/outreach-digest.ts:186` writes *"ML-tuned forecasts"*.
  Quiver ships **no live ML forecast** — ML corrections have been off since 2026-04-23 because raw
  Open-Meteo beat them by 35% MAE. This is the same class of unsupportable accuracy claim that got
  `/forecast-accuracy` pulled from outreach. It must not go out over Steven's name.
- **A placeholder leak, and the root cause is worse than the symptom.** The template falls back to
  `"your local breaks"` when a row has no `nearestBeach`, then interpolates it as
  `for your ${where} crew` — producing **"Free ML surf forecasts for your your local breaks crew"**.
  But `nearestBeach` was *never* populated for any row: `buildRow` looked up the exact normalized
  header `nearestbeach`, and no table in this file uses that. The real headers are
  **"Beach slug (verified 200)"** (`beachslugverified200`) and **"Nearest Beach (verified 200)"**
  (`nearestbeachverified200`). So every draft in every rotation category, going back to the
  generator's introduction, shipped the placeholder — the beach was always right there in the row
  and was never read.
- **The unit test could not have caught it.** `outreach-digest.test.ts` builds its fixture with a
  header literally named `Nearest Beach`, which normalizes cleanly and matches. The test asserted
  the beach flowed into the subject and passed, while production silently produced the placeholder
  for 100% of rows. The fixture, not the code, was doing the work.
- **Wrong audience.** Both drafts say *"set your school up"* and *"your students"*. Nor Cal Surf Shop
  is a shop, not a school. The Hans Hedemann row also carries a standing instruction to lead with the
  cam partnership, which the template ignores.

**The template was repaired in the working tree at 10:25 PT on 2026-08-31, after those two drafts were
generated at 05:08.** `outreach-digest.ts` now adds a `humanizeBeach()` helper that turns the slug
`steamer-lane-santa-cruz-ca` into "Steamer Lane Santa Cruz", drops the ML claims from both the
surf-schools and surf-bloggers templates, drops the "5,000+ US spots" count, and adds an explicit
"a one-line no is completely fine" out. A carried comment now records why no template may claim ML,
AI, a spot count, or superiority over a named competitor.

`buildRow` now resolves the beach column by header **prefix** (`nearestbeach`, `beachslug`) instead
of exact match, so the live tracker's real headers are read.

Two regression tests were added to `__tests__/lib/seo/agent-workflow/outreach-digest.test.ts`, both
verified to **fail against the pre-fix code and pass after** — the fixture-shaped test did neither:

1. A fixture using the live headers verbatim, asserting the beach is read and the subject is
   `Free surf forecasts for Waikiki Beach` with no doubled `your`.
2. A sweep over all four rotation categories asserting no subject or body matches
   `/\bML\b|machine.learning|\bAI\b/`.

`npx jest __tests__/lib/seo/agent-workflow/outreach-digest.test.ts` → 20 passed. `tsc --noEmit`
reports nothing for this file. **The fix is uncommitted**; it sits in the working tree alongside
this file. Note `yarn` refuses to run under the default Node 14 — prepend a v22 bin dir.

**Both 08-31 drafts were rewritten in place at 10:2x PT**, rather than deleted or re-drafted
alongside — stacking a second draft on an unsent one is exactly how Cleanline ended up with three
emails naming three beaches in fifteen days. The rewrites drop every ML claim and the invented spot
count, name a real verified beach page, and give an explicit one-line-no out:

| Draft | New subject | Beach page (200 this run) |
|---|---|---|
| Hans Hedemann Surf School | Free Waikiki Beach conditions page, and a thought about your cam | `https://www.quiversurf.app/hi/honolulu/waikiki-beach` |
| Nor Cal Surf Shop | Free Linda Mar conditions page, if it's useful to you | `https://www.quiversurf.app/ca/pacifica/linda-mar-pacifica-ca` |

Hans Hedemann now leads with the cam partnership, per the standing note on that row. Nor Cal is
addressed as a shop, not a school, and its draft no longer mentions students. Neither is sent.

**Email copy (2026-08-10, corrected 2026-08-24):** the surf-schools template no longer references an
iframe embed. It links to `https://www.quiversurf.app/for-surf-schools` in the body.

**The "plain unlinked URL avoids the redirect" claim was wrong.** That was the stated reason for the
2026-08-10 change and it does not hold. Gmail autolinks bare URLs at compose time and rewrites them to
`https://www.google.com/url?q=...&source=gmail&ust=...&sa=E` regardless of whether the draft body
contains an `<a>` tag. Verified 2026-08-24 by reading the stored bodies of drafts created through the
Gmail API with plain-text URLs — every one came back wrapped. The same wrapping is visible in the
sent June, July, and August messages.

What this actually costs:

- The recipient sees a `google.com/url?q=...` hover target instead of `quiversurf.app`. Mildly worse
  for trust, and it looks like tracking.
- The click still lands on the right page, so **no link is broken** and no draft needs rewriting.
- For SEO it is irrelevant either way: these are email clicks, not crawlable links. A backlink only
  exists once the target puts the URL on their own site.

**Nine URL forms were tested on 2026-08-24** — two throwaway drafts, read back from the API. All nine
were rewritten. There is no form that survives:

| Form written | What Gmail stored |
|---|---|
| `https://www.quiversurf.app/x` (plain text) | wrapped, scheme preserved (`q=https://`) |
| `www.quiversurf.app/x` | wrapped **and downgraded** to `q=http://` |
| `quiversurf.app/x` | wrapped **and downgraded** to `q=http://` |
| scheme and path split by a space | host wrapped, **path orphaned** — link broken |
| `<a href="https://...">https://...</a>` | **href rewritten**, visible text left clean |
| `<a href="https://...">custom text</a>` | **href rewritten** |
| bare URL inside `htmlBody`, no anchor | Gmail *added* an anchor, href rewritten |
| URL in `&lt;angle brackets&gt;` | anchor added, href rewritten |
| URL inside `<code>` | anchor added, href rewritten |

Two conclusions that matter:

1. **Dropping the scheme is worse, not better** — it hands the recipient an `http://` destination.
   Always write the full `https://` form.
2. **The visible text is preserved.** Only the `href` is wrapped. A recipient reading the email sees
   `https://www.quiversurf.app/...`; the redirect appears on hover and on click. So write the clean
   URL as the visible text rather than hiding it behind link text like "click here".

**Correction 2026-09-14: the visible text is NOT preserved when a draft is created from a plain-text
`body`.** The connector's `create_draft` writes the wrapper into the readable link itself, and it goes
out that way. The raw MIME of the 2026-09-08 OBX follow-up and of the 2026-09-14 Whatever Sportfishing
and NJ Sea Grant follow-ups all carry `https://www.google.com/url?q=...&source=gmail...` as the visible
link, in both the text and HTML parts. Recipients saw it.

- Passing an `htmlBody` with an explicit anchor,
  `<a href="https://www.quiversurf.app/...">https://www.quiversurf.app/...</a>`, keeps the **visible
  text clean**. Verified by reading the raw MIME back. The href underneath is still wrapped.
- The only fully clean mail found: the 2026-08-31 sends went out as `text/plain` only, with no HTML part
  and no wrapper anywhere. Gmail's compose **Plain text mode** should give the same result on send. Not
  yet verified.
- **Rule: any draft containing a URL must be created with `htmlBody` and explicit anchors.** A plain
  `body` alone is how the wrapped links above reached recipients.

**This is Gmail's own link wrapper, not Quiver tracking.** `source=gmail&ust=<timestamp>&sa=E` is
applied to outbound links for every Gmail user. It persists into sent mail — visible in the June, July
and August sends already in this account. It cannot be suppressed through the API.

What *is* under our control is the URL itself: **never append `utm_*`, `?ref=`, or any campaign
parameter to an outreach URL.** A bare path is what should be pasted, so that if a target ever copies
it onto their own site the backlink is clean. Every URL in the 2026-08-24 drafts is bare.

**Do not re-litigate this per-run.** Nine forms have been tested and none works. Every click still
lands correctly, and there is no SEO effect — a backlink only exists once a target publishes the URL
on their own site, at which point the wrapper is out of the picture entirely. This is written down so
the next run does not spend itself "fixing" it again.

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
| `declined` | Target explicitly declined. Silence after the one follow-up is **not** `declined`: the row keeps its sent status with the note "follow-up exhausted; no response" (routine rule, applied from 2026-09-14) |
| `rejected` | Investigated and ruled out for cause (dead domain, hard-bounced address, no email, unverifiable). Never offered as a candidate. Rows in any "Rejected" table are treated as `rejected` automatically. |
| `backlink-confirmed` | Referring domain confirmed in Ahrefs |

**Put only one of these exact values in a Status cell.** `buildRow` in
`lib/seo/agent-workflow/outreach-digest.ts` maps anything else to `queued`, including a date appended
to a real status (`sent 2026-08-31`) or a phrase like `follow-up drafted`. Dates and follow-up notes
belong in the Date or Notes column. Found 2026-09-14, when six contacted rows were parsing as queued.

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
| Surf Diva | surfdiva.com | `la-jolla-shores` | askadiva@surfdiva.com | follow-up | 2026-08-25 | **Four emails, not three** (Gmail recount 2026-09-14): a 2026-07-08 send ("Free ML surf forecasts for your La Jolla crew") predates the 08-03 initial, then follow-ups on 08-18 and 08-25. **Follow-up exhausted; no response** as of 2026-09-14. Do not contact again. |
| Pacific Surf School | pacificsurfschool.com | `pacific-beach` | pacificsurf@pacificsurf.org | follow-up | 2026-08-25 | Initial 2026-08-03, follow-ups 2026-08-18 and 2026-08-25 (three emails, one over the limit). **Follow-up exhausted; no response** as of 2026-09-14. Do not contact again. |
| Corky Carroll's Surf School | corkysurfschool.com | `huntington-beach-pier` | info@surfschool.net | follow-up | 2026-08-25 | Initial 2026-08-03, follow-ups 2026-08-18 and 2026-08-25 (three emails, one over the limit). **Follow-up exhausted; no response** as of 2026-09-14. Do not contact again. |
| Santa Cruz Surf School | santacruzsurfschool.com | `steamer-lane-santa-cruz-ca` | **needs manual check** — site 200, no email/phone in raw HTML (JS-rendered) | queued | | |
| Nor Cal Surf Shop | norcalsurfshop.com | `linda-mar-pacifica-ca` | mia@norcalsurfshop.com | sent | 2026-08-31 | **Sent 2026-08-31 10:50 PT** (row was left at `drafted`; corrected 2026-09-07 09:00 run). Contact form also present. Draft **rewritten in place 2026-08-31 10:2x PT** — the original carried the false "ML-tuned forecasts" claim, the doubled-`your` subject, and school/student wording aimed at a shop. Pitched the verified Linda Mar page as a shop, not a school. Sent as rewritten; no ML claim went out. Follow-up eligible 2026-09-14. **Not drafted on 09-14:** the three-draft cap went to the UML, Whatever Sportfishing and NJ Sea Grant follow-ups, each of which had a verified, still-broken target page to fix. No reply through 09-14. First in line next run. |

### Hawaii
| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |
|--------|---------|---------------------------|----------------------------|--------|------|-------|
| Hans Hedemann Surf School | hhsurf.com | `waikiki-beach` | info@hhsurf.com | sent | 2026-09-07 | **Sent 2026-09-07 06:35 PT** (row was left at `drafted 2026-08-31`; corrected in the 09:00 run). Follow-up eligible 2026-09-21. **Runs own YouTube cam `c5vgnhcxgYU`** — lead with the cam partnership, not the widget. Draft **rewritten in place 2026-08-31 10:2x PT** — the original carried the false "ML-tuned forecasts" claim, the doubled-`your` subject, and ignored the cam angle. It leads with the cam offer and links the verified Waikiki Beach page. Sent as rewritten; no ML claim went out. |
| North Shore Surf Girls | northshoresurfgirls.com | `haleiwa` | 808-637-2977 (contact form; no email published) | queued | | |
| Hawaiian Surfing Adventures | hawaiiansurfingadventures.com | `hanalei-bay-kauai` | 808-482-0749 (no email published) | queued | | |

### East Coast
| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |
|--------|---------|---------------------------|----------------------------|--------|------|-------|
| Island Water Sports | islandwatersports.com | `deerfield-beach-pier-deerfield-beach-fl` | contact form + 954-427-4929 | queued | | **Was wrongly listed as OBX.** Actually Deerfield Beach FL, 4 South FL stores, since 1978. Previously marked blocked for "no data" — that was wrong; the beach has data and blanked only because of the stale-widget bug. Unblocked once that fix ships |
| Ron Jon Surf School | ronjonsurfschool.com | `cocoa-beach-pier-cocoa-beach-fl` | rjss1993@gmail.com | sent | 2026-09-07 | **Sent 2026-09-07 07:10 PT**, ~24 min after the 06:46 run committed the row as `drafted`. Follow-up eligible 2026-09-21. **Runs own YouTube cam `MNFZ08D5L40`** — lead with the cam partnership. Drafted 2026-09-07 on the cam angle: the panel fills in what a camera cannot show (period, tide state, water temp). No prior contact — Gmail searched for `ronjon`/`rjss1993`, zero hits. Beach page and embed both verified 200 and rendering this run. |
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

### MagicSeaweed replacement drafts — 2026-08-25

| Target | Contact | Status | Replacement offered | Notes |
|--------|---------|--------|---------------------|-------|
| Odyssey Surf School | info@odysseysurfschool.com | drafted | `/learn/how-to-read-surf-conditions` | Address and source page re-verified live. |
| UMass Lowell Outdoor Adventure | OutdoorAdventure@uml.edu | drafted | Hampton Beach and Narragansett Town Beach | Rye is not covered; the draft explicitly excludes it. |
| Whatever Sportfishing | freddy@foxwatersports.com | drafted | Cape Hatteras Lighthouse forecast | Whatever's own page publishes the cross-domain address. |

---

## Surf Bloggers & Micro-Influencers

| Target | Website/Channel | Contact | Status | Date | Notes |
|--------|----------------|---------|--------|------|-------|
| Ben Gravy | YouTube 520K | BENDAFEN@aol.com (**source unverified**) | sent | 2026-07-08 | **Already contacted; found in Gmail 2026-09-14.** A 2026-07-08 send to this address ("A free surf-forecast tool your audience might dig", carrying the retired "ML-powered" claim) never had a row, which is why the digest kept offering Ben Gravy as a fresh target. No reply. One follow-up remains, but the address was never verified on Ben Gravy's own channel, so the no-email guard still applies: verify it before any follow-up. East Coast angle. |
| Kale Brock | kalebrock.com.au | gee@kalebrock.com.au | sent | 2026-07-08 | **Sent, not drafted** — tracker previously said "drafted 2026-07-14". No response. The 2026-08-20 draft to a *second* address (`hello@kalebrock.com.au`) **was sent 2026-08-31 10:54 PT**. That is the one permitted follow-up; **do not contact Kale Brock again.** Silent through 2026-09-14: **follow-up exhausted; no response.** |
| Surf Simply | surfsimply.com | info@surfsimply.com | responded | 2026-07-11 | **2026-09-14: both 09-07 reply drafts are gone, deleted unsent.** Gmail shows no send on the thread after their 07-11 reply. The inbox owner holds the thread as `waiting_for_contact` and has recorded not to regenerate the discarded reply; this routine does not draft to it. Prior notes: **They replied** on 07-11: forwarding internally, team would reach out. Nobody did, and Quiver never followed up for 58 days. **Reply drafted 2026-09-07.** It explicitly retracts the "ML-powered" claim in the original 07-08 pitch, notes that US-only beach pages are little use to a Nosara audience, and offers forecast-versus-observed data instead of asking for a link. **Two drafts exist on this thread.** Keep the 06:55 PT rewrite; the 06:44 PT original is the pre-rewrite copy ("treat this as a nudge rather than a pitch", "a one-line no is completely fine", "with no expectation of a mention") and **must be deleted by hand.** Still unsent as of 2026-09-07 09:00 PT. |
| Barefoot Surf | barefootsurftutorials.com | support@barefootsurftutorials.com | sent | 2026-09-07 | The 08-20 draft sat unsent for 18 days and **went out 2026-09-07 06:35 PT**. Follow-up eligible 2026-09-21. |

---

## Coastal Businesses (Hotels, Tourism, Shops)

> **Recovered 2026-08-17.** These rows were created by the 2026-08-17 cloud run,
> whose tracker commit (`88cfe03`) never pushed. The rows were reconstructed from
> the Gmail drafts themselves, which are the surviving record. The routine now
> runs locally and writes this file directly.

| Target | Website | Nearest Beach (verified 200) | Contact | Status | Date | Notes |
|--------|---------|------------------------------|---------|--------|------|-------|
| Surf N' Wear Beach House | surfnwear.com | `leadbetter-santa-barbara-ca` | online@surfnwear.com | sent | 2026-08-18 | Verified sent in Gmail; no response as of 2026-08-24. Follow-up eligible 2026-09-01. |
| Glide Surf Co | glidesurfco.com | `asbury-park-asbury-park-nj` | info@glidesurfco.com | sent | 2026-08-18 | Verified sent in Gmail; no response as of 2026-08-24. Follow-up eligible 2026-09-01. |
| Corolla Surf Shop | corollasurfshop.com | `corolla-corolla-nc` | info@corollasurfshop.com | sent | 2026-08-18 | Verified sent in Gmail; no response as of 2026-08-24. Follow-up eligible 2026-09-01. |
| The Inn at Cocoa Beach | theinnatcocoabeach.com | `cocoa-beach-pier-cocoa-beach-fl` | reservations@theinnatcocoabeach.com | sent | 2026-08-18 | Verified sent in Gmail; no response as of 2026-08-24. Follow-up eligible 2026-09-01. |
| Cleanline Surf | cleanlinesurf.com | `seaside-cove-oregon-seaside-or`, `short-sands-manzanita-or`, `cannon-beach-ecolaindian` | support@cleanlinesurf.com | sent | 2026-08-25 | **Contacted three times. See below — stop.** |

### Cleanline Surf — contacted three times (open, needs Steven)

Gmail record, verified 2026-08-24:

| When | Beach used | Outcome |
|------|-----------|---------|
| 2026-08-10 | `seaside-cove-oregon-seaside-or` | **sent** |
| 2026-08-18 | `short-sands-manzanita-or` (Manzanita, ~15 mi from their town) | **sent** |
| 2026-08-25 | `cannon-beach-ecolaindian` (their actual town) | **sent** |

The 2026-08-17 note in this file said to delete the Short Sands draft and keep the Cannon
Beach one. That is now impossible — Short Sands went out on 2026-08-18, naming a beach in a
different town, as the third distinct beach pitched to the same address in ten days.

**The Cannon Beach draft was sent on 2026-08-25 rather than deleted.** Cleanline has now had three
emails naming three different beaches in fifteen days. **Do not contact Cleanline again under any
rotation.** Nothing came back by 2026-09-14: **follow-up exhausted; no response.** The row stays
`sent`; `declined` is reserved for an explicit refusal.

---

## Coastal Businesses & Surf Shops — 2026-08-20 batch (was missing from this file)

> Recorded 2026-08-24 from Gmail. None of these had a tracker row. All beach pages returned
> 200 and rendered conditions when re-verified 2026-08-24.

| Target | Contact | Beach page used | Status | Date | Notes |
|--------|---------|-----------------|--------|------|-------|
| Huntington Surf & Sport | info@hsssurf.com | `huntington-beach-pier` | sent | 2026-08-20 | An earlier 2026-06-15 attempt **bounced** — `hello@quiversurf.app` send-as alias was misconfigured. First real delivery is 08-20. |
| Whalebone Surf Shop | info@whalebonesurfshop.com | `nags-head-nags-head-nc` | sent | 2026-08-25 | Follow-up eligible 2026-09-08 |
| Skudin Surf | info@skudinsurf.com | `long-beach-long-beach-ny` | sent | 2026-08-25 | Follow-up eligible 2026-09-08 |
| Cape Hatteras Surf School | capehatterassurfschool@gmail.com | `cape-hatteras-lighthouse-buxton-nc` | sent | 2026-08-25 | Follow-up eligible 2026-09-08 |
| Padre Island Surf Camp | info@padreislandsurfcamp.com | `port-aransas-horace-caldwell-pier-port-aransas-tx` | sent | 2026-08-25 | Follow-up eligible 2026-09-08 |
| Safari Town Surf Shop | safaritown@gmail.com | `nelscott-reef-lincoln-city-or` | sent | 2026-08-25 | Follow-up eligible 2026-09-08 |
| Cannon Beach Surf Lessons & Rentals | julie@cannonbeachsurflessonsandrentals.com | `cannon-beach-ecolaindian` | sent | 2026-08-25 | Follow-up eligible 2026-09-08 |
| Shoreline OBX | info@shorelineobx.com | `nags-head-nags-head-nc` | sent | 2026-08-10 | No response. Follow-up was already eligible on 08-24 but **was not drafted this run** — this is a coastal-business row and week 4 is publications. Draft it in week 3 of September. |
| Ho Stevie! | help@hostevie.com | `ocean-beach` | sent | 2026-08-10 | Same as above — follow-up eligible, deferred to the coastal-business rotation. |

---

## Untracked 2026-08-03 sends (recovered 2026-08-31)

> Found by diffing `in:sent` against this file. Seven emails went out on 2026-08-03; only the three
> California school initials were ever recorded. These four had **no row anywhere**, which means
> every run since 08-03 could have re-pitched them. All four domains re-verified this run; embed
> slugs returned 200 and rendered conditions.

| Target | Contact | Location | Beach slug (200 + renders) | Status | Date | Notes |
|--------|---------|----------|---------------------------|--------|------|-------|
| OBX Surf School | info@obxsurfschool.com | Outer Banks, NC | `nags-head-nags-head-nc` | follow-up | 2026-09-08 | **Follow-up SENT 2026-09-08 19:03 PT** (found in the 09-14 reconciliation); no bounce, no reply. Follow-up exhausted; do not contact again. Prior note: Site returns **403 to automated requests** with a browser UA — unverifiable for any claim about their page; the address is trusted from the clean 08-03 delivery, not from a re-scrape. **One follow-up drafted 2026-09-07 20:20 PT** into the original thread, correcting the raw `/embed/conditions/` link the 08-03 mail sent and handing over the real beach page. Follow-up now exhausted; set `declined` if silent by 2026-09-21. |
| Moment Surf Co | info@momentsurfco.com | Pacific City, OR | `pacific-city-cape-kiwanda` | follow-up | 2026-08-03 | Silent through 2026-09-14: **follow-up exhausted; no response.** Stays `follow-up` (no explicit refusal). Shop, not a school. Cape Kiwanda is their own beach; no proximity substitution needed. **Follow-up already exhausted — corrected 2026-09-07.** Gmail shows two sends to this address: 2026-06-29 ("Free surf conditions widget for Moment Surf Company") and 2026-08-03. The 08-03 mail *was* the one permitted follow-up, so this row was never eligible. **Do not contact again.** Set `declined` if silent by 2026-09-14. |
| Oregon Surf Adventures | info@oregonsurfadventures.com | **Seaside, OR** | `seaside-cove-oregon-seaside-or` | rejected | 2026-09-08 | **Hard bounce, so `rejected`.** **The 09-08 19:03 PT follow-up BOUNCED**: a `550` delivery failure 15 seconds later, the domain's mail host rejecting the recipient. The address is dead. Do not retry it and do not count this send as delivered. Handed to this routine by the inbox owner on 09-09. Any further contact needs a new address verified on their own site. Prior note: **Slug corrected 2026-09-07.** This row recorded `pacific-city-cape-kiwanda`; that was wrong on both counts. The 08-03 email actually used `seaside-cove-oregon-seaside-or`, and oregonsurfadventures.com names Seaside five times and no other town at all. The 200 + renders check was run on the corrected slug. **One follow-up drafted 2026-09-07 20:21 PT** into the original thread. Follow-up now exhausted; set `declined` if silent by 2026-09-21. |
| Rincon Surf School | info@rinconsurfschool.com | Rincón, Puerto Rico | `marias` → `/pr/rincon` hub | follow-up | 2026-09-08 | **Follow-up SENT 2026-09-08 19:03 PT**; no bounce, no reply. Follow-up exhausted; do not contact again. Prior note: `mailto:info@rinconsurfschool.com` re-confirmed on their own homepage this run. Quiver covers **six** Rincón breaks, not one: Marías, Domes, Indicators, Sandy Beach, The Point at Sandy, Tres Palmas (counted from the live sitemap). **One follow-up drafted 2026-09-07 20:22 PT** into the original thread, offering the `/pr/rincon` hub instead of the single break. Follow-up now exhausted; set `declined` if silent by 2026-09-21. |

**No reply from any of the four.** A Gmail search across all four domains returns nothing.

**Three of the four were drafted on 2026-09-07 after Steven removed the backlog stop.** OBX Surf
School, Oregon Surf Adventures and Rincon Surf School each got one follow-up, threaded into the
original 08-03 conversation. Moment Surf Co was **skipped**: Gmail shows it had already been
contacted twice (06-29 and 08-03), so its one permitted follow-up was spent before this row was
ever written.

**Open item — the 08-03 batch carried an unsupportable accuracy claim.** Reading the quoted
originals back during this run showed all four 08-03 emails linked `https://quiversurf.app/forecast-accuracy`,
and the OBX and Oregon Surf Adventures ones additionally stated *"Quiver's wave-height error is 55%
lower than the NOAA baseline."* That is the same class of claim that got `/forecast-accuracy` pulled
from outreach, and it is standing in these recipients' inboxes under Steven's name. The 2026-09-07
follow-ups do not repeat it, but they also do not retract it — unlike the Surf Simply reply drafted
the same morning, which explicitly retracted "ML-powered". **Settled 2026-09-07: Steven's call is not to retract.** The three follow-ups stand as drafted.
Do not re-open this, redraft them, or append a correction. Forward looking rules are unchanged: no
new copy claims ML, AI, a spot count, or competitor superiority, and nothing links `/forecast-accuracy`.

---

## Run log — 2026-09-14 09:20 PT (3 follow-up drafts)

Rotation: **week 2 → surf-bloggers.** Digest `Brand-Vault/seo-audit/2026-09-14/OUTREACH-DIGEST.json`:
82 rows, **0 candidates**, 1 blocked on contact research (Ben Gravy). The Codex brief for 09-14
agrees nothing new is ready. The bloggers category is exhausted: Kale Brock's follow-up is spent,
Surf Simply belongs to the inbox owner, Barefoot Surf's follow-up is not due until 09-21, and Ben
Gravy turns out to have been emailed in July (below). No new blogger research was done. The
three-draft cap went to eligible follow-ups, each with a verified, still-broken page to fix, which
rank above cold research.

### Gmail reconciliation (Step 0)

Drafts: every page read (one page, no continuation token). Sent: `in:sent newer_than:60d`
(welcome subjects excluded) paged to exhaustion (3 pages), plus a July recount. Inbound from every
contacted outreach domain over 30 days: only the three known threads (Ken Merrill, Oregon Coast
Today, Island Free Press). Bounces over 21 days: one.

| Finding | Correction |
|---|---|
| **Ken Merrill's links are live.** capecodsurfrider.org carries both Cape Cod pages. The first agreed link outreach has ever collected. | Row updated; the Sites-wrapped hrefs are flagged for the 09-21 backlink check |
| OBX Surf School and Rincon Surf School follow-ups **went out 09-08 19:03 PT** | `follow-up drafted` → `follow-up`, exhausted |
| The Oregon Surf Adventures follow-up **bounced** (`550`, recipient rejected) | → `bounced`; address dead. Handed over by the inbox owner |
| The Surf Simply and Oregon Coast Today 09-07 reply drafts were **deleted unsent**, including the duplicates flagged for hand deletion | Rows corrected. Both threads are inbox-owned `waiting_for_contact` |
| The duplicate Ken draft and both `[TEST - delete me]` drafts are gone | Nothing left on last week's hand-deletion list |
| **Ben Gravy was emailed 2026-07-08** (address of unverified origin) and had no row | `queued` → `sent` |
| **Surf Diva had a fourth email** (07-08) | Row corrected |
| **BeachGrit (07-28) and a first Eos pitch (07-28, news@eos.org)** were never recorded | Rows annotated; Eos follow-up now exhausted |
| **Coastal Review's "follow-up 2026-08-24" never went out.** The thread holds only the 06-23 pitch; the follow-up is the 08-31 draft, still unsent | → `sent` 2026-06-23, follow-up drafted and unsent |
| July was recorded as 4 sends; Gmail shows at least 9 | Metrics recounted |
| Rows said "set `declined` if silent by …" | Per the current routine, silence after the one follow-up keeps its sent status with "follow-up exhausted; no response"; `declined` is for explicit refusals. Applied to Surf Diva, Pacific, Corky Carroll's, Cleanline, Kale Brock, Moment |
| **Status cells the digest cannot read.** `buildRow` maps any value outside its status set to `queued`, so `sent 2026-08-31`, `follow-up drafted` and (briefly, this run) `bounced` all parsed as queued | Every Status cell set to a canonical value, dates moved to Notes; hard bounce recorded as `rejected`; rule added under the Status Legend. These rows sit in category `other`, which never rotates, so no one was re-offered, but the counts were wrong |

### Drafted (3), each the one permitted follow-up, threaded into its 08-31 original

| Target | Page offered (200, in live sitemap) | Why this one |
|---|---|---|
| UMass Lowell Outdoor Adventure | `/nh/hampton/hampton-beach-hampton-nh`, `/ri/narragansett/narragansett-town-beach-narragansett-ri` | `.edu`. `surfing.aspx` still links both MagicSeaweed pages, which now forward to Surfline: the same swap Ken made |
| Whatever Sportfishing | `/embed/conditions/cape-hatteras-lighthouse-buxton-nc` (embed 200, renders) | Their `/magicseaweed` page still iframes the dead MSW chart; the embed is a drop-in iframe src |
| NJ Sea Grant Consortium | `/nj/asbury-park/asbury-park-asbury-park-nj` (embed renders) | `.org`. Their `/ripcurrents/` page links the NWS surf zone forecast and no per-beach resource. NJ coverage is now 28 beaches across 15 towns |

Voice: signed "Steve", matching the routines contract and Steve's own 09-10 note on the Ken thread.
One ask each, no dashes in prose, no ML/AI/accuracy/competitor-superiority claim, no
`/forecast-accuracy`, bare URLs. No opening or closing is shared across the three.

**One wording flaw, left for Steven:** the UML draft names `magicseaweed.com` in plain text and Gmail
autolinked it (as `http://`). Harmless, but if unwanted, change it to "MagicSeaweed" in Gmail before
sending. An edit in Gmail keeps the thread; the connector's `update_draft` would detach it.

### Eligible for a follow-up but not drafted (cap of three)

Nor Cal Surf Shop and Puerto Rico Sea Grant (08-31); Odyssey (08-31, skipped: nothing concrete to
swap); UW Sea Grant and Surfrider national (08-25); Whalebone, Skudin, Cape Hatteras Surf School,
Padre Island, Safari Town, Cannon Beach Surf Lessons (08-24 PT); HSS Surf (08-20); Surf N' Wear, Glide,
Corolla, Inn at Cocoa Beach (08-18); Shoreline OBX and Ho Stevie! (08-10). Next week is week 3
(coastal businesses), where most of these sit. **Before drafting any of them, confirm in Gmail that no
follow-up already went out:** this run found five untracked sends.

### Addendum 09:40 PT: wrapped links, and two follow-ups already sent

Steven asked for the `google.com/url` text to be stripped from the drafts. The raw MIME showed the
wrapper was in the **visible** link text, not just the href. The plain `body` path does that; see the
correction in the URL section above.

- **NJ Sea Grant and Whatever Sportfishing had already gone out at 09:28 PT**, before the clean
  replacements existed, both with wrapped visible links. They cannot be recalled, and the links still
  land correctly. There is one send each: no duplicate.
- **UMass Lowell was not yet sent.** A replacement was created at 09:30 PT with `htmlBody` anchors
  (clean visible links, "MagicSeaweed" instead of an autolinked domain). The 09:18 PT draft is
  superseded.
- **Hand deletion needed**, because the connector has no trash permission (confirmed again today): the
  superseded UML draft (09:18 PT) and the Whatever Sportfishing replacement (09:31 PT). The second is
  now a duplicate of a sent email, so **do not send it**. The NJ replacement is already gone.

### Coverage gaps

- **Rye, NH**: no page (new, logged above).
- **Long Beach Island, NJ**: still open.

---

## Run log — 2026-09-07 20:20 PT (3 drafts — backlog stop removed by Steven)

**Steven removed the backlog stop.** The rule that three unsent SEO drafts block new cold drafts is
struck from `~/.claude/scheduled-tasks/weekly-seo-outreach/SKILL.md` (Step 4 bullet and the Limits
section). It had blocked three consecutive runs while eligible follow-ups went undrafted for weeks
and the Drafts folder never cleared. A standing backlog is now **reported, not treated as a stop.**

What did *not* change, and still binds absolutely: never stack a second draft on an unsent one to the
same address, and never exceed one follow-up per target, ever.

### Drafted

| Target | Beach page (200 + renders, this run) | Thread |
|---|---|---|
| OBX Surf School | `https://www.quiversurf.app/nc/nags-head/nags-head-nags-head-nc` | replied into the 08-03 thread |
| Oregon Surf Adventures | `https://www.quiversurf.app/or/seaside/seaside-cove-oregon-seaside-or` | replied into the 08-03 thread |
| Rincon Surf School | `https://www.quiversurf.app/pr/rincon` | replied into the 08-03 thread |

All three are the one permitted follow-up to an unanswered 08-03 email, threaded into the original
conversation rather than sent as a fresh cold mail. Each was written to its own recipient: OBX opens
on a correction (the 08-03 mail handed Chris a bare `/embed/conditions/` frame), Oregon Surf
Adventures opens on the beach and closes by saying it is the last time, Rincón opens on the fact that
Quiver covers six of their breaks rather than the single one pitched. No opening or closing is shared.

### Skipped, with cause

- **Moment Surf Co** — not eligible. Gmail shows sends on **2026-06-29 and 2026-08-03**; the 08-03
  mail was already the one permitted follow-up. The row claimed a single 08-03 contact. Corrected.
- The five `blockedOnContactResearch` surf-school rows — no verified email, all previously rejected
  for cause, nothing about them has changed.
- The six existing unsent drafts (Ken Merrill, Surf Simply ×2, Oregon Coast Today ×2, Coastal
  Review, Hawaii Public Radio, Stab) — reported below, not stacked on.

### A row that was wrong in two ways

Oregon Surf Adventures was recorded against `pacific-city-cape-kiwanda`. The 08-03 email actually
used `seaside-cove-oregon-seaside-or`, and oregonsurfadventures.com names **Seaside five times and
no other town at all.** Had the row been trusted, this follow-up would have pitched a beach roughly
70 miles down the coast in a different town: the Cleanline mistake, again. The row carried a standing
warning to confirm the town from their own site, and that warning is what caught it.

### The retraction question — settled, do not re-raise

All four 08-03 emails linked `/forecast-accuracy`, and the OBX and Oregon Surf Adventures ones stated
**"Quiver's wave-height error is 55% lower than the NOAA baseline."** That claim is unsupportable and
that page was pulled from outreach for exactly this reason. The three follow-ups drafted tonight do
not repeat it.

**Steven's call, 2026-09-07: do not retract it.** The drafts stand exactly as written. A retraction
is not owed to a cold recipient who never engaged, and rewriting would have cost three fresh drafts
plus three hand deletions for no return.

This closes the question for the 08-03 batch. **A future run must not re-open it, redraft these three,
or append a correction to any of them.** The rule that still binds is forward looking: no new copy
may claim ML, AI, a spot count, or superiority over a named competitor, and no draft may link
`/forecast-accuracy`. Correcting a claim inside a *live* conversation, as the Surf Simply reply did
on 2026-09-07, remains right; chasing down cold sends to retract old copy does not.

### Verification run before drafting

DNS and homepage for all four domains (obxsurfschool.com 403 to automated requests, known and
recorded; the other three 200). Beach pages 200. `/embed/conditions/<slug>` 200 **and** body grepped
for "No conditions available" — all render. Slugs taken from the live sitemap, 1,787 URLs. Gmail
re-checked for each exact address immediately before creation: zero existing drafts, exactly one
prior send each, no inbound reply. All three creates read back after the fact and confirmed on the
correct thread with clean visible URLs.

---

## Run log — 2026-09-07 09:00 PT (0 drafts — reconciliation only)

The scheduled Monday 09:00 run. **A full manual run of this same routine had already executed at
~06:41–06:46 PT and committed its tracker update as `c0fa2bfd8`.** This run did not repeat it; it
reconciled the ~2.5 hours of Gmail activity that the commit could not have seen, and created nothing.

**No drafts were created.** Three independent reasons, any one of which is disqualifying:

1. **Backlog stop (Step 4).** Eight unsent SEO outreach drafts across six targets are sitting in
   Drafts — Ken Merrill, Surf Simply ×2, Oregon Coast Today ×2, Coastal Review, Hawaii Public Radio,
   Stab. The ownership contract caps this at three.
2. **The rotation category is empty.** Week 1 → surf-schools. The digest offered exactly one
   draftable candidate, Ron Jon Surf School, **and it was sent at 07:10 PT.** The remaining five are
   all `blockedOnContactResearch` and all five were already researched and rejected for cause.
3. **Warm replies are not this routine's to draft.** Per `.quiver/CLAUDE-ROUTINES.md`, incoming
   replies belong to the daily inbox heartbeat. Oregon Coast Today's 09-04 reply already has a draft
   from the 06:46 run; nothing was stacked on it.

### What Gmail showed that the 06:46 commit could not

| Finding | Detail |
|---|---|
| **Ken Merrill was sent, then re-drafted** | The links went out **06:52:39 PT** — the pre-rewrite copy ("Long overdue on my end… that's on me, not you"). A rewritten draft was then created at **06:55:03 PT**, after the send. The agreed link is collected; **the surviving draft is a duplicate.** |
| **Surf Simply has two drafts on one thread** | 06:44 PT (pre-rewrite) and 06:55 PT (rewrite). Both unsent. |
| **Oregon Coast Today has two drafts on two threads** | 06:54 PT landed on a brand-new thread `1a07c25e7b590dc0`; 06:55 PT is correctly on `1a0368fec83cd33d`. This is the documented `update_draft` threading-detach failure, caught in the wild. Identical bodies. |
| **Four outreach emails went out this morning** | Barefoot Surf 06:35, Hans Hedemann 06:35, Ken Merrill 06:52, Ron Jon 07:10. Three of those rows were still `drafted` here. |
| **A fourth consecutive metrics drift** | August was recorded as 34. Gmail shows **43**: the 08-31 recount was written before that morning's own 9-send batch went out (NJ Sea Grant, Whatever Sportfishing, UMass Lowell, Kale Brock follow-up, PR Sea Grant, Oregon Coast Today, Island Free Press, Odyssey, Nor Cal). Nine rows were still `drafted` here as a result. |

### Verified this run

- `https://www.quiversurf.app/ma/eastham/coast-guard-beach-eastham-ma` → 200
- `https://www.quiversurf.app/ma/orleans/nauset-beach-orleans-ma` → 200
- `https://www.quiversurf.app/tide/lincoln-city` → 200
- `capecodsurfrider.org` → 200, **0 `quiversurf` references, 1 `surfline` link.** Ken's email is
  hours old, so this is the expected baseline, not a failure. Re-check 2026-09-21.
- Inbound mail since 09-04: **no new outreach replies.** The two September replies (Oregon Coast
  Today intrigued, Island Free Press passed) are both already recorded.

### Needs Steven — hand deletion

The Gmail connector has no trash permission. Three drafts must be deleted by hand, and **none of
them may be sent**:

| Draft | Why |
|---|---|
| Ken Merrill rewrite (06:55 PT) | The email already went at 06:52. Sending this repeats the same two links. |
| Surf Simply original (06:44 PT) | Superseded by the 06:55 rewrite on the same thread. Carries the "nudge rather than a pitch" / "no expectation of a mention" copy the voice rules forbid. |
| Oregon Coast Today copy on the detached thread (06:54 PT) | Off the real conversation. Sending it starts a second thread with Gretchen. |

Also still present from 08-24: the two `[TEST - delete me]` drafts to `stcha0004@gmail.com`.

**No coverage gaps found this run** — no new beach was named, so none could be substituted. Long
Beach Island, NJ remains open and unfixed.

### First thing for the next run with a clear Drafts folder

The four untracked 08-03 follow-ups — OBX Surf School, Moment Surf Co, Oregon Surf Adventures,
Rincon Surf School — are all months past the 14-day mark and sit in the surf-schools rotation. One
follow-up each, then `declined`. They have been deferred by the backlog stop three runs running.

---

## Run log — 2026-09-07 (4 drafts — warm leads first)

Rotation: week 1 → surf-schools. Digest at `Brand-Vault/seo-audit/2026-09-07/OUTREACH-DIGEST.json`.
82 rows, **1 draftable candidate, 5 blocked on contact research** — the digest now separates the two
(see the fix below), so the candidate count finally means what it says.

**The 08-31 backlog cleared.** Steven sent the batch on 08-31 and 09-07. Only three outreach drafts
remain unsent — Stab, Hawaii Public Radio, Coastal Review — all warm-lead replies that predate this
run, so they were left alone rather than stacked on.

**The two defective 08-31 drafts were rewritten before sending, not sent as generated.** Gmail shows
Nor Cal Surf Shop went out 08-31 as "Free Linda Mar conditions page, if it's useful to you" and Hans
Hedemann went out 09-07 as "Free Waikiki Beach conditions page, and a thought about your cam" — the
cam angle the row had always asked for. Neither carries the ML claim. That decision is closed.

**Two replies arrived and both were actioned this run:**

- **Oregon Coast Today** (09-04) — publisher evaluating it for the regular format, *"similar to the
  tide table… we are both intrigued."* Replied to, pointing at `/tide/lincoln-city` as the nearest
  existing analogue and offering a weekly summary they can paste into their own layout.
- **Island Free Press** (09-02) — polite pass. Row set to `declined`, closed.

Drafted this run, in expected-value order: **Ken Merrill** (already agreed, ~4 months uncollected,
and the previous draft turned out to have been deleted rather than sent), **Oregon Coast Today**
(hottest live lead), **Surf Simply** (warm reply unanswered 58 days), **Ron Jon Surf School** (the
rotation's only draftable row; own cam, verified email, no prior contact).

Every URL used was re-verified 200 this run, and the Cocoa Beach Pier embed was checked for the
"No conditions available" body, not just its status code.

**Two digest bugs fixed this run** (`lib/seo/agent-workflow/outreach-digest.ts`):

1. **`contact` was read with an exact header match.** The live surf-school tables head that column
   "Contact channel (verified)", which normalizes to `contactchannelverified` and never matched
   `contact` — so **every surf-school row parsed as having no email at all**, and
   `requiresContactResearch` was reported `true` even for rows with a perfectly good address. The
   beach column had already been given a prefix match for exactly this reason; the contact column
   had not. Now uses the same prefix match.
2. **The no-email guard is enforced in the digest, not just in prose.** Queued rows without a
   verified email are routed to a new `blockedOnContactResearch` list instead of being offered as
   candidates, and `missing` says so when a category has none left that are draftable.

Bug 1 mattered more than bug 2: fixing the guard alone would have suppressed every surf-school row,
including Ron Jon. The guard is only safe because the parser now sees the addresses.

**Node:** `yarn seo:outreach-digest` needs Node 22 on `PATH` (repo `.nvmrc` says `22`); the default
`node` here is v14 and yarn refuses on the `engines` check before the script ever runs.

---

## Run log — 2026-08-31 (0 drafts — backlog stop + category exhausted)

Rotation: `buildOutreachDigest` reported **week 1 → surf-schools**. Digest written to
`Brand-Vault/seo-audit/2026-08-31/OUTREACH-DIGEST.json`. 78 rows, 3 candidates.

**No drafts were created.** Two independent reasons, either of which alone is disqualifying:

1. **Backlog stop (Step 4).** 15 unsent outreach drafts are already in Drafts, from 08-20, 08-25 and
   08-31. The routine treats a standing backlog as a stop signal for the whole run.
2. **The category is exhausted.** All 3 surf-schools candidates the digest offered are flagged
   `requiresContactResearch` and all 3 were already investigated and documented here as unusable:
   Santa Cruz Surf School (JS-rendered site, no address in raw HTML), North Shore Surf Girls
   (phone/contact form only), Hawaiian Surfing Adventures (phone only). Nothing about them has
   changed, so no research time was spent re-deriving the same rejections. Per Step 3, five usable
   rows is a trigger for research, not a quota for drafts — so this run drafted nothing rather than
   manufacturing targets.

**The digest re-offers rejected rows.** It selects on `status`, and these rows are `queued` because
the no-email guard holds them there. That is working as designed, but it means the digest's candidate
count overstates what is actually draftable — 3 candidates, 0 draftable. Worth teaching the digest to
read the no-email guard so a future run isn't re-tempted.

**Node trap hit again.** `yarn seo:outreach-digest` fails with
`The engine "node" is incompatible ... Expected >=22.0.0 <23.0.0. Got 14.19.3` unless Node 22 is on
`PATH` first. Prepend a v22 bin dir before running.

**Digest re-run after the template fix**, with Node 22 on `PATH`. It now emits real beach names and
no ML claim — end-to-end confirmation, not just a green unit test:

| Row | Subject before (05:08) | Subject after |
|---|---|---|
| Santa Cruz Surf School | Free ML surf forecasts for your your local breaks crew | Free surf forecasts for Steamer Lane Santa Cruz |
| North Shore Surf Girls | Free ML surf forecasts for your your local breaks crew | Free surf forecasts for Haleiwa |
| Hawaiian Surfing Adventures | Free ML surf forecasts for your your local breaks crew | Free surf forecasts for Hanalei Bay Kauai |

Row count moved 78 → 82 and `sent` 16 → 20 with the four recovered 08-03 rows.

**Third finding, from the same Gmail diff: an entire 2026-08-03 batch of 7 sends was uncounted, and
four of those targets had no row at all.** Recorded under "Untracked 08-03 sends". All four are
past the 14-day follow-up mark and sit in this week's own rotation category, so the backlog stop is
the only thing holding them — they are the first thing to draft once Drafts is clear.

**No coverage gaps found this run.** Every beach named in a repaired draft or a recovered row
resolved to a live slug in the sitemap and rendered conditions; no proximity substitution was
needed. The Long Beach Island, NJ gap logged on 08-24 is still open and still unfixed.

Also still sitting in Drafts: **two throwaway test drafts** from the 08-24 URL experiment
(`[TEST - delete me]` and `[TEST 2 - delete me]`, both to stcha0004@gmail.com). The Gmail connector
has no trash permission, so Steven has to delete them by hand.

---

## Run log — 2026-08-25 (validation re-run, 0 drafts)

The routine was re-run the same day to test the rewritten process. **It created zero drafts, which
is the correct outcome**, and Step 0 caught real drift: between the two runs Steven sent 20 messages,
including 12 outreach emails.

Newly sent 2026-08-25 and reconciled above: Eos; The Inertia and Outside Online follow-ups; the six
2026-08-20 shop/school drafts; Cleanline's third email; and second follow-ups to Surf Diva, Pacific
Surf School and Corky Carroll's.

**Two rows are now past the routine's contact ceiling.** The three CA schools have had three emails
each, and Cleanline three in fifteen days. Those were flagged for deletion on 08-24 and sent instead.
Not a process failure — Steven's call — but the rows are marked so no future run adds a fourth.

Still unsent and waiting: the Stab and Hawaii Public Radio warm replies, the Coastal Review follow-up,
Ken Merrill's link handoff, and all six new-source drafts.

### Gap this re-run exposed

`buildOutreachDigest` re-offers rows that have already been investigated and rejected. On 2026-08-25
it surfaced Adventure Journal, Weatherwise and REI Co-op Journal as this week's only publication
candidates — all three were researched and rejected on 08-24 with reasons recorded below. The digest
reads `status`, and "rejected for cause" is not a status, so they will resurface every week 4 forever.

**Fix:** add a `rejected` status to the legend and to `buildOutreachDigest`'s filter, and move those
three rows to it. Until that lands, a run must check the rejection tables before researching a
candidate. Logged as a follow-up, not fixed here — this run was a process test, not a code change.

---

## New Sources — researched and verified 2026-08-24

> Every row below was verified this run: DNS resolves, homepage 200, a **real email confirmed on the
> target's own site** (Cloudflare `data-cfemail` and HTML-entity `mailto:` decoded), and where a beach
> is named, `embed/conditions/<slug>` returned 200 **and** the body did not contain
> "No conditions available". Slugs were taken from the live sitemap (338 beach pages), not from memory.

### Drafted 2026-08-24

| Target | Type | Contact (verified, role confirmed) | Beach slug (200 + renders) | Status | Why this one |
|--------|------|-----------------------------------|---------------------------|--------|--------------|
| Island Free Press | Local news, Hatteras & Ocracoke NC | donna@islandfreepress.org, cc joy@islandfreepress.org | `cape-hatteras-lighthouse-buxton-nc`, `s-turns-rodanthe-nc` | declined | Their entire coverage area is Hatteras Island, where Quiver has Buxton, Rodanthe, Nags Head, Kill Devil Hills, Corolla. Closest geographic fit in the file. **Sent 2026-08-31; Donna Barnett replied 2026-09-02 declining politely** ("we'll pass for now"). Closed — do not contact again. |
| Oregon Coast Today | Local news, Central OR coast | gammerman@oregoncoasttoday.com — **Gretchen Ammerman, editor** (confirmed on their About page) | `nelscott-reef-lincoln-city-or` | responded | Based in Lincoln City; Quiver has Nelscott Reef there plus 15 other OR towns. Publisher Patrick Alexander is at palexander@oregoncoasttoday.com if the editor doesn't bite. **Sent 2026-08-31. Gretchen replied 2026-09-04: her publisher is evaluating it for the regular format, "similar to the tide table — we are both intrigued."** This is the warmest lead in the file. **Reply drafted 2026-09-07** pointing at `/tide/lincoln-city` as the closest existing analogue to that format and offering a short weekly swell/wind/tide summary they can drop into their own layout, free and uncredited. Do not let this one go quiet like the last three. **Two reply drafts exist.** Keep `1a0368fec83cd33d` (the real conversation thread); the 06:54 PT copy landed on a *new* thread `1a07c25e7b590dc0` — the `update_draft` threading-detach failure — and **must be deleted by hand.** Bodies are identical. `https://www.quiversurf.app/tide/lincoln-city` re-verified 200 in the 09:00 run. Still unsent as of 2026-09-07 09:00 PT. **2026-09-14: both reply drafts are gone, deleted unsent.** No send on the thread after Gretchen's 09-04 note ("I'll keep you posted"). The inbox owner holds it as `waiting_for_contact` and will not regenerate the reply; this routine does not draft to it. |
| Surfrider Foundation (national) | NGO / media | media@surfrider.org | n/a | sent | High-authority `.org`. See the Cape Cod chapter row below — chapter-level is where the links actually live. |
| Puerto Rico Sea Grant (UPRM) | `.edu` research/extension | seagrant@uprm.edu | `tres-palmas` (Rincón) | sent | Sent 2026-08-31. Quiver has 19 PR beaches across 8 towns. Tres Palmas is a designated marine reserve — squarely Sea Grant's subject matter, not a commercial pitch. |
| NJ Sea Grant Consortium | `.org` research/extension | skreisler@njseagrant.org — **Samantha Kreisler, Director of Communications** (confirmed on their staff page) | `asbury-park-asbury-park-nj` | follow-up | Sent 2026-08-31; **follow-up SENT 2026-09-14 09:28 PT**, with its visible link as Gmail's `google.com/url?q=` wrapper (lands correctly). Exactly one 09-14 send on the thread; the clean replacement draft was removed unsent. 26 NJ beaches across 13 towns at send time; **28 across 15** in the 09-14 sitemap. The 09-14 follow-up points at their `/ripcurrents/` page, which links the NWS surf zone forecast but no per-beach resource. Follow-up exhausted after it. They publish rip-current and coastal-safety material. |
| Washington Sea Grant (UW) | `.edu` research/extension | seagrant@uw.edu | `westport-beach` | sent | Sent 2026-08-25. 13 WA beaches. Westport is the state's main surf town. |

`.edu` and `.org` links from Sea Grant and Surfrider are worth materially more than a surf-shop
footer link, and these organisations publish "coastal resources" pages that already link out to
third-party tools. The pitch is a safety/conditions resource, not a product.

### Re-engage — someone already said yes and it was never collected

| Target | Contact | What happened |
|--------|---------|---------------|
| Ken Merrill — Cape Cod Surfrider | ken.merrillcc@gmail.com | **Drafted 2026-08-24** into the original thread, with Coast Guard Beach (Eastham) and Nauset Beach (Orleans) links — both verified 200 and rendering. On **2026-05-13** Ken replied *"I'll reset with your new links. Sounds great."* — agreeing to swap Magicseaweed/Surfline links for Quiver on the chapter's surf report page. **Verified 2026-08-24: it never happened.** capecodsurfrider.org still links Surfline, and the site contains zero Quiver references (the one "quiver" hit is a surfer describing his board quiver). An agreed-to `.org` backlink has been sitting uncollected for 3½ months. Cheapest win in this entire file. **Re-verified 2026-08-31: still uncollected.** capecodsurfrider.org returns 200, contains zero `quiversurf` references, and still links `surfline.com/surf-report/long-sands-beach` for the report/cam. **Re-checked 2026-09-07: the 08-24 reply draft was deleted, not sent** — the Gmail thread still ends at Steven's 2026-05-13 "No worries at all." So the agreed link is uncollected after ~4 months and no draft existed. **Re-drafted 2026-09-07** into the original thread; both beach URLs re-verified 200 this run. This is the highest-expected-value email in the file: the target already said yes. **SENT 2026-09-07 06:52 PT** — collected after ~4 months. Both URLs re-verified 200 again in the 09:00 run. **A second, rewritten Ken draft (created 06:55 PT, after the send) is still sitting in Drafts and is now a duplicate — it must be deleted by hand, not sent.** Sending it would put the same two links in front of Ken twice in one morning. capecodsurfrider.org re-checked 2026-09-07 09:00 PT: still zero `quiversurf` references, still one `surfline` link — expected, the email is hours old. Re-check 2026-09-21. **LINKS LIVE, verified 2026-09-14.** Ken replied 09-07 ("I'll take care of it"), the inbox owner saw both links up on 09-09, and Steve thanked him on 09-10. capecodsurfrider.org now links `coast-guard-beach-eastham-ma` and `nauset-beach-orleans-ma`. It is a Google Sites page, so each href goes through Google's `google.com/url?q=...&sa=D` outbound wrapper rather than pointing straight at quiversurf.app. The Surfline Long Sands cam link is still there too. Not yet in the Codex backlink proxy; whether Ahrefs credits a Sites-wrapped link is the question for the 2026-09-21 backlink check. First agreed link ever collected from outreach. |

### MagicSeaweed replacement drafts — 2026-08-25

| Target | Contact | Status | Replacement offered | Notes |
|--------|---------|--------|---------------------|-------|
| Odyssey Surf School | info@odysseysurfschool.com | sent | `/learn/how-to-read-surf-conditions` | Sent 2026-08-31. Address and source page re-verified live. **2026-09-14: follow-up eligible, skipped.** The post (titled "Magicseaweed Surf Forecast") names MagicSeaweed 14 times but carries no MagicSeaweed href and no outbound forecast link at all, so there is nothing concrete to swap. Lower value than the three drafted. |
| UMass Lowell Outdoor Adventure | OutdoorAdventure@uml.edu | sent | Hampton Beach and Narragansett Town Beach | Sent 2026-08-31; follow-up drafted 2026-09-14. **Two drafts exist: send the 09:30 PT one** (clean visible links, "MagicSeaweed" instead of an autolinked `magicseaweed.com`). The 09:18 PT draft is superseded and must be deleted by hand. Rye is not covered; the draft explicitly excludes it. **09-14:** `surfing.aspx` still links `magicseaweed.com/Hampton-Beach-Surf-Report/2074/` and `magicseaweed.com/Narragansett-Beach-Surf-Guide/1103/`, both of which now forward to Surfline. One follow-up drafted into the 08-31 thread; follow-up exhausted after it. |
| Whatever Sportfishing | freddy@foxwatersports.com | follow-up | Cape Hatteras Lighthouse embed | Sent 2026-08-31; **follow-up SENT 2026-09-14 09:28 PT.** That was the first 09-14 draft, so its visible link went out as Gmail's `google.com/url?q=` wrapper; it still lands on the embed. A clean replacement draft created at 09:31 PT is now a **duplicate of a sent email: delete it by hand, do not send it.** Whatever's own page publishes the cross-domain address (re-confirmed 09-14). **09-14:** `whatevercharters.com/magicseaweed` still iframes `magicseaweed.com/Mid-Atlantic-Surf-Chart/22/`, which forwards to a Surfline chart. The follow-up offers `/embed/conditions/cape-hatteras-lighthouse-buxton-nc` (200, renders) as a drop-in iframe src. Follow-up exhausted after it. |

### Rejected this run — with the specific reason

| Target | Reason |
|--------|--------|
| Honolulu Civil Beat | **Already pitched twice** — 2026-04-29 and 2026-06-23, both to news@civilbeat.org, both linking `/forecast-accuracy`. Zero response to either. That is the initial plus its one permitted follow-up. Marked `declined`; do not contact again. |
| The SandPaper (Long Beach Island, NJ) | **Quiver has no LBI coverage.** No Ship Bottom, Beach Haven, Harvey Cedars, or Barnegat Light slug exists. The nearest NJ beach is Seaside Park, on a different barrier island across Barnegat Inlet. This is the Cleanline mistake waiting to happen — it is a **coverage gap to fix**, not a target to email. |
| NC Sea Grant, Oregon Sea Grant, Hawaii Sea Grant | Contact pages render but publish no email address. No-email guard. |
| Hakai Magazine, Yale Climate Connections, Adventure Journal | Contact form only |
| The Surfer's Journal | Subscriptions address only, no editorial |
| BeachGrit, Surfer.com, Weatherwise/tandfonline | 403 to all automated requests; contact unverifiable |

### Coverage gaps surfaced by this research

Worth a product ticket, not an email:

- **Long Beach Island, NJ** — zero coverage. LBI is one of the most-surfed stretches in NJ and has its
  own newspaper. Adding it unlocks The SandPaper as a target.
- Beware `surf-city`: the existing slug `surf-city-surf-city-nc` is **Surf City, North Carolina**.
  Surf City, NJ (on LBI) does not exist in the sitemap. Easy to confuse when picking a slug.
- **Rye, NH** (logged 2026-09-14) — no page. The only NH beach page is Hampton Beach. UMass Lowell's
  surfing trip page lists "Hampton/Rye" together, so the 09-14 follow-up had to tell them to keep
  their Rye link pointing elsewhere.

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

> **Contacts verified 2026-08-24.** Every address below was confirmed on the publication's own
> site (Cloudflare-obfuscated addresses decoded from `data-cfemail` / HTML-entity `mailto:`),
> except where the row says otherwise.

| Publication | DA | Contact (verified) | Angle | Status | Date |
|-------------|----|--------------------|-------|--------|------|
| The Inertia | 65 | contribute@theinertia.com | Transparency + ML angle | follow-up | 2026-08-25 |
| Outside Online | 90 | adventure@outsideinc.com | Outdoor sports + data | follow-up | 2026-08-25 |
| Eos (AGU) | 88 | eos@agu.org | Surfer-logged sessions as nearshore ground truth. **Two emails, not one:** a 2026-07-28 pitch to news@eos.org (ML vs NOAA accuracy data; found in Gmail 2026-09-14) came first. Follow-up exhausted; no response. | follow-up | 2026-08-25 |
| Coastal Review | 55 | markh@coastalreview.org | NC coast: buoy distance vs. what surfers report. **Corrected 2026-09-14:** the only email ever sent is the 2026-06-23 pitch, which linked `/forecast-accuracy`. The "follow-up" is a draft from 08-31 that is still unsent. Its copy breaks the current voice rules ("I should have circled back sooner", "rather than a plug", "with no expectation of a mention", "a one-line no is fine") and its "we can show where the model and the beach disagree" line is thin for the NC coast. Needs Steven: rewrite it in Gmail before sending, or delete it. Not stacked on. | sent | 2026-06-23 |
| Stab Magazine | 70 | michael@stabmag.com (editorial), buck@stabmag.com | AI / user-generated surf forecasting | responded | 2026-07-29 |
| Hawaii Public Radio | 72 | ccruz@hawaiipublicradio.org | HI wave models vs. observed conditions | responded | 2026-06-23 |
| Honolulu Civil Beat | 76 | news@civilbeat.org | HI forecast accuracy by break | declined | 2026-06-23 |
| Adventure Journal | 45 | **contact form only** — no email published on adventure-journal.com | Surf data story | rejected | |
| Weatherwise | 50 | **unverified** — `margaret.benner@taylorandfrancis.com` per a third-party writer's-market listing; weatherwise.org redirects to tandfonline.com, which returns 403 to automated requests, so this could not be confirmed on the publication's own site | Wave forecast methodology | rejected | |
| REI Co-op Journal | 80 | **unreachable** — rei.com/blog returns no response to automated requests; no editorial address found | Water sports safety | rejected | |

### Publications rejected this run (2026-08-24)

| Target | Reason |
|--------|--------|
| Hakai Magazine | Contact form only; no email, no submission address on hakaimagazine.com |
| The Surfer's Journal | Only `membership@surfersjournal.com` (subscriptions). No editorial address published |
| BeachGrit | beachgrit.com returns 403 to every automated request; could not verify. **It had already been pitched, though:** Gmail shows a 2026-07-28 send to derek@beachgrit.com ("Data: which surf forecasts got it most wrong in 2025", ML accuracy framing). No reply. Found 2026-09-14. |
| Surfer.com | surfer.com returns 403; could not verify |
| Yale Climate Connections | Contact form only; no email on the contact page |
| SurferToday | No email on `/contact`; already listed under Directory Submissions |

### Warm leads that went cold (needs Steven)

Three publication-lane targets replied and were never answered. These are worth more than any
cold pitch in this file:

| Target | Replied | Silent for | What they said |
|--------|---------|-----------|----------------|
| Stab Magazine | 2026-07-29 | 33 days (as of 08-31) | Michael: *"We're actually working on a piece about the user-generated, AI-based surf forecasting sites popping"* — and cc'd Buck to ask questions. Nobody replied. |
| Hawaii Public Radio | 2026-06-23 | 69 days (as of 08-31) | Catherine Cruz: *"Love to work something up!"* plus a cell number. Nobody replied. |
| Surf Simply | 2026-07-11 | 65 days as of 09-14; the 09-07 reply drafts were deleted unsent | Said they'd forward internally and have the team reach out. No follow-up from either side. Inbox-owned. |

Reply drafts for Stab and Hawaii Public Radio were created 2026-08-24. **Both are still unsent as of
2026-08-31** — a week later, with the silence a week longer. Surf Simply sits in the bloggers
rotation (week 2), not this one.

**2026-09-14:** the Stab and Hawaii Public Radio replies (re-drafted 08-31) are **still unsent**: Stab
47 days silent, HPR 83. The daily inbox owner tracks both as `draft_waiting_for_Steve`, overdue. This
routine does not touch them.

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
| June 2026 | 3 (Coastal Review, Hawaii Public Radio, HSS — HSS bounced) | 1 (Hawaii Public Radio) | 0 | 0 |
| July 2026 | **at least 9** (recounted from Gmail 2026-09-14 — 07-08: Surf Diva, Ben Gravy, Kale Brock, Surf Simply; 07-28: The Inertia, Outside Online, Stab, BeachGrit, Eos) | 2 (Stab, Surf Simply) | 0 | 0 |
| August 2026 | **43 sent** (34 through 08-25 + a 9-send 08-31 batch the 08-31 recount pre-dated) | 2 (Oregon Coast Today, Island Free Press — both landed in September) | 0 | 0 |
| September 2026 | **9 sent, 8 delivered** (09-07: Barefoot Surf, Hans Hedemann, Ken Merrill, Ron Jon · 09-08 19:03 PT follow-ups: OBX Surf School, Rincon Surf School, and Oregon Surf Adventures, which **bounced** · 09-14 09:28 PT follow-ups: NJ Sea Grant, Whatever Sportfishing) · unsent SEO drafts as of 09:40 PT 09-14: 3 warm-lead drafts from 08-31, the clean UML follow-up, plus 2 superseded drafts awaiting hand deletion | 3 (Island Free Press passed 09-02, Oregon Coast Today intrigued 09-04, Ken Merrill agreed 09-07) | **1 link placement** (capecodsurfrider.org, 2 links, live by 09-09; links, not an embed) | 0 confirmed (capecodsurfrider.org pending the 09-21 check) |

**Recounted 2026-08-31 from Gmail**, not from this file. The 08-24 recount said 15; the real August
figure is **34**. Two independent omissions, in opposite directions in time:

- The 08-24 count was taken *before* the 08-25 batch went out and was never revised, so all 15 of
  those sends were missing.
- **A 2026-08-03 batch of 7 had never been counted at any point.** This file records the 08-03
  initials for the three California schools but has no row at all for the other four. They are
  added under "Untracked 08-03 sends" below.

Third consecutive recount that found drift. Recount from `in:sent`, never from the rows.

August sends by date (34):
- **08-03 (7):** Surf Diva, Pacific Surf School, Corky Carroll's (initials, already recorded);
  **OBX Surf School, Moment Surf Co, Oregon Surf Adventures, Rincon Surf School (untracked)**
- **08-10 (3):** Cleanline, Shoreline OBX, Ho Stevie!
- **08-18 (8):** Cleanline (Short Sands), Inn at Cocoa Beach, Corolla Surf Shop, Surf N' Wear,
  Glide Surf Co, plus first follow-ups to Pacific Surf School, Surf Diva, Corky Carroll's
- **08-20 (1):** HSS Surf
- **08-25 (15):** Cleanline, Cannon Beach Surf Lessons, Safari Town, Padre Island Surf Camp,
  Cape Hatteras Surf School, Skudin, Whalebone; second follow-ups to Pacific Surf School, Surf Diva,
  Corky Carroll's; follow-ups to The Inertia and Outside Online; and the org lane — UW Sea Grant,
  Surfrider national, Eos/AGU

**Still 0 responses to any August cold email**, now across 34 sends rather than 15. A Gmail search
for inbound mail from all 14 cold shop/school domains contacted this month returns nothing at all. Checked Gmail
inbound through 2026-08-31: no outreach target replied. The only inbound mail in the window is
product-user feedback, which is a different lane. The three warm publication leads remain the only
replies outreach has ever produced, and all three are still unanswered — the reply drafts written on
08-24 have now sat unsent for a week.

The signal is no longer ambiguous. 34 cold emails in one month produced zero replies, while every
reply outreach has ever produced came from a publication pitch or a warm relationship — and all
three of those are still sitting unanswered in Drafts. **Cold volume is not the constraint; sending
the warm replies is.** 15 drafts are written and waiting.

**On the 0% reply rate (2026-08-10):** cold email to surf schools is notoriously low-response, so this
alone isn't a signal to change tactics. Two things worth fixing before the next batch goes out:
1. The embed freshness bug (`quiver/.planning/embed-freshness-fix-and-refactor-20260805.md`) blanks the
   widget on stale data — any school that checked the link after getting the email likely saw nothing.
   Wait for that fix to ship before sending more of this batch.
2. A direct Instagram DM or a reply to a target's most recent post may convert better than cold email
   for this audience — worth trying alongside (not instead of) email once volume picks back up.
