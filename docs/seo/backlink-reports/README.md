# Manual Backlink Imports

Drop free backlink exports here, or into the active `Brand-Vault/seo-audit/YYYY-MM-DD/` folder, before running `yarn seo:backlink-proxy`.

Auto-discovered filenames include:

- `AHREFS-WEBMASTER-TOOLS.csv`
- `MOZ-LINK-EXPLORER.csv`
- `GSC-LINKS.csv`
- `GOOGLE-SEARCH-CONSOLE-LINKS.csv`
- `MANUAL-BACKLINKS.csv`
- `BACKLINKS.csv`
- `REFERRING-DOMAINS.csv`

CSV/JSON imports are parsed for common columns such as `Referring page URL`, `Source URL`, `Source Domain`, `Referring Domain`, `Target URL`, `Link URL`, and `Landing Page`.
