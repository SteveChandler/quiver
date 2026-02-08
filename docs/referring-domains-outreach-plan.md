# Referring Domains Outreach Plan

## Goal

+20 new referring domains in 90 days using embeddable widgets, competitive outreach, and content marketing.

---

## Phase 1: Seed with Your Own Network (Week 2-3)

- Personally email 10-20 surf shops/schools in San Diego and LA
- Offer to set it up for them (copy-paste the embed code into their site)
- Get 3-5 live embeds as case studies

## Phase 2: Targeted Cold Outreach (Ongoing)

### Target Categories

| Target | How to find 50+ contacts | Email pitch |
|--------|-------------------------|-------------|
| **Surf shops** | Google "[city] surf shop" for each city in your database | "Free live tide chart for [beach name]. Paste this code, done in 30 seconds." |
| **Surf schools** | Google "[city] surf lessons" | "Your students check tides before lessons. Here's a free tide widget for your booking page." |
| **Tourism / visitor bureaus** | Google "[city] visitors bureau" or "[county] tourism" | "We provide free real-time beach conditions for all [X] beaches in [city]." |
| **Marinas & harbors** | Google "[city] marina" or "[city] harbor" | "Boaters and fishermen need tide data. Here's a free embeddable chart for [nearest beach]." |
| **Beachfront hotels** | Google "[beach] hotel" or check TripAdvisor | "Your guests ask about surf conditions. Embed our free forecast widget on your activities page." |
| **Beach rental companies** | Google "[city] surfboard rental" or "beach gear rental" | "Add live conditions to your rental page so customers know what to expect." |

### Conversion Expectations

| Outreach batch | Emails sent | Expected embeds | New referring domains |
|---------------|-------------|-----------------|----------------------|
| San Diego surf shops | 20 | 3-5 | 3-5 |
| SoCal surf schools | 30 | 4-7 | 4-7 |
| CA tourism boards | 15 | 2-3 | 2-3 |
| Marinas & harbors | 20 | 2-4 | 2-4 |
| Hotels & rentals | 15 | 1-2 | 1-2 |
| **Total** | **100** | **12-21** | **12-21** |

## Phase 3: Scale with Content Marketing (Month 2+)

- Write a blog post: "How Surf Shops Are Using Live Tide Widgets"
- Feature the shops that embedded your widget (they'll share it)
- Submit to Product Hunt under "Tools for Local Businesses"
- Post in surf industry Facebook groups and forums

---

## Competitive Backlink Analysis

### Step-by-step (using Ahrefs)

1. Enter `surfline.com`, `magicseaweed.com`, `wannasurf.com` into Site Explorer
2. Go to "Referring Domains" > filter dofollow, sort by Domain Rating
3. Find "serial linkers" (domains linking 10-50x to competitors)
4. These are sites that regularly link to surf content and are likely to link to Quiver

### Broken Link Building

- Search competitors' backlinks for 404 pages
- Find sites linking to dead pages on Surfline/MSW
- Email them: "That page is gone -- here's our equivalent on Quiver"

### HARO / Journalist Queries

- Sign up for Help a Reporter Out (Connectively) or Qwoted
- Respond to queries about beach travel, surfing, ocean safety
- Each media mention = high-authority referring domain

---

## Email Template (Ready to Use)

> Subject: Free tide chart widget for [their website name]
>
> Hi [name],
>
> I'm Steven, founder of Quiver. I noticed your website for [their business] near [beach name].
>
> I built a free, real-time tide chart that you can embed on your site in 30 seconds. It auto-updates with live data for [beach name] -- no maintenance needed on your end.
>
> Here's a live preview: https://quiversurf.app/ca/san-diego/blacks/tides
>
> To add it, just paste this one line into your site:
> ```html
> <iframe src="https://quiversurf.app/embed/tides/[slug]" width="100%" height="300" frameborder="0"></iframe>
> ```
>
> No cost, no account needed. We just include a small "Powered by Quiver" credit link.
>
> Want me to help you set it up?
>
> -- Steven

---

## Automated Research with OpenClaw

### Setup

```bash
git clone https://github.com/clawdbot/clawdbot.git openclaw
cd openclaw
./docker-setup.sh
# Access at http://127.0.0.1:18789/
```

### Research Prompts

1. "Research surf shops in San Diego, CA that have their own website. For each, find: business name, website URL, contact email, and nearest beach. Save results to a CSV file."
2. "Research surf schools in Orange County, CA with websites. Find: business name, website, contact email, location. Save to CSV."
3. "Find tourism boards and visitor bureaus for coastal cities in California. Get: organization name, website, contact page URL. Save to CSV."
4. "Research marinas and harbors in Southern California. Find: name, website, contact email. Save to CSV."
5. "Find beachfront hotels near popular surf spots in San Diego. Get: hotel name, website, activities page URL if it exists. Save to CSV."

### Scale

Run one prompt per city cluster. Start with SoCal (San Diego, LA, Orange County), then expand to NorCal, Hawaii, Florida, etc.

---

## Verification

- Track referring domains in Ahrefs weekly
- Monitor new backlinks via Ahrefs Alerts
- Google Search Console > Links report
- Goal: **+20 new referring domains in first 90 days**
