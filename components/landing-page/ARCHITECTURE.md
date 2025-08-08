# Landing Page Architecture

## Purpose

Growth-focused marketing surface. Communicates value, showcases features, and supports SEO.

## Sections

- `hero-section.tsx` — looping video/image with CTA
- `features-section.tsx` + `feature-card.tsx` — animated feature grid
- `forecast-section.tsx` — illustrative forecast cards (static data)
- `cta-section.tsx` — conversion CTA
- `social-feed-section.tsx` — recent content teasers (optional)

## Patterns

- Responsive-first; minimal blocking scripts
- Defer heavy media; use optimized `<video>` fallbacks and image placeholders
- Copy sourced for honesty and clarity (no inflated claims)
- Structured data configured via `components/seo/` and `lib/seo/meta.ts`

## Testing

- Component tests for content presence and responsive breakpoints
- Lighthouse/Perf gates in CI optional; manual `npm run perf:test`

## Related Docs

- `components/seo/ARCHITECTURE.md`
- `docs/ARCHITECTURE_REVIEW.md`
