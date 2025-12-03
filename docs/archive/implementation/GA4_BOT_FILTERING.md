# GA4 Bot Traffic Filtering Guide

This guide explains how to configure Google Analytics 4 (GA4) to filter out bot traffic that pollutes your analytics data.

## Why Filter Bot Traffic?

Bots and crawlers (SEO tools, scrapers, automation scripts) can:
- Inflate page view counts
- Skew user behavior metrics
- Pollute geographic data
- Make it harder to understand real user patterns

## Server-Side Protection (Already Implemented)

Quiver has server-side bot blocking that:
- Returns 403 for detected bots on API endpoints
- Blocks known bad bots (AhrefsBot, SEMrushBot, etc.)
- Blocks requests missing `Accept-Language` header
- Allows good crawlers (Googlebot, Bingbot) for SEO

**Blocked Bot Patterns:**
```
ahrefsbot, semrushbot, mj12bot, blexbot, crunchbot, dataforseobot,
petalbot, bytespider, scrapy, curl, wget, python-requests, httpx,
go-http-client, java, puppeteer, playwright, selenium, node-fetch
```

## GA4 Bot Filtering Setup

### Step 1: Enable Built-in Bot Filtering

GA4 has automatic bot filtering, but you should verify it's enabled:

1. Go to **Admin** → **Data Streams**
2. Select your web stream
3. Click **More Tagging Settings**
4. Ensure **Exclude known bots** is enabled (usually on by default)

### Step 2: Create Internal Traffic Rules

To exclude specific bot traffic patterns:

1. Go to **Admin** → **Data Streams**
2. Click on your web stream
3. Click **Configure Tag Settings**
4. Click **Show All** → **Define Internal Traffic**
5. Click **Create** to add a new rule

### Step 3: Configure Bot Exclusion Rules

Create rules for these User-Agent patterns:

| Rule Name | Match Type | Value |
|-----------|------------|-------|
| SEO Bots | Contains | bot |
| SEO Bots 2 | Contains | spider |
| SEO Bots 3 | Contains | crawler |
| AhrefsBot | Contains | AhrefsBot |
| SEMrushBot | Contains | SEMrushBot |
| CrunchBot | Contains | CrunchBot |
| BLEXBot | Contains | BLEXBot |
| Python Scripts | Contains | python-requests |
| Curl Requests | Contains | curl |
| Node Fetch | Contains | node-fetch |
| Wget | Contains | wget |
| Scrapy | Contains | scrapy |

### Step 4: Apply the Filter

After creating the rules:

1. Go to **Admin** → **Data Settings** → **Data Filters**
2. Click **Create Filter**
3. Select **Internal Traffic**
4. Name: "Bot Traffic Filter"
5. Filter Operation: **Exclude**
6. Filter State: **Active**
7. Save

### Step 5: Verify the Filter

1. Wait 24-48 hours for data to accumulate
2. Check **Reports** → **Realtime** with a test
3. Compare traffic before/after filter activation

## IP-Based Exclusions (Optional)

If you identify specific bot IP ranges, you can also exclude by IP:

1. Go to **Admin** → **Data Streams** → **More Tagging Settings**
2. Click **Define Internal Traffic**
3. Add IP address rules for known bot networks

Common bot IP ranges to consider:
- Data center IP blocks (AWS, GCP, Azure)
- Known crawler IP ranges

## Monitoring Bot Traffic

### Using GA4 Explore

Create a custom exploration to monitor bot-like traffic:

1. Go to **Explore** → **Blank**
2. Add dimensions: `Device category`, `Browser`, `City`
3. Add metrics: `Sessions`, `Engagement rate`
4. Look for patterns:
   - 0% engagement rate
   - Unusual browsers
   - Data center cities

### Signs of Bot Traffic

- Sessions with 0 engagement
- Unusually high page views with no interactions
- Traffic from unexpected geographic locations
- Traffic at unusual hours
- Identical session patterns

## Best Practices

1. **Don't over-filter**: Start conservative and expand
2. **Monitor before filtering**: Understand baseline traffic
3. **Keep good bots**: Don't block Googlebot, Bingbot, social media crawlers
4. **Review regularly**: Bot patterns change over time
5. **Use server-side protection first**: GA4 filtering is secondary

## Related Documentation

- [Quiver API Rate Limiting](../docs/architecture/RATE_LIMITING_ARCHITECTURE.md)
- [Bot Detection Implementation](../lib/security/bot-detection.ts)
- [Bot Blocking Middleware](../lib/middleware/bot-blocker.ts)
