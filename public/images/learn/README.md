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

## Sourced 2026-10-13 (Openverse → Flickr, Creative Commons)

Same method as above: licence checked on each Flickr source page, native size
(1000–1024px wide), WebP q82, no crop, no upscale.

| File | Guide | Title | Creator | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `learn-carlsbad-state-beach-learner.webp` | `/learn/beginner-breaks-carlsbad` | Carlsbad State Beach California | Steve Ginn (oldsport500) | CC0 1.0 | https://www.flickr.com/photos/135553449@N08/27427022086 |
| `learn-small-beach-break-peaks.webp` | `/learn/beginner-breaks-carlsbad` | Tamarack Beach | surfcrs | CC BY 2.0 | https://www.flickr.com/photos/31487723@N00/3976300684 |
| `learn-south-ponto-minus-tide.webp` | `/learn/beginner-breaks-carlsbad` | South Ponto Beach, Carlsbad February 9th 2013 | Tim Buss | CC BY 2.0 | https://www.flickr.com/photos/30492852@N00/8459272345 |
| `learn-south-carlsbad-lineup.webp` | `/learn/beginner-breaks-carlsbad` | surfers, South Carlsbad State Beach | bossco | CC BY-SA 2.0 | https://www.flickr.com/photos/43521640@N00/45185467662 |

## Reassigned from elsewhere in `public/` (2026-09-02)

| File | Guide | Provenance |
| --- | --- | --- |
| `seo-dioramas/beginner/socal/bolsa-chica-photo.webp` | `/learn/beginner-breaks-orange-county` | Wikimedia, Jeff Turner, CC BY 2.0 — ledgered in `scripts/data/socal-beginner-approved-photos.json`. |
| `seo-dioramas/surf-cams/san-diego/san-diego-tourmaline-break-photo.webp` | `/learn/beginner-breaks-san-diego` | Same image as `images/tourmaline.png`, already live on-site. No ledger entry. |
| `seo-dioramas/surf-report/scripps-pier-today/scripps-clean-set-photo.webp` | `/learn/swell-period-explained` | Already live on `/surf-report/scripps-pier-today`. No ledger entry. |
| `seo-dioramas/surf-cams/hawaii/hawaii-misty-lineup-photo.webp` | `/learn/how-are-ocean-waves-formed` | Added with the surf-cams funnel pages (commit ffde4f016); was unused. No ledger entry. |

## Sourced 2026-10-20 (Wikimedia Commons, Creative Commons / public domain)

Openverse's search endpoint returned 504s all run, so these were found through the
Wikimedia Commons API and the licence was checked on each source page (the Flickr
original where Commons mirrors one, otherwise the Commons file page). WebP q82, no
crop, no upscale; the three 5000+ px originals are stored downscaled to 1600 px wide.

| File | Guide | Title | Creator | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `learn-sandy-hook-surfer.webp` | `/learn/can-you-surf-in-new-jersey` | Surfing at Sandy Hook | NPS Photo | Public domain (PD-USGov-NPS) | https://commons.wikimedia.org/wiki/File:Surfing_at_Sandy_Hook_(2042bac6-9611-4aef-a119-c7db4576893e).JPG |
| `learn-bay-head-winter-beach-break.webp` | `/learn/can-you-surf-in-new-jersey` | Surfing, Bay Head New Jersey | James Loesch | CC BY 2.0 | https://www.flickr.com/photos/jal33/50995415231/ |
| `learn-manasquan-inlet-jetty.webp` | `/learn/can-you-surf-in-new-jersey` | Manasquan Beach Inlet (7.13.08) | Luigi Novi (Nightscream) | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:ManasquanBeachInlet7.13.08ByLuigiNovi8.jpg |
| `learn-cape-may-wetsuit-surfer.webp` | `/learn/can-you-surf-in-new-jersey` | AtlanticSurfing (Cape May, New Jersey) | Shiva Shenoy | CC BY 4.0 | https://www.flickr.com/photos/shivashenoy/55312082547/ |

## Sourced 2026-10-27 (Openverse → Flickr, Creative Commons)

Each licence was checked on the Flickr source page. WebP q82 at native resolution,
no crop, no upscale.

| File | Guide | Title | Creator | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `learn-folly-beach-learners.webp` | `/learn/can-you-surf-in-south-carolina` | 'Learning to Ride the Waves' No.1 -- Folly Beach (SC) July 2012 | Ron Cogswell | CC BY 2.0 | https://www.flickr.com/photos/22711505@N05/7794455966 |
| `learn-folly-beach-hurricane-irene.webp` | `/learn/can-you-surf-in-south-carolina` | H. Irene | Gretchen Esbensen | CC BY 2.0 | https://www.flickr.com/photos/59435511@N02/6663054411 |
| `learn-folly-beach-longboarders.webp` | `/learn/can-you-surf-in-south-carolina` | 'Looking for the Perfect Wave' -- Folly Beach (SC) 2012 | Ron Cogswell | CC BY 2.0 | https://www.flickr.com/photos/22711505@N05/7770892728 |

The older `learn-*.jpg` files in this directory predate the ledger and have no
recorded provenance.
