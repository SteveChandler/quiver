# SEO Diorama Assets

This directory holds original Quiver-style raster assets for SEO funnel pages.

Rules:
- Generate originals with the `imagegen` built-in tool unless the user explicitly asks for the CLI fallback.
- Do not copy copyrighted surf photos or recreate a photographer's exact composition.
- Do not include real brand logos, readable text, watermarks, or signage.
- Keep each image location-specific, useful for the page intent, and saved under the path declared in `lib/seo/funnel-pages.ts`.
- If an asset is missing, the page renders a branded placeholder instead of a broken image.

Current config expects three image slots per included page:
- `longboard/{slug}/`
- `beginner/{slug}/`
- `surf-report/{slug}/`
- `surf-cams/{slug}/`

`/surf-cams/santa-cruz` is intentionally not included until Quiver has real Santa Cruz cam coverage.

TODO: Generate any missing `.webp` files from the `prompt` values in
`lib/seo/funnel-pages.ts`. Missing files are safe in production because
`SeoImageFrame` renders the branded placeholder card.
