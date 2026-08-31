# SEO Outreach Tracker

Last updated: 2026-08-31

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
| `declined` | Target declined or no response after follow-up |
| `rejected` | Investigated and ruled out for cause (dead domain, no email, unverifiable). Never offered as a candidate. Rows in any "Rejected" table are treated as `rejected` automatically. |
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
| Surf Diva | surfdiva.com | `la-jolla-shores` | askadiva@surfdiva.com | follow-up | 2026-08-18 | Initial 2026-08-03. **Follow-up sent 2026-08-18.** **A second follow-up was sent 2026-08-25** — Steven sent it rather than deleting it, so this target has now had three emails. That is one more than the routine allows; do not contact again. Set to `declined` if silent by 2026-09-08. |
| Pacific Surf School | pacificsurfschool.com | `pacific-beach` | pacificsurf@pacificsurf.org | follow-up | 2026-08-18 | Initial 2026-08-03. **Follow-up sent 2026-08-18.** **A second follow-up was sent 2026-08-25** — Steven sent it rather than deleting it, so this target has now had three emails. That is one more than the routine allows; do not contact again. Set to `declined` if silent by 2026-09-08. |
| Corky Carroll's Surf School | corkysurfschool.com | `huntington-beach-pier` | info@surfschool.net | follow-up | 2026-08-18 | Initial 2026-08-03. **Follow-up sent 2026-08-18.** **A second follow-up was sent 2026-08-25** — Steven sent it rather than deleting it, so this target has now had three emails. That is one more than the routine allows; do not contact again. Set to `declined` if silent by 2026-09-08. |
| Santa Cruz Surf School | santacruzsurfschool.com | `steamer-lane-santa-cruz-ca` | **needs manual check** — site 200, no email/phone in raw HTML (JS-rendered) | queued | | |
| Nor Cal Surf Shop | norcalsurfshop.com | `linda-mar-pacifica-ca` | mia@norcalsurfshop.com | drafted | 2026-08-31 | Contact form also present. Draft **rewritten in place 2026-08-31 10:2x PT** — the original carried the false "ML-tuned forecasts" claim, the doubled-`your` subject, and school/student wording aimed at a shop. Now pitches the verified Linda Mar page as a shop, not a school. Awaiting Steven. |

### Hawaii
| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |
|--------|---------|---------------------------|----------------------------|--------|------|-------|
| Hans Hedemann Surf School | hhsurf.com | `waikiki-beach` | info@hhsurf.com | drafted | 2026-08-31 | **Runs own YouTube cam `c5vgnhcxgYU`** — lead with the cam partnership, not the widget. Draft **rewritten in place 2026-08-31 10:2x PT** — the original carried the false "ML-tuned forecasts" claim, the doubled-`your` subject, and ignored the cam angle. It now leads with the cam offer and links the verified Waikiki Beach page. Awaiting Steven. |
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

| Target | Website/Channel | Contact | Status | Date | Notes |
|--------|----------------|---------|--------|------|-------|
| Ben Gravy | YouTube 520K | **no email found** | queued | | East Coast angle. No published address — needs a DM or manual contact research before it can be drafted. |
| Kale Brock | kalebrock.com.au | gee@kalebrock.com.au | sent | 2026-07-08 | **Sent, not drafted** — tracker previously said "drafted 2026-07-14". No response. An unsent 2026-08-20 draft targets a *second* address (`hello@kalebrock.com.au`); treat it as the one permitted follow-up, or delete it. Do not send both. |
| Surf Simply | surfsimply.com | info@surfsimply.com | responded | 2026-07-11 | **They replied** on 07-11: forwarding internally, team would reach out. Nobody did, and Quiver never followed up. See Warm leads. |
| Barefoot Surf | barefootsurftutorials.com | support@barefootsurftutorials.com | drafted | 2026-08-20 | Unsent draft in Gmail |

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
rotation.** Set this row to `declined` if nothing comes back by 2026-09-08.

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
| OBX Surf School | info@obxsurfschool.com | Outer Banks, NC | `nags-head-nags-head-nc` | sent | 2026-08-03 | Site now returns **403 to automated requests** with a browser UA — treat as unverifiable for any future claim about their page. Follow-up eligible; deferred, see below. |
| Moment Surf Co | info@momentsurfco.com | Pacific City, OR | `pacific-city-cape-kiwanda` | sent | 2026-08-03 | Shop, not a school. Cape Kiwanda is their own beach — no proximity substitution needed. Follow-up eligible; deferred. |
| Oregon Surf Adventures | info@oregonsurfadventures.com | OR coast | `pacific-city-cape-kiwanda` | sent | 2026-08-03 | Confirm their actual town from their own site before drafting a follow-up; do not reuse this slug on assumption. Follow-up eligible; deferred. |
| Rincon Surf School | info@rinconsurfschool.com | Rincón, Puerto Rico | `marias` | sent | 2026-08-03 | Quiver has 19 PR beaches; Marías and Tres Palmas are both in Rincón. Follow-up eligible; deferred. |

**No reply from any of the four.** A Gmail search across all four domains returns nothing.

**Follow-ups are eligible but were not drafted.** All four passed the 14-day mark weeks ago, and
surf-schools *is* this week's rotation category — so the only thing holding them is the Step 4
backlog stop. Draft them in the next run that starts with a clear Drafts folder, one follow-up each,
and then set them to `declined` if silent.

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
| Island Free Press | Local news, Hatteras & Ocracoke NC | donna@islandfreepress.org, cc joy@islandfreepress.org | `cape-hatteras-lighthouse-buxton-nc`, `s-turns-rodanthe-nc` | drafted | Their entire coverage area is Hatteras Island, where Quiver has Buxton, Rodanthe, Nags Head, Kill Devil Hills, Corolla. Closest geographic fit in the file. |
| Oregon Coast Today | Local news, Central OR coast | gammerman@oregoncoasttoday.com — **Gretchen Ammerman, editor** (confirmed on their About page) | `nelscott-reef-lincoln-city-or` | drafted | Based in Lincoln City; Quiver has Nelscott Reef there plus 15 other OR towns. Publisher Patrick Alexander is at palexander@oregoncoasttoday.com if the editor doesn't bite. |
| Surfrider Foundation (national) | NGO / media | media@surfrider.org | n/a | drafted | High-authority `.org`. See the Cape Cod chapter row below — chapter-level is where the links actually live. |
| Puerto Rico Sea Grant (UPRM) | `.edu` research/extension | seagrant@uprm.edu | `tres-palmas` (Rincón) | drafted | Quiver has 19 PR beaches across 8 towns. Tres Palmas is a designated marine reserve — squarely Sea Grant's subject matter, not a commercial pitch. |
| NJ Sea Grant Consortium | `.org` research/extension | skreisler@njseagrant.org — **Samantha Kreisler, Director of Communications** (confirmed on their staff page) | `asbury-park-asbury-park-nj` | drafted | 26 NJ beaches across 13 towns. They publish rip-current and coastal-safety material. |
| Washington Sea Grant (UW) | `.edu` research/extension | seagrant@uw.edu | `westport-beach` | drafted | 13 WA beaches. Westport is the state's main surf town. |

`.edu` and `.org` links from Sea Grant and Surfrider are worth materially more than a surf-shop
footer link, and these organisations publish "coastal resources" pages that already link out to
third-party tools. The pitch is a safety/conditions resource, not a product.

### Re-engage — someone already said yes and it was never collected

| Target | Contact | What happened |
|--------|---------|---------------|
| Ken Merrill — Cape Cod Surfrider | ken.merrillcc@gmail.com | **Drafted 2026-08-24** into the original thread, with Coast Guard Beach (Eastham) and Nauset Beach (Orleans) links — both verified 200 and rendering. On **2026-05-13** Ken replied *"I'll reset with your new links. Sounds great."* — agreeing to swap Magicseaweed/Surfline links for Quiver on the chapter's surf report page. **Verified 2026-08-24: it never happened.** capecodsurfrider.org still links Surfline, and the site contains zero Quiver references (the one "quiver" hit is a surfer describing his board quiver). An agreed-to `.org` backlink has been sitting uncollected for 3½ months. Cheapest win in this entire file. **Re-verified 2026-08-31: still uncollected.** capecodsurfrider.org returns 200, contains zero `quiversurf` references, and still links `surfline.com/surf-report/long-sands-beach` for the report/cam. The 08-24 reply draft is still sitting unsent in Drafts. |

### MagicSeaweed replacement drafts — 2026-08-25

| Target | Contact | Status | Replacement offered | Notes |
|--------|---------|--------|---------------------|-------|
| Odyssey Surf School | info@odysseysurfschool.com | drafted | `/learn/how-to-read-surf-conditions` | Address and source page re-verified live. |
| UMass Lowell Outdoor Adventure | OutdoorAdventure@uml.edu | drafted | Hampton Beach and Narragansett Town Beach | Rye is not covered; the draft explicitly excludes it. |
| Whatever Sportfishing | freddy@foxwatersports.com | drafted | Cape Hatteras Lighthouse forecast | Whatever's own page publishes the cross-domain address. |

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
| Eos (AGU) | 88 | eos@agu.org | Surfer-logged sessions as nearshore ground truth | sent | 2026-08-25 |
| Coastal Review | 55 | markh@coastalreview.org | NC coast: buoy distance vs. what surfers report | follow-up | 2026-08-24 |
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
| BeachGrit | beachgrit.com returns 403 to every automated request; could not verify |
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
| Surf Simply | 2026-07-11 | 51 days (as of 08-31) | Said they'd forward internally and have the team reach out. No follow-up from either side. |

Reply drafts for Stab and Hawaii Public Radio were created 2026-08-24. **Both are still unsent as of
2026-08-31** — a week later, with the silence a week longer. Surf Simply sits in the bloggers
rotation (week 2), not this one.

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
| July 2026 | 4 (The Inertia, Outside Online, Stab, Surf Simply, Kale Brock) | 2 (Stab, Surf Simply) | 0 | 0 |
| August 2026 | 34 sent · 15 unsent drafts carried | 0 | 0 | 0 |

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
