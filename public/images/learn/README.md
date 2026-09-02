# Learn guide imagery

Every guide in `lib/data/learn-articles.ts` gets its own hero/thumbnail; the test in
`__tests__/lib/data/learn-articles.test.ts` fails if two guides share one.

## Sourced 2026-09-02 (Openverse → Flickr, Creative Commons)

Ledger: `scripts/data/learn-approved-photos.json`. Each licence was checked on the
Flickr source page, not just Openverse's metadata. Files are stored at native
resolution (1024px wide) as WebP q82 with no crop and no upscale — the repo's
`photos:download:seo` normalizer force-crops to 4:3 and upscales, which is wrong
for these panoramas. CC BY / BY-SA are used on the same "defensible" basis as the
beach photos in `public/images/seo-dioramas/README.md`.

| File | Guide | Title | Creator | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `learn-santa-cruz-west-cliff.webp` | `/learn/beginner-breaks-santa-cruz` | Surfing teens | Richard Masoner / Cyclelicious | CC BY-SA 2.0 | https://www.flickr.com/photos/99247795@N00/11898380106 |
| `learn-noaa-buoy.webp` | `/learn/how-quiver-calibrates-your-beach` | wea04459 | NOAA Photo Library | CC BY 2.0 | https://www.flickr.com/photos/51647007@N08/14319396909 |
| `learn-rip-current-sign.webp` | `/learn/what-is-a-rip-current` | Recurring Rip Currents | Peter Kaminski | CC BY 2.0 | https://www.flickr.com/photos/35034359460@N01/47920196 |
| `learn-minus-tide-twilight.webp` | `/learn/how-do-tides-work` | Mavericks minus tide twilight | j-dub1980(THANK YOU FOR 100k+ Views) | CC BY-SA 2.0 | https://www.flickr.com/photos/48048313@N02/6794705469 |
| `learn-first-waves.webp` | `/learn/how-long-to-learn-to-surf` | Sue Surfing | Joe Shlabotnik | CC BY 2.0 | https://www.flickr.com/photos/40646519@N00/243511224 |
| `learn-wetsuit-walk.webp` | `/learn/how-does-water-temperature-affect-surfing` | Surf Enthusiasts | Chris Hunkeler | CC BY-SA 2.0 | https://www.flickr.com/photos/14913305@N00/25710415542 |
| `learn-surf-check-from-the-bluff.webp` | `/learn/how-to-read-surf-conditions` | Surfers watching the waves from a cliff | donjd2 | CC BY 2.0 | https://www.flickr.com/photos/28156071@N00/8323018224 |

## Reassigned from elsewhere in `public/` (2026-09-02)

| File | Guide | Provenance |
| --- | --- | --- |
| `seo-dioramas/beginner/socal/bolsa-chica-photo.webp` | `/learn/beginner-breaks-orange-county` | Wikimedia, Jeff Turner, CC BY 2.0 — ledgered in `scripts/data/socal-beginner-approved-photos.json`. |
| `seo-dioramas/surf-cams/san-diego/san-diego-tourmaline-break-photo.webp` | `/learn/beginner-breaks-san-diego` | Same image as `images/tourmaline.png`, already live on-site. No ledger entry. |
| `seo-dioramas/surf-report/scripps-pier-today/scripps-clean-set-photo.webp` | `/learn/swell-period-explained` | Already live on `/surf-report/scripps-pier-today`. No ledger entry. |
| `seo-dioramas/surf-cams/hawaii/hawaii-misty-lineup-photo.webp` | `/learn/how-are-ocean-waves-formed` | Added with the surf-cams funnel pages (commit ffde4f016); was unused. No ledger entry. |

The older `learn-*.jpg` files in this directory predate the ledger and have no
recorded provenance.
