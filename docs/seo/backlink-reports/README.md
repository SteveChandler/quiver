# Manual Backlink Imports

**Drop exports here, not in the dated audit folder.** Both locations are searched, but
`Brand-Vault/seo-audit/YYYY-MM-DD/` changes every week, so a file dropped there is invisible to the
next run. A file in *this* folder is picked up by every future run.

Append the capture date to the filename — `REFERRING-DOMAINS-2026-08-25.csv`. The stem still has to
match the allowlist below, and a trailing `-YYYY-MM-DD` is stripped before matching. The date is
reported as the export's capture date and ages into `lagged`/`stale` in the weekly report's source
freshness table; without it the file's mtime is used instead.

Auto-discovered filenames include:

- `AHREFS-WEBMASTER-TOOLS.csv`
- `MOZ-LINK-EXPLORER.csv`
- `GSC-LINKS.csv`
- `GOOGLE-SEARCH-CONSOLE-LINKS.csv`
- `MANUAL-BACKLINKS.csv`
- `BACKLINKS.csv`
- `REFERRING-DOMAINS.csv`

CSV/JSON imports are parsed for common columns such as `Referring page URL`, `Source URL`, `Source Domain`, `Referring Domain`, `Target URL`, `Link URL`, and `Landing Page`.
