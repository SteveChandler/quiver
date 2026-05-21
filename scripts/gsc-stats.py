"""
Google Search Console Dashboard
================================
Queries the GSC API and outputs a formatted markdown dashboard.

Requirements:
  - google-auth, google-api-python-client
  - Service account credentials at PROJECT_ROOT/gsc-credentials.json

Usage:
  /tmp/gsc-venv/bin/python3 scripts/gsc-stats.py

If the venv doesn't exist yet:
  python3 -m venv /tmp/gsc-venv
  /tmp/gsc-venv/bin/pip install google-auth google-api-python-client
"""

import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

from google.oauth2 import service_account
from googleapiclient.discovery import build

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SITE_URL = "https://www.quiversurf.app/"
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

# GSC data has a 2-3 day lag; treat "today" as 3 days ago.
TODAY = datetime.utcnow().date() - timedelta(days=3)
START_28D = (TODAY - timedelta(days=27)).isoformat()
END_28D = TODAY.isoformat()

# 7-day windows for new/established page comparison
START_LAST_7D = (TODAY - timedelta(days=6)).isoformat()
END_LAST_7D = TODAY.isoformat()
START_PRIOR_7D = (TODAY - timedelta(days=13)).isoformat()
END_PRIOR_7D = (TODAY - timedelta(days=7)).isoformat()

# Resolve credentials relative to the project root (parent of scripts/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = PROJECT_ROOT / "gsc-credentials.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_service():
    """Build an authenticated Search Console service."""
    if not CREDENTIALS_FILE.exists():
        print(f"ERROR: Credentials file not found at {CREDENTIALS_FILE}", file=sys.stderr)
        print("Place your service account JSON key at the project root as gsc-credentials.json", file=sys.stderr)
        sys.exit(1)

    credentials = service_account.Credentials.from_service_account_file(
        str(CREDENTIALS_FILE), scopes=SCOPES
    )
    return build("searchconsole", "v1", credentials=credentials)


def query_gsc(service, start_date, end_date, dimensions, row_limit=25000, order_by=None):
    """Execute a searchAnalytics.query request and return the response."""
    body = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": dimensions,
        "rowLimit": row_limit,
    }
    if order_by:
        # order_by should be a list of dicts, e.g. [{"fieldName": "clicks", "sortOrder": "DESCENDING"}]
        body["dimensionFilterGroups"] = []
    request = service.searchanalytics().query(siteUrl=SITE_URL, body=body)
    response = request.execute()
    return response.get("rows", [])


def fmt_num(n):
    """Format number with comma separators."""
    if isinstance(n, float):
        if n == int(n):
            return f"{int(n):,}"
        return f"{n:,.1f}"
    return f"{n:,}"


def fmt_pct(n):
    """Format a ratio (0-1) as a percentage string."""
    return f"{n * 100:.2f}%"


def fmt_pos(n):
    """Format average position."""
    return f"{n:.1f}"


def strip_domain(url):
    """Strip the site domain from a URL to show just the path."""
    prefix = SITE_URL.rstrip("/")
    if url.startswith(prefix):
        path = url[len(prefix):]
        return path if path else "/"
    return url


# ---------------------------------------------------------------------------
# Query runners
# ---------------------------------------------------------------------------

def get_overview(service):
    """Query 1: Overall 28-day totals."""
    rows = query_gsc(service, START_28D, END_28D, ["date"])
    total_clicks = sum(r["clicks"] for r in rows)
    total_impressions = sum(r["impressions"] for r in rows)
    avg_ctr = total_clicks / total_impressions if total_impressions else 0
    # Weighted average position (weighted by impressions)
    if total_impressions:
        avg_position = sum(r["position"] * r["impressions"] for r in rows) / total_impressions
    else:
        avg_position = 0
    return total_clicks, total_impressions, avg_ctr, avg_position


def get_daily_trend(service):
    """Query 6: Daily trend for last 28 days."""
    rows = query_gsc(service, START_28D, END_28D, ["date"])
    rows.sort(key=lambda r: r["keys"][0])
    return rows


def get_top_queries(service):
    """Query 2: Top 25 queries by clicks."""
    rows = query_gsc(service, START_28D, END_28D, ["query"], row_limit=25)
    rows.sort(key=lambda r: r["clicks"], reverse=True)
    return rows


def get_top_pages(service):
    """Query 3: Top 25 pages by clicks."""
    rows = query_gsc(service, START_28D, END_28D, ["page"], row_limit=25)
    rows.sort(key=lambda r: r["clicks"], reverse=True)
    return rows


def get_by_device(service):
    """Query 4: Performance by device."""
    rows = query_gsc(service, START_28D, END_28D, ["device"])
    rows.sort(key=lambda r: r["clicks"], reverse=True)
    return rows


def get_by_country(service):
    """Query 5: Performance by country."""
    rows = query_gsc(service, START_28D, END_28D, ["country"], row_limit=10)
    rows.sort(key=lambda r: r["clicks"], reverse=True)
    return rows


def get_page_comparison(service):
    """Query 7: Compare pages in last 7d vs prior 7d."""
    last_7d = query_gsc(service, START_LAST_7D, END_LAST_7D, ["page"], row_limit=25000)
    prior_7d = query_gsc(service, START_PRIOR_7D, END_PRIOR_7D, ["page"], row_limit=25000)

    last_map = {r["keys"][0]: r for r in last_7d}
    prior_map = {r["keys"][0]: r for r in prior_7d}

    # Newly appearing pages (in last 7d but not prior 7d)
    new_pages = []
    for url, row in last_map.items():
        if url not in prior_map:
            new_pages.append(row)
    new_pages.sort(key=lambda r: r["clicks"], reverse=True)

    # Biggest movers (pages present in both windows)
    movers = []
    for url, last_row in last_map.items():
        if url in prior_map:
            prior_row = prior_map[url]
            click_change = last_row["clicks"] - prior_row["clicks"]
            imp_change = last_row["impressions"] - prior_row["impressions"]
            movers.append({
                "page": url,
                "click_change": click_change,
                "imp_change": imp_change,
                "last_clicks": last_row["clicks"],
                "prior_clicks": prior_row["clicks"],
            })
    # Sort by absolute click change descending
    movers.sort(key=lambda m: abs(m["click_change"]), reverse=True)

    return new_pages[:20], movers[:20]


def get_anomalies(service):
    """Flag anomalous queries and pages."""
    anomalies = []

    # Queries with position < 10 but CTR < 2%
    queries = query_gsc(service, START_28D, END_28D, ["query"], row_limit=25000)
    low_ctr_good_rank = [
        r for r in queries
        if r["position"] < 10 and r["ctr"] < 0.02 and r["impressions"] >= 10
    ]
    low_ctr_good_rank.sort(key=lambda r: r["impressions"], reverse=True)

    # Pages with >100 impressions but 0 clicks
    pages = query_gsc(service, START_28D, END_28D, ["page"], row_limit=25000)
    zero_click_pages = [
        r for r in pages
        if r["impressions"] > 100 and r["clicks"] == 0
    ]
    zero_click_pages.sort(key=lambda r: r["impressions"], reverse=True)

    # Total clicks in last 7 days
    last_7d_daily = query_gsc(service, START_LAST_7D, END_LAST_7D, ["date"])
    total_7d_clicks = sum(r["clicks"] for r in last_7d_daily)

    return low_ctr_good_rank, zero_click_pages, total_7d_clicks


# ---------------------------------------------------------------------------
# Sitemap vs GSC comparison
# ---------------------------------------------------------------------------

SITEMAP_URL = "https://www.quiversurf.app/sitemap.xml"
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# Known intent prefixes used in routes like /{intent}/{city}
KNOWN_INTENTS = {
    "surf-report", "surf-forecast", "best-time-to-surf",
    "surf-conditions", "wave-forecast", "wind-forecast",
    "tide-chart", "water-temperature", "surf-cams",
    "surfing", "learn-to-surf",
}


def _fetch_xml(url):
    """Fetch a URL and parse it as XML, returning the ElementTree root."""
    req = urllib.request.Request(url, headers={"User-Agent": "QuiverGSC/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return ET.fromstring(resp.read())


def get_sitemap_urls():
    """Fetch the live sitemap and return a set of URL paths (stripped of domain).

    Handles both <sitemapindex> (fetches each sub-sitemap) and plain <urlset>.
    """
    root = _fetch_xml(SITEMAP_URL)
    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag

    locs = []

    if tag == "sitemapindex":
        # It is a sitemap index -- fetch each child sitemap
        for sitemap_el in root.findall("sm:sitemap/sm:loc", SITEMAP_NS):
            sub_url = sitemap_el.text.strip()
            try:
                sub_root = _fetch_xml(sub_url)
                for loc_el in sub_root.findall("sm:url/sm:loc", SITEMAP_NS):
                    locs.append(loc_el.text.strip())
            except Exception as exc:
                print(f"  Warning: could not fetch sub-sitemap {sub_url}: {exc}", file=sys.stderr)
    else:
        # Plain <urlset>
        for loc_el in root.findall("sm:url/sm:loc", SITEMAP_NS):
            locs.append(loc_el.text.strip())

    # Convert full URLs to paths
    paths = set()
    for loc in locs:
        parsed = urlparse(loc)
        path = parsed.path.rstrip("/") or "/"
        paths.add(path)

    return paths


def categorize_url(path):
    """Categorize a URL path into a human-readable bucket.

    Categories:
      - Beach page:    /{state}/{city}/{beach}  (3 segments, state is 2 chars)
      - Intent page:   /{intent}/{city}         (2 segments, first is known intent)
      - Location browse: /beaches/...
      - Other
    """
    segments = [s for s in path.strip("/").split("/") if s]

    if not segments:
        return "Home"

    first = segments[0]

    # Location browse pages
    if first == "beaches":
        return "Location browse (/beaches/...)"

    # Beach pages: /{state}/{city}/{beach} -- state slug is 2-letter or "baja"
    if len(segments) == 3:
        state = segments[0]
        if len(state) == 2 or state == "baja":
            return "Beach page"

    # Intent pages: /{intent}/{city}
    if len(segments) == 2 and first in KNOWN_INTENTS:
        return "Intent page"

    # Intent landing (no city): /{intent}
    if len(segments) == 1 and first in KNOWN_INTENTS:
        return "Intent landing"

    # State/city browse: /{state}/{city} (2-char state, but not an intent)
    if len(segments) == 2 and (len(first) == 2 or first == "baja") and first not in KNOWN_INTENTS:
        return "City page"

    # Catch common static pages
    if len(segments) == 1:
        return "Static page"

    return "Other"


def get_sitemap_comparison(service):
    """Compare sitemap URLs against GSC impression data over the last 28 days.

    Returns a dict with keys:
      sitemap_paths  - set of paths from the sitemap
      gsc_paths      - set of paths that got at least 1 impression in GSC
      indexed        - sitemap_paths & gsc_paths (intersection)
      not_indexed    - sitemap_paths - gsc_paths (in sitemap but not in GSC)
    """
    print("  Fetching sitemap...", file=sys.stderr)
    sitemap_paths = get_sitemap_urls()

    print(f"  Sitemap contains {len(sitemap_paths)} URLs. Querying GSC page data...", file=sys.stderr)
    rows = query_gsc(service, START_28D, END_28D, ["page"], row_limit=25000)

    gsc_paths = set()
    for row in rows:
        full_url = row["keys"][0]
        path = strip_domain(full_url)
        # Normalise: strip trailing slash
        path = path.rstrip("/") or "/"
        gsc_paths.add(path)

    indexed = sitemap_paths & gsc_paths
    not_indexed = sitemap_paths - gsc_paths

    return {
        "sitemap_paths": sitemap_paths,
        "gsc_paths": gsc_paths,
        "indexed": indexed,
        "not_indexed": not_indexed,
    }


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------

def _page_row(row):
    return {
        "page": strip_domain(row["keys"][0]),
        "clicks": row["clicks"],
        "impressions": row["impressions"],
        "ctr": row.get("ctr"),
        "position": row.get("position"),
    }


def _query_row(row):
    return {
        "query": row["keys"][0],
        "clicks": row["clicks"],
        "impressions": row["impressions"],
        "ctr": row.get("ctr"),
        "position": row.get("position"),
    }


def _dimension_row(row, key_name):
    return {
        key_name: row["keys"][0],
        "clicks": row["clicks"],
        "impressions": row["impressions"],
        "ctr": row.get("ctr"),
        "position": row.get("position"),
    }


def build_json_export(service):
    """Build the machine-readable export consumed by the weekly SEO workflow."""
    comparison = get_sitemap_comparison(service)
    last_7d = query_gsc(service, START_LAST_7D, END_LAST_7D, ["page"], row_limit=25000)
    prior_7d = query_gsc(service, START_PRIOR_7D, END_PRIOR_7D, ["page"], row_limit=25000)
    last_28d = query_gsc(service, START_28D, END_28D, ["page"], row_limit=25000)
    top_queries = get_top_queries(service)
    top_pages = get_top_pages(service)
    by_device = get_by_device(service)
    by_country = get_by_country(service)

    return {
        "generatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "siteUrl": SITE_URL,
        "dateRanges": {
            "last7d": {"start": START_LAST_7D, "end": END_LAST_7D},
            "prior7d": {"start": START_PRIOR_7D, "end": END_PRIOR_7D},
            "last28d": {"start": START_28D, "end": END_28D},
        },
        "last7d": [_page_row(row) for row in last_7d],
        "prior7d": [_page_row(row) for row in prior_7d],
        "last28d": [_page_row(row) for row in last_28d],
        "sitemapPaths": sorted(comparison["sitemap_paths"]),
        "topQueries": [_query_row(row) for row in top_queries],
        "topPages": [_page_row(row) for row in top_pages],
        "byDevice": [_dimension_row(row, "device") for row in by_device],
        "byCountry": [_dimension_row(row, "country") for row in by_country],
    }

def print_dashboard(service):
    """Run all queries and print the formatted markdown dashboard."""

    print(f"## Google Search Console Dashboard ({START_28D} to {END_28D})")
    print()

    # --- Overview ---
    total_clicks, total_impressions, avg_ctr, avg_position = get_overview(service)
    print("### Overview")
    print("| Metric | Value |")
    print("|--------|-------|")
    print(f"| Total Clicks | {fmt_num(total_clicks)} |")
    print(f"| Total Impressions | {fmt_num(total_impressions)} |")
    print(f"| Avg CTR | {fmt_pct(avg_ctr)} |")
    print(f"| Avg Position | {fmt_pos(avg_position)} |")
    print()

    # --- Daily Trend (show last 14 days for readability) ---
    daily = get_daily_trend(service)
    print("### Daily Trend (last 14 days)")
    print("| Date | Clicks | Impressions | CTR | Position |")
    print("|------|--------|-------------|-----|----------|")
    for row in daily[-14:]:
        date_str = row["keys"][0]
        print(f"| {date_str} | {fmt_num(row['clicks'])} | {fmt_num(row['impressions'])} | {fmt_pct(row['ctr'])} | {fmt_pos(row['position'])} |")
    print()

    # --- Top Queries ---
    queries = get_top_queries(service)
    print("### Top Queries")
    print("| # | Query | Clicks | Impressions | CTR | Position |")
    print("|---|-------|--------|-------------|-----|----------|")
    for i, row in enumerate(queries[:25], 1):
        q = row["keys"][0]
        print(f"| {i} | {q} | {fmt_num(row['clicks'])} | {fmt_num(row['impressions'])} | {fmt_pct(row['ctr'])} | {fmt_pos(row['position'])} |")
    print()

    # --- Top Pages ---
    pages = get_top_pages(service)
    print("### Top Pages")
    print("| # | Page | Clicks | Impressions | CTR | Position |")
    print("|---|------|--------|-------------|-----|----------|")
    for i, row in enumerate(pages[:25], 1):
        path = strip_domain(row["keys"][0])
        print(f"| {i} | {path} | {fmt_num(row['clicks'])} | {fmt_num(row['impressions'])} | {fmt_pct(row['ctr'])} | {fmt_pos(row['position'])} |")
    print()

    # --- By Device ---
    devices = get_by_device(service)
    print("### By Device")
    print("| Device | Clicks | Impressions | CTR | Position |")
    print("|--------|--------|-------------|-----|----------|")
    for row in devices:
        device = row["keys"][0].capitalize()
        print(f"| {device} | {fmt_num(row['clicks'])} | {fmt_num(row['impressions'])} | {fmt_pct(row['ctr'])} | {fmt_pos(row['position'])} |")
    print()

    # --- By Country ---
    countries = get_by_country(service)
    print("### By Country")
    print("| Country | Clicks | Impressions | CTR | Position |")
    print("|---------|--------|-------------|-----|----------|")
    for row in countries:
        country = row["keys"][0].upper()
        print(f"| {country} | {fmt_num(row['clicks'])} | {fmt_num(row['impressions'])} | {fmt_pct(row['ctr'])} | {fmt_pos(row['position'])} |")
    print()

    # --- New Pages & Movers ---
    new_pages, movers = get_page_comparison(service)

    print(f"### Newly Appearing Pages (last 7d: {START_LAST_7D} to {END_LAST_7D}, not in prior 7d)")
    if new_pages:
        print("| # | Page | Clicks | Impressions |")
        print("|---|------|--------|-------------|")
        for i, row in enumerate(new_pages[:15], 1):
            path = strip_domain(row["keys"][0])
            print(f"| {i} | {path} | {fmt_num(row['clicks'])} | {fmt_num(row['impressions'])} |")
    else:
        print("No newly appearing pages in this window.")
    print()

    print(f"### Biggest Movers (last 7d vs prior 7d)")
    if movers:
        print("| # | Page | Clicks (now) | Clicks (prior) | Change | Imp Change |")
        print("|---|------|-------------|----------------|--------|------------|")
        for i, m in enumerate(movers[:15], 1):
            path = strip_domain(m["page"])
            sign_c = "+" if m["click_change"] >= 0 else ""
            sign_i = "+" if m["imp_change"] >= 0 else ""
            print(f"| {i} | {path} | {fmt_num(m['last_clicks'])} | {fmt_num(m['prior_clicks'])} | {sign_c}{fmt_num(m['click_change'])} | {sign_i}{fmt_num(m['imp_change'])} |")
    else:
        print("No comparable pages found in both windows.")
    print()

    # --- Anomaly Flags ---
    low_ctr_good_rank, zero_click_pages, total_7d_clicks = get_anomalies(service)

    print("### Anomaly Flags")
    print()

    if total_7d_clicks < 10:
        print(f"- **LOW TRAFFIC WARNING:** Only {total_7d_clicks} total clicks in the last 7 days.")
        print()

    if low_ctr_good_rank:
        print(f"**Ranking well (position < 10) but low CTR (< 2%) -- {len(low_ctr_good_rank)} queries:**")
        print("| Query | Position | CTR | Impressions |")
        print("|-------|----------|-----|-------------|")
        for row in low_ctr_good_rank[:10]:
            q = row["keys"][0]
            print(f"| {q} | {fmt_pos(row['position'])} | {fmt_pct(row['ctr'])} | {fmt_num(row['impressions'])} |")
        print()
    else:
        print("- No queries with position < 10 and CTR < 2%.")
        print()

    if zero_click_pages:
        print(f"**Pages with >100 impressions but 0 clicks -- {len(zero_click_pages)} pages:**")
        print("| Page | Impressions | Position |")
        print("|------|-------------|----------|")
        for row in zero_click_pages[:10]:
            path = strip_domain(row["keys"][0])
            print(f"| {path} | {fmt_num(row['impressions'])} | {fmt_pos(row['position'])} |")
        print()
    else:
        print("- No pages with >100 impressions and 0 clicks.")
        print()

    # --- Sitemap vs Index Coverage ---
    try:
        comparison = get_sitemap_comparison(service)
        sitemap_paths = comparison["sitemap_paths"]
        indexed = comparison["indexed"]
        not_indexed = comparison["not_indexed"]
        gsc_paths = comparison["gsc_paths"]

        total_sitemap = len(sitemap_paths)
        total_indexed = len(indexed)
        total_not_indexed = len(not_indexed)
        pct_indexed = total_indexed / total_sitemap if total_sitemap else 0

        print("### Sitemap vs Index Coverage")
        print()
        print(f"Sitemap URL: `{SITEMAP_URL}`")
        print()
        print("| Metric | Value |")
        print("|--------|-------|")
        print(f"| Sitemap URLs | {fmt_num(total_sitemap)} |")
        print(f"| URLs with GSC impressions (28d) | {fmt_num(total_indexed)} |")
        print(f"| URLs NOT in GSC data | {fmt_num(total_not_indexed)} |")
        print(f"| Coverage (indexed %) | {fmt_pct(pct_indexed)} |")
        print(f"| GSC pages not in sitemap | {fmt_num(len(gsc_paths - sitemap_paths))} |")
        print()

        # --- Breakdown by category ---
        # Build category stats for sitemap URLs
        cat_total = {}
        cat_indexed = {}
        cat_not_indexed_urls = {}  # store actual URLs for "top un-indexed" section

        for path in sitemap_paths:
            cat = categorize_url(path)
            cat_total[cat] = cat_total.get(cat, 0) + 1
            if path in indexed:
                cat_indexed[cat] = cat_indexed.get(cat, 0) + 1
            else:
                cat_not_indexed_urls.setdefault(cat, []).append(path)

        # Sort categories by total count descending
        sorted_cats = sorted(cat_total.keys(), key=lambda c: cat_total[c], reverse=True)

        print("**Breakdown by URL pattern:**")
        print()
        print("| Category | Sitemap | Indexed | Not Indexed | Coverage |")
        print("|----------|---------|---------|-------------|----------|")
        for cat in sorted_cats:
            t = cat_total[cat]
            idx = cat_indexed.get(cat, 0)
            nidx = t - idx
            pct = idx / t if t else 0
            print(f"| {cat} | {fmt_num(t)} | {fmt_num(idx)} | {fmt_num(nidx)} | {fmt_pct(pct)} |")
        print()

        # --- Top un-indexed URL categories ---
        # Show categories with the most un-indexed URLs, plus sample URLs
        cats_by_gap = sorted(
            [(cat, urls) for cat, urls in cat_not_indexed_urls.items()],
            key=lambda x: len(x[1]),
            reverse=True,
        )

        if cats_by_gap:
            print("**Top un-indexed categories (with sample URLs):**")
            print()
            for cat, urls in cats_by_gap[:5]:
                print(f"- **{cat}** -- {fmt_num(len(urls))} un-indexed")
                for sample in sorted(urls)[:5]:
                    print(f"  - `{sample}`")
            print()
        else:
            print("All sitemap URLs appear in GSC data.")
            print()

        print("_Note: \"Indexed\" here means the page received at least 1 impression in GSC over 28 days._")
        print("_Pages may be indexed by Google but simply not shown for any queries in this window._")
        print()

    except Exception as exc:
        print("### Sitemap vs Index Coverage")
        print()
        print(f"**Error:** Could not fetch or compare sitemap: {exc}")
        print()
        print("Check the GSC UI at https://search.google.com/search-console for:")
        print("- Index coverage reports (valid, excluded, error pages)")
        print("- Page experience metrics")
        print("- Core Web Vitals")
        print()

    print("---")
    print(f"_Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | Data range: {START_28D} to {END_28D}_")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Query Google Search Console for Quiver SEO reporting.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON to stdout.")
    parser.add_argument("--json-output", help="Write machine-readable JSON to this file.")
    args = parser.parse_args()

    service = get_service()

    if args.json or args.json_output:
        export = build_json_export(service)
        output = json.dumps(export, indent=2, sort_keys=True) + "\n"
        if args.json_output:
            output_path = Path(args.json_output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(output)
            print(f"Wrote {output_path}")
        else:
            print(output, end="")
    else:
        print_dashboard(service)
