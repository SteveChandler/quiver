# Ahrefs Structured Data Triage

Last updated: 2026-06-09

## Status

- Template-level water-temperature coverage was updated to emit `Dataset` JSON-LD on dedicated city water-temp pages, matching the existing beach water-temp subpage pattern.
- Beach water-temp pages already emit `Dataset`, breadcrumb, WebPage, and FAQ structured data through the shared crawlable subpage renderer.
- No local Ahrefs issue export was available in this workspace, so unresolved Ahrefs structured-data rows are intentionally deferred until the next Site Audit export identifies exact issue names and example URLs.

## Resolution Policy

Fix immediately when Ahrefs reports:

- invalid JSON-LD syntax
- missing required schema fields on a supported schema type
- relative URLs where absolute URLs are required
- invalid dates or impossible `dateModified` / coverage windows
- broken breadcrumb chains
- template-level server-rendering gaps on utility pages

Defer and document when Ahrefs reports:

- unsupported rich-result opportunities
- deprecated FAQ or HowTo expansion requests
- "add more schema" recommendations without a truthful supported entity
- warnings that do not affect crawlability, indexability, or structured-data validity

## Next Audit Step

After raising the Ahrefs crawl limit, rerun Site Audit and sample at least:

- one city water-temp page
- one beach water-temp page
- `/best-time-to-surf/la-jolla`
- one tide page

Compare issue counts only after the crawl completes; uncrawled-link and issue-count movement before that is not reliable.
