# Scripps Wave Simulator — Design Document

**Date:** 2026-03-03
**Status:** Design approved, awaiting assets
**Platform:** Native iOS (Swift, SwiftUI + SpriteKit)

---

## Overview

A standalone native iOS app that renders a living, animated scene of Scripps Pier in La Jolla. The scene plays through a 24-hour forecast cycle on a loop, with waves, tide, wind, sky, and crowd all shifting to reflect real forecasted conditions throughout the day.

No UI overlay. No text. No data readouts. Just the scene.

**Visual style:** 90s Nickelodeon "Rocket Power" cartoon aesthetic — bold black outlines, cel-shaded flat color fills, warm saturated palette (teal ocean, burnt orange sunsets, golden sand), slightly angular and exaggerated shapes.

**Rendering approach:** Illustrated + animated. Pre-drawn art assets layered and composited in SpriteKit, with wave motion, tide level, wind effects, crowd density, and sky transitions driven programmatically.

---

## Scene Composition

### Perspective

3/4 angled view standing on the beach, looking down the shoreline. Beach in the foreground, waves breaking at an angle, Scripps Pier receding into the distance on the right. This is NOT a flat side view — it has depth and perspective foreshortening.

### Layer Stack (back to front)

1. **Sky** — Programmatic gradient, no illustrated asset. Transitions through time-of-day states (see Time Progression below). Sun/moon moves across the sky arc.

2. **Ocean base** — Flat deep teal-blue water texture with subtle current streaks. Fills the area behind the wave layers.

3. **Far wave layer** — Small, muted background rollers. Slow horizontal scroll. Low opacity to suggest distance.

4. **Pier** — Illustrated Scripps Pier with building at the end, wooden pilings, lamp posts. Static position, but pilings reveal more/less based on tide level.

5. **Mid wave layer** — Breaking waves with bold white foam and spray. These are the main event. Height, speed, and spacing driven by forecast data.

6. **Surfer sprites** — Small figures in the lineup and riding waves. Count driven by time-of-day crowd model.

7. **Near wave layer (shorebreak)** — Whitewash and foam rushing up the sand. Break point shifts with tide.

8. **Beach/sand foreground** — Sandy strip curving from bottom-left. Wet sand area expands/contracts with tide.

9. **Palm trees** — Foreground framing elements. Fronds sway with wind speed/direction.

10. **Foam/spray particles** — SpriteKit particle emitters for crest spray, shore foam, and wind-blown mist.

---

## Time Progression

The sim plays a 24-hour forecast cycle on a seamless loop. One full day = ~90 seconds of real time.

### Sky States

| Time | Sky |
|------|-----|
| 12am-4am | Deep navy/indigo, moon |
| 4am-5:30am | Pre-dawn purple-to-indigo gradient |
| 5:30am-7am | Sunrise — orange, pink, teal bands |
| 7am-11am | Morning — bright warm teal, slightly hazy |
| 11am-3pm | Midday — bright, slightly washed-out teal |
| 3pm-5:30pm | Afternoon — warming, golden hour approaching |
| 5:30pm-7pm | Sunset — burnt orange, magenta, purple bands (classic Rocket Power) |
| 7pm-8:30pm | Dusk — deep purple fading to navy |
| 8:30pm-12am | Night — dark navy, moon |

Sky transitions are smooth gradient interpolations. A sun/moon sprite tracks across an arc at the top of the scene — no text, just the celestial body indicating time.

### Loop Behavior

Restarts seamlessly at midnight. The transition from 11:59pm to 12:00am should feel continuous — night sky holds steady across the boundary.

---

## Wave Mechanics

### Multi-Layer Wave System

Each wave layer is a horizontally scrolling illustrated strip. Wave behavior is controlled by parameters mapped from forecast data:

- **Amplitude** — Maps to forecasted wave height. Controls vertical displacement of the wave strip and visual scale.
- **Scroll speed** — Maps to wave period. Longer period = slower, more spaced-out waves. Shorter period = faster, tighter waves.
- **Chop overlay** — Maps to wind speed. Small jittery displacement added on top of the base wave motion. Zero when glassy, aggressive when windy.

### Wave Breaking

As the mid wave layer approaches shore, waves steepen and "break":
- The crest tips forward (exaggerated Rocket Power style)
- A burst of foam particles fires from the lip
- The wave dissolves into the shorebreak/whitewash layer
- Whitewash rushes up the sand, then recedes

### Set Waves

Every few cycles (~4-5 waves), one wave is 20-30% larger than average. This creates a natural, non-robotic rhythm that mimics real set patterns.

### Seed Data (v1)

Hardcoded 24-hour Scripps forecast:

| Hour | Wave Height | Period | Wind | Wind Dir | Tide |
|------|------------|--------|------|----------|------|
| 0 | 2.5 ft | 12s | 2 mph | Offshore | 3.2 ft (falling) |
| 3 | 2.0 ft | 12s | 1 mph | Offshore | 1.8 ft (low) |
| 6 | 3.0 ft | 10s | 3 mph | Offshore | 2.1 ft (rising) |
| 9 | 3.5 ft | 10s | 5 mph | Side-shore | 4.0 ft (rising) |
| 12 | 4.0 ft | 14s | 8 mph | Onshore | 5.1 ft (high) |
| 15 | 5.0 ft | 14s | 10 mph | Onshore | 4.2 ft (falling) |
| 18 | 4.5 ft | 12s | 4 mph | Offshore | 2.5 ft (falling) |
| 21 | 3.0 ft | 12s | 2 mph | Offshore | 1.9 ft (low) |

Values interpolate smoothly between hours so transitions are never jarring.

---

## Tide Simulation

### Water Level

The ocean's baseline vertical position on screen rises and falls with forecasted tide height.

**Visual effects of tide:**
- **Low tide:** More sand/beach exposed. Waves break further out. More pier pilings visible above waterline. Wider wet sand area.
- **High tide:** Water creeps up toward pier deck. Beach strip shrinks. Waves break closer to shore. Pilings mostly submerged.

### Implementation

Tide height maps to a Y-offset on the ocean base layer and all wave layers. The beach foreground has a "wet sand" zone that shifts with the waterline. Pier pilings use a mask or clip that reveals more/less based on water level.

---

## Wind Simulation

### Ocean Surface Effects

| Wind Condition | Visual Effect |
|----------------|---------------|
| Offshore (clean) | Smooth wave faces. Spray particles kick BACK off crests toward horizon. Glassy water surface. |
| Onshore (choppy) | Chop overlay on wave layers — small, fast, jittery displacement. Spray blows toward shore. Surface looks textured and messy. More whitewash. |
| Light/no wind | Calm surface, minimal spray. Glassy feel. |
| Strong wind (any direction) | More aggressive spray particles. Larger chop amplitude. |

### Palm Trees as Wind Indicators

Palm fronds sway based on wind speed and direction:
- **Light wind:** Gentle sway, slight lean
- **Strong offshore:** Fronds blow toward the ocean, trunk leans slightly seaward
- **Strong onshore:** Fronds blow inland, trunk leans toward beach
- **No wind:** Minimal movement, upright

Frond sway is a simple oscillating rotation on the frond sprite nodes, with amplitude and bias driven by wind speed/direction.

---

## Crowd Simulation

Small illustrated surfer sprites populate the lineup and occasionally ride waves. Count and behavior driven by time of day:

| Time | Lineup Count | Behavior |
|------|-------------|----------|
| 12am-5am | 0 | Empty. Night. |
| 5am-6:30am | 0-1 | Dawn patrol. One lone surfer appears around 5:30. |
| 6:30am-8am | 2-3 | Early morning crew trickling in. |
| 8am-10am | 4-6 | Morning session. Active lineup. |
| 10am-2pm | 8-12 | Peak crowd. Packed lineup. Occasional surfer on the beach/pier. |
| 2pm-4pm | 6-8 | Afternoon. Still busy, starting to thin. |
| 4pm-6pm | 4-5 | Evening glass-off session. |
| 6pm-7:30pm | 2-3 | Sunset crew. |
| 7:30pm-12am | 0 | Empty. |

### Surfer Sprite Types

- **Sitting in lineup** — Small figure sitting on board, bobbing with wave motion. Most common.
- **Paddling** — Transitional sprite, used when surfers "enter" or "exit" the lineup.
- **Riding wave** — Appears on the mid wave layer during a break. A surfer drops in, rides across the wave face briefly, then the sprite disappears into foam. Happens every few wave cycles — more often during crowded hours.

Surfers are positioned semi-randomly within the lineup zone (area between far and mid wave layers). They bob vertically with the underlying wave motion.

---

## Art Assets Required

All assets: PNG with transparency, Rocket Power style (bold black outlines, cel-shaded, warm saturated palette).

| # | Asset | Size | Notes |
|---|-------|------|-------|
| 1 | Scripps Pier | 2048px wide | 3/4 perspective, building at end, pilings, lamp posts. Isolated on transparency. |
| 2 | Beach/sand foreground | 2048px wide | Curved strip, wet sand near waterline darker. Transparent above sand. |
| 3 | Far wave layer | 2048px x 300px | Muted, small rollers. Horizontally tileable seamless strip. |
| 4 | Mid wave layer | 2048px x 400px | Breaking waves, bold foam, spray. Horizontally tileable seamless strip. |
| 5 | Near wave layer (shorebreak) | 2048px x 350px | Whitewash rushing up sand. Horizontally tileable seamless strip. |
| 6 | Palm trees | 512x1024px | 2 separate trees, slightly leaning, angular fronds. Separable. |
| 7 | Surfer sprites — sitting | 64x64px each | 4-6 varied surfers sitting on boards. Sprite sheet, single row. |
| 8 | Surfer sprites — riding | 80x80px each | 3-4 poses (bottom turn, cutback, trim). Sprite sheet, single row. |
| 9 | Foam/spray particles | 32-64px each | 4-6 individual puffs. White with transparency variation. Sprite sheet. |
| 10 | Ocean base texture | 2048px x 600px | Flat deep teal-blue, subtle current streaks. Horizontally tileable. |

---

## Project Structure

```
ScrippsWaveSim/
├── ScrippsWaveSimApp.swift          # SwiftUI app entry point
├── ContentView.swift                # SwiftUI host wrapping the SpriteKit view
├── Scene/
│   ├── WaveScene.swift              # Main SKScene — owns all layers, runs update loop
│   ├── SkyRenderer.swift            # Programmatic gradient sky + sun/moon position
│   ├── OceanBaseNode.swift          # Deep water background texture
│   ├── WaveLayerNode.swift          # Reusable: scrolling wave strip with amplitude/speed params
│   ├── PierNode.swift               # Pier sprite with tide-masked pilings
│   ├── PalmTreeNode.swift           # Palm tree with wind-reactive frond rotation
│   ├── ShoreBreakNode.swift         # Whitewash layer + beach wash-up animation
│   ├── SurferManager.swift          # Spawns/despawns surfer sprites based on crowd model
│   ├── SurferSprite.swift           # Individual surfer (sitting, paddling, riding states)
│   └── SprayEmitter.swift           # Particle emitter config for foam/spray
├── Data/
│   ├── ForecastData.swift           # Hardcoded 24hr seed data (height, period, wind, tide)
│   ├── TimeProgression.swift        # Maps elapsed scene time → forecast hour, interpolates
│   └── CrowdModel.swift             # Maps hour → surfer count and behavior mix
├── Style/
│   └── RocketPalette.swift          # Named colors: teal, burntOrange, sand, navy, etc.
├── Assets.xcassets/
│   ├── pier.imageset/
│   ├── beach-sand.imageset/
│   ├── wave-far.imageset/
│   ├── wave-mid.imageset/
│   ├── wave-near.imageset/
│   ├── palm-tree-1.imageset/
│   ├── palm-tree-2.imageset/
│   ├── ocean-base.imageset/
│   ├── surfer-sitting.imageset/     # Sprite sheet
│   ├── surfer-riding.imageset/      # Sprite sheet
│   └── foam-particles.imageset/     # Particle texture sheet
└── Info.plist
```

---

## Technical Notes

### SpriteKit Scene Loop

`WaveScene.update(_ currentTime:)` runs every frame (~60fps):
1. Advance `TimeProgression` — get current interpolated forecast values
2. Update `SkyRenderer` gradient and sun/moon position
3. Update each `WaveLayerNode` — scroll speed, amplitude, chop overlay
4. Update `OceanBaseNode` Y-position for tide
5. Update `ShoreBreakNode` — break point position, wash extent
6. Update `PierNode` — tide mask on pilings
7. Update `PalmTreeNode` — frond rotation amplitude and bias
8. Update `SurferManager` — spawn/despawn surfers, trigger rides
9. Update `SprayEmitter` — direction and intensity

### Performance Targets

- 60fps constant on iPhone 12 and newer
- Minimal battery drain (this should feel ambient, not like a game burning CPU)
- SpriteKit handles draw call batching automatically for sprite nodes

### Future: Live Data

v1 uses hardcoded `ForecastData`. v2 would:
- Hit the Quiver API for real Scripps forecast data
- Replace `ForecastData.swift` with a network fetch + cache
- Update every few hours in the background
- The scene would reflect actual, real-time conditions at Scripps

### Future: Additional Beaches

The architecture is intentionally decoupled — `ForecastData` and art assets are the only beach-specific pieces. Swapping in a new pier illustration, new palette, and new forecast data could create a Pipeline, Huntington, or Mavericks version.

---

## Decisions

1. **Orientation:** Landscape only. Locked.
2. **Loop transition:** Seamless crossfade at midnight boundary.
3. **Audio:** Ambient ocean sounds — out of scope for v1, planned for v2.
4. **App icon:** TBD — design after the scene is working.
5. **Project location:** `~/Desktop/quiver-ios` — separate repo from the web app.
6. **Xcode:** Installed. iOS 15+ deployment target.
7. **Apple Developer account:** Available for App Store release.
8. **Palm tree wind:** Warp/skew whole tree in code (no separate trunk/frond assets).
9. **Riding surfer sprites:** Use as combo surfer+wave units overlaid on mid wave layer during catch events. Must still look premium — fade/scale transitions, not just popping in/out.
10. **Foam/spray particles:** Generated procedurally in SpriteKit (no illustrated asset needed).
