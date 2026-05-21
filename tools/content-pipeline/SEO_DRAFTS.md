# SEO Draft Queue

Drafts in `output/seo-drafts/` are review artifacts only. They are not app runtime content and should not be published, committed as articles, or copied into `learnArticles` without manual approval.

Use the current workflow scripts from the project root:

```bash
yarn seo:keyword-bank
yarn seo:gsc-refresh --input path/to/gsc-export.json
yarn seo:technical-audit
yarn seo:enrich --source vercel --input path/to/vercel-export.json
yarn seo:enrich --source posthog --input path/to/posthog-export.json
yarn seo:enrich --source ahrefs --input path/to/ahrefs-export.json
yarn seo:recommend --input seo-audit/YYYY-MM-DD/GSC-REFRESH.json --input seo-audit/YYYY-MM-DD/TECHNICAL-AUDIT.json
```

Reuse embedded skill guidance while reviewing drafts:

- `seo-plan` for keyword queue and cannibalization discipline.
- `seo-content` for E-E-A-T, answer-first structure, and citation readiness.
- `seo-technical` for indexability and metadata checks.
- `seo-audit` for final priority labels and action-list shape.

Optional enrichment sources:

- Vercel: page demand and Core Web Vitals.
- PostHog: click-around, related-path usage, and signup behavior after landing.
- Ahrefs: external crawl, rankings, backlinks, and keyword opportunities.

Draft requirements:

- Include frontmatter with `status: review-queue` and `publishing: manual-approval-required`.
- Include target keyword, competing internal URLs, citations, and required Quiver internal links.
- Use Quiver product context from `.claude/product-marketing-context.md`.
- Cite factual claims with trusted sources, favoring NOAA, NDBC, CDIP, NWS, `.gov`, and `.edu`.
- Structure educational drafts with a TL;DR, question-style headings, direct answers, FAQs, and links to forecast, tide, water-temp, best-time, guides, and relevant beach/city pages.
