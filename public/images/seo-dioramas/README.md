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

## Beach-Specific Photo Candidate Pipeline

Use the read-only candidate finder before replacing representative SEO images with real beach photos:

```bash
yarn photos:find:seo \
  --targets=scripts/data/socal-beginner-photo-targets.json \
  --out=docs/seo/photo-candidates/socal-beginner-photo-candidates.md \
  --jsonOut=docs/seo/photo-candidates/socal-beginner-photo-candidates.json \
  --limit=6 \
  --perTarget=3 \
  --source=wikimedia \
  --minScore=4
```

The finder queries Openverse for commercial-use Creative Commons images, defaults to Wikimedia, rejects NC/ND licenses, drops low-score matches, and writes local review artifacts only. It does not insert rows into Supabase or approve `beach_photos`; any selected image still needs a manual beach-match and license review before a migration or asset swap.

Approved SoCal beginner runtime photos are stored in
`scripts/data/socal-beginner-approved-photos.json` and downloaded with:

```bash
yarn photos:download:seo
```

The downloader normalizes approved sources to 1600x1200 WebP files under
`public/images/seo-dioramas/beginner/socal/`. Grey-license or official-page
discovery sources belong in the review report only; runtime pages should use
manifest entries with `licenseStatus: "defensible"` unless an internal exception
is explicitly approved.

Current approved runtime sources:

| Beach | Runtime asset | Source/creator/license |
| --- | --- | --- |
| Bolsa Chica | `beginner/socal/bolsa-chica-photo.webp` | Wikimedia/Openverse, Jeff Turner, CC BY 2.0 |
| Huntington State Beach | `beginner/socal/huntington-state-beach-photo.webp` | Wikimedia/Openverse, FASTILY, CC BY-SA 4.0 |
| Doheny State Beach | `beginner/socal/doheny-beach-photo.webp` | Wikimedia/Openverse, Orange County Archives, CC BY 2.0 |
| San Onofre State Beach | `beginner/socal/san-onofre-state-beach-photo.webp` | Wikimedia/Openverse, Xylem9, CC BY-SA 4.0 |
| La Jolla Shores | `beginner/socal/la-jolla-shores-photo.webp` | Wikimedia/Openverse, Dirk Hansen, CC BY-SA 3.0 |
| Tourmaline Surf Park | `beginner/socal/tourmaline-surf-park-photo.webp` | Wikimedia/Openverse, Invertzoo, CC BY-SA 3.0 |
| Santa Monica Beach | `beginner/socal/santa-monica-beach-santa-monica-ca-photo.webp` | Wikimedia/Openverse, Alexander Migl, CC BY-SA 4.0 |
| Will Rogers State Beach | `beginner/socal/will-rogers-state-beach-santa-monica-ca-photo.webp` | Wikimedia/Openverse, JCS, CC BY-SA 3.0 |
| Dockweiler State Beach | `beginner/socal/dockweiler-state-beach-playa-del-rey-ca-photo.webp` | Wikimedia/Openverse, Downtowngal, CC BY-SA 4.0 |
| Venice Beach | `beginner/socal/venice-beach-venice-ca-photo.webp` | Wikimedia/Openverse, DXR, CC0 1.0 |
| Torrance/RAT Beach | `beginner/socal/torrance-beach-rat-beach-torrance-ca-photo.webp` | Wikimedia/Openverse, D-Vu, CC BY-SA 4.0 |
| Refugio State Beach | `beginner/socal/refugio-state-beach-goleta-ca-photo.webp` | Wikimedia/Openverse, Tony Webster, CC BY-SA 2.0 |

TODO: Generate any missing `.webp` files from the `prompt` values in
`lib/seo/funnel-pages.ts`. Missing files are safe in production because
`SeoImageFrame` renders the branded placeholder card.
