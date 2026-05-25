# Blog Components Architecture

## Purpose

Blog components keep the finite founder-notes surfaces observable without turning
the blog into a CMS.

## Active Components

- `launch-blog-link.tsx` wraps launch blog links and records existing
  `cta_click` events with launch campaign metadata. It must not introduce new
  event types, checkout claims, or outbound side effects.

## Tracking Contract

- Blog route page views are enriched centrally by `PageTracker`.
- Blog link clicks use `cta_family=launch_blog_cross_link`.
- Destination classification stays coarse: pricing, forecast, beach, learn,
  roadmap, session log, App Store/TestFlight, site, or external.
