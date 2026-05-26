# Blog Architecture

## Purpose

The `/blog` surface is a finite founder-notes and product-transparency system. It is not a CMS and should not drift into generic lifestyle publishing.

## Data Source

- Blog content lives in `lib/data/blog-posts.ts`.
- `getAllBlogPosts()` is the route-safe ordered list.
- `getFeaturedBlogPost()` is the latest post for the hub hero.
- `generateStaticParams()` and the sitemap must use the same helper-backed list.

## Route Contract

- `app/blog/page.tsx` renders the blog hub, collection schema, latest post, and all posts.
- `app/blog/[slug]/page.tsx` renders static blog articles from `BlogPost` data.
- Every post needs human title text, SEO title, SEO description, keywords, tags, hero image, sections, related links, and word count.
- Blog hub/post links that are part of the launch campaign use `LaunchBlogLink`
  so clicks remain measurable through existing `cta_click` events.

## SEO Contract

- `/blog` emits `WebPageSchema`, `BlogSchema`, and breadcrumbs.
- `/blog/[slug]` emits `WebPageSchema`, `ArticleSchema` with `BlogPosting`, and breadcrumbs.
- `app/sitemap.ts` must include the hub and every post.

## Launch Copy Rules

- Prefer founder notes, forecast transparency, session-log learning, and useful surf education tied to real Quiver routes.
- Avoid unsupported product claims, fake launch-delay framing, and generic lifestyle content.

## Launch Analytics

- Page views are enriched by `PageTracker` with `launch_campaign=go_live_2026_05`.
- Blog link clicks use `cta_family=launch_blog_cross_link` and coarse destination types.
- Do not add blog-only event types without updating `/api/events`, TypeScript unions, and the database event constraint together.
