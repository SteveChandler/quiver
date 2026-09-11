# ONE MORE WAVE — art direction, obstacles, screens (v2 of the /play game)

Status: approved direction, 2026-09-11. Supersedes the visual sections of
`2026-09-10-outside-surf-game-design.md`. Engine logic, heat format, challenge
links, and lead capture from that spec stay. User-facing title becomes
**ONE MORE WAVE** (internal identifiers may keep `outside`).

Engine: Phaser 3 (browser only, client-side dynamic import, `pixelArt: true`,
nearest-neighbour scaling). The pure TypeScript engine in `lib/play/` stays the
source of truth for simulation, judging, heats, seeds, challenge codes, and
progress; Phaser is the render and input layer. Reference sheets (not
committed) are in `.planning/play/reference/sheet-1..5.png`.

## Core visual goal

Bright, vibrant, readable pixel-art surf game: lo-fi 2D sprite game, polished
browser arcade, surf-first, readable motion, vibrant water and sky, clean UI
overlays. Quiver-aligned through colour and polish, not through branding
everywhere. Never dark, moody, or murky.

## Locked palette

Brand / UI blues: Quiver Deep Blue `#0B5FA5` (nav, HUD shells, key buttons,
framing) · Ocean Blue `#127CC1` (active panels, mid fill, button states) ·
Bright Cyan `#29C7F6` (outlines, active highlights, progress markers, glow) ·
Aqua Mint `#75E3E1` (secondary highlights, safe state, water sparkle) · Soft
Sky `#B8F1FF` (bright UI highlights, interior linework, foam sparkle).

Wave / water, dark to bright: Deep Trough Teal `#0B6C82` · Pocket Teal
`#0F8EA3` · Face Aqua `#1DB6C9` · Sunlit Water `#4FE1E7` · Shallow Glow
`#8EF7F2`. Darkest at trough and inside the curl, mid across the face,
brightest at lip spray, reflections, shallows.

Foam: Foam White `#F8FEFF` · Foam Cool White `#E6F9FF` · Foam Cyan Shadow
`#B7ECF8` · Foam Blue Shadow `#7ED0E8`. Foam is never grey or muddy.

Sunset / sky: Sun Cream `#FFF0B0` · Warm Peach `#FFBE8A` · Coral Pop `#FF8D73`
· Pink Cloud `#F57CB3` · Lavender Distance `#7D7CCF`.

Warning / scoring accents (sparingly): Combo Yellow `#FFD447` · Orange Hit
`#FF9A3D` · Hot Coral `#FF5C6C` · Success Green `#43D87D` · Wipeout Magenta
Red `#D93B72`.

Neutral / structural: Pier Wood Light `#B9844A` · Mid `#8E5E34` · Dark
`#5F3B1F` · Shadow Navy `#12324A` · Deep Shadow `#0A1D2B`. Deep neutrals for
contrast only; the screen never drifts dark.

Surfer: Skin highlight `#F7C29B` · mid `#DD9B73` · shadow `#A65D44` · Hair
dark `#4B2B1E` · highlight `#6A3D2A` · Shorts navy `#1C4970` · blue `#2B6A9E`
· Accent coral `#FF6A67` · Board white `#FFFDF4` · Board cool shadow
`#C9E6F3` · Board stripe `#29C7F6` or `#FF8D73`.

## UI style

Bold, readable, minimal, bright, rounded-rect pixel panels layered clearly on
gameplay, never heavy. HUD panels: dark blue shell, slightly lighter interior,
bright cyan edge highlight, 1-2 px outer shadow, white text, accent colour only
for key info. Blocky pixel font. Text: primary `#F8FEFF`, secondary `#B8F1FF`,
accents yellow/green/coral. Buttons: blue base, cyan outline, white text;
pressed = brighter cyan top edge, darker bottom, 1-2 px inset; danger prompts
use yellow + coral. Alerts are short and iconic (`PIER AHEAD`, `AIR +300`,
`CLEAN LANDING`, `WIPEOUT`), never sentences during live play. Bars only for
wave progress, foam danger/gap, combo timer: dark shell, saturated fill,
segmented; safe = cyan/aqua, danger = coral/red, warning = yellow.

Gameplay screen shows only: score, time, wave number, one danger indicator,
one contextual alert, optional minimal control hint.

## Wave readability (most important)

Every playable wave shows five zones: (1) whitewater / breaking section on
the left behind the surfer, brightest foam, chaotic, visibly advancing; (2)
pocket just ahead of it, steepest, darker teal contrast, high reward; (3)
face, clean diagonal playable area with a smooth banded gradient; (4) lip,
top edge with bright sunlit highlight, visible air launch zone; (5) shoulder,
flatter exit area to the right, safer, lower reward.

Clear curve, readable slope, depth through colour bands, motion through foam
streaks and spray trails. Never a wallpaper wave, a blob, or a painting where
the action disappears. The whitewater edge is the actual threat boundary and
must feel like it is chasing the player. Barrel lane: darker tunnel opening,
bright lip edge above, highlighted interior line, subtle streaks marking the
hold zone. Air launch: bright lip highlight, steeper upper face, spray burst
when in the zone, optional small launch-window effect. Contrast rules: surfer
against face, whitewater against face, pier posts against water and sky,
hazards never vanish into foam.

## Obstacles

Each obstacle is readable in silhouette, visible early, visually distinct,
and demands a different response. Player gets read time: silhouette, lane
placement, motion or splash cue before it is dangerous.

- Seagulls (air-space): white/grey body, dark wing tips, orange beak/feet;
  fast upper hazard to duck under or avoid during airs. Simple silhouette.
- Fish jump (water-level pop): splash marker first, fish arc second, splash
  landing third. The anticipation marker matters as much as the fish.
- Floating debris: plank, crate, barrel, tire, cooler, driftwood, each with a
  unique silhouette.
- Swimmer / bodyboarder (human): silhouette first (paddling arms, board
  shape, head); reads as "don't plow into this".
- Pier posts (signature): single post, double-post gap, cross-brace segment,
  splash at base, shadow/reflection. Collision area matches artwork, gaps are
  clearly passable, no fake openings. Warm wood against cool ocean.
- Buoys as markers.

Wipeout reasons shown on fail: `Caught by the foam`, `Hit the pier`, `Bad
landing`, `Hit a swimmer`, `Clipped by debris`, `Took a gull to the face`.

## Surfer sprite

Pixel-art action icon, athletic, readable at medium distance, boardshorts,
white board with minimal stripe. Poses that must each read at a glance: idle
/ trim, pump, low line, bottom turn, top turn, cutback (initiation and
rebound), barrel tuck, air takeoff, air (straight and grab), landing, wobble,
wipeout tumble with board eject. Strong silhouette, no anti-aliased fuzz,
consistent scale, spray and wake support the action, board angle changes per
move.

## Screens

A. Title: Quiver logo left, title ONE MORE WAVE centre, small Play right;
centre scene with surfer on a bright wave, pier in distance, birds, sunset
clouds; buttons START RUN, PRACTICE, CHALLENGE A FRIEND; tagline "Ride the
line. Beat the pier. Get the real one." Screenshot-worthy.

B. Live gameplay: score and best top left; wave count and foam gap bar top
centre; time and pier warning top right; wave fills the screen, surfer
right-of-centre, whitewater behind, shoulder ahead, obstacle lane visible; sky
and coast secondary; popups `AIR +300`, `CUTBACK`, `CLEAN LANDING`. Readable
within one second.

C. Pier warning: posts entering from the right, foam gap tightening, bold
`PIER AHEAD` panel in yellow and coral, no opaque overlay.

D. Wipeout: surfer tumbling in foam, board separated, cause obvious;
`WIPEOUT` plus the reason; buttons TRY AGAIN, LAST SECTION, CHALLENGE A
FRIEND. Fast recovery, not shame.

E. Results / Quiver handoff: score, best, tricks landed, longest ride, closest
pier pass; postcard-style session card; buttons PLAY AGAIN, SEND CHALLENGE,
FIND A REAL SESSION; framing "Now go get a real one. Quiver helps you find
the next surf window."; lead capture only after value: email, SMS (flagged),
optional home break and surf frequency.

## Non-negotiables

1. Brighter, vibrant palette. 2. Wave readability over art detail. 3.
Whitewater visibly chases. 4. Surfer silhouette communicates the move. 5.
Obstacles readable by type. 6. UI supports gameplay, never smothers it. 7.
Quiver identity through colour and polish.
