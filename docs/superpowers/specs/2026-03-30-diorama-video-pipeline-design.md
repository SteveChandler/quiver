# Diorama Video Pipeline — Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Owner:** Steven

## Problem

~150 of Quiver's 261 beaches have no camera feed. The current empty state shows a `CameraOff` icon and "No live cam available yet" message. This is a dead-end experience for surfers checking conditions before dawn.

## Solution

Pre-rendered animated diorama videos that show what the surf looks like right now at each spot. Each beach gets a miniature 3D diorama scene (isometric view, BUCK studio aesthetic) animated into a 5-second seamless loop. The diorama's wave size and lighting reflect current forecast conditions.

The dioramas are **recognizable to locals** — Scripps Pier has its research building, HB Pier has Ruby's Diner, Rincon has its cobblestone point. They're not generic templates.

## Scope — SoCal Launch

- **19 full custom spots** with unique landmarks (hand-crafted prompts)
- **~30 semi-custom spots** assembled from modular break-type templates + feature tags
- **6 condition variants per spot** (3 wave sizes x 2 times of day)
- **~294 final video clips**

### Full Custom Spots (19)

1. Scripps Pier
2. Black's Beach
3. La Jolla Shores
4. Windansea
5. OB Pier / Ocean Beach
6. Pacific Beach
7. Cardiff Reef
8. Swami's
9. Oceanside Pier / Harbor
10. San Onofre / Trestles
11. Salt Creek
12. HB Pier / Huntington Beach
13. Newport Wedge
14. Rincon
15. C Street Ventura
16. Malibu / Surfrider
17. El Porto / Manhattan Beach
18. Steamer Lane
19. Sunset Cliffs

### Condition Matrix (6 variants)

| Wave Size | Time of Day |
|-----------|------------|
| Small (1-3ft) | Day |
| Small (1-3ft) | Golden hour |
| Medium (3-6ft) | Day |
| Medium (3-6ft) | Golden hour |
| Large (6ft+) | Day |
| Large (6ft+) | Golden hour |

Swell period and tide were evaluated and dropped — visually indistinguishable at diorama miniature scale. Wave size is the primary visual differentiator surfers care about.

## Tech Stack

| Component | Tool | Why |
|-----------|------|-----|
| **Image generation** | Gemini API direct (batch mode) | Official Google SDK, $0.023/image at batch pricing, reliable, no third-party risk |
| **Video generation** | Kling 3.0 via PiAPI | Best seamless loop support (start/end frame anchoring), $0.13-0.50/clip, pay-as-you-go, 20+ concurrent jobs |
| **Storage** | Supabase Storage | Already in the stack, CDN-served, cheap |
| **Playback** | expo-video (Quiver Native) | First-party Expo module, hardware-decoded, battery efficient, `isLooping` support |
| **Post-processing** | FFmpeg (local) | H.265 encoding, file size optimization, loop verification |

## Architecture

### Pipeline Overview

```
spots.json (spot configs)
    |
    v
[Stage 1] generate-images.ts — Gemini API
    |  human reviews, approves or re-gens
    v
output/{spot-slug}/base_{condition}.png
    |
    v
[Stage 2] generate-videos.ts — Kling 3.0 via PiAPI
    |  human reviews loop quality
    v
output/{spot-slug}/{condition}.mp4
    |
    v
[Stage 3] upload.ts — FFmpeg optimize + Supabase Storage
    |  automatic
    v
Supabase Storage: diorama-videos/{spot-slug}/{condition}.mp4
Supabase DB: beach_dioramas table updated
```

### Project Location

Standalone tool at `/Users/stevenchandler/Desktop/dev/diorama-pipeline/` — sibling to `quiver/`, does NOT bloat the Quiver codebase. Only the final output (Supabase Storage URLs + DB records) touches Quiver.

```
Desktop/dev/
├── quiver/              # untouched
├── quiver-native/       # consumes videos from Supabase
└── diorama-pipeline/    # standalone generation tool
    ├── package.json
    ├── tsconfig.json
    ├── .env                    # GEMINI_API_KEY, PIAPI_API_KEY, SUPABASE_*
    ├── spots.json              # spot configs (19 custom + 30 semi-custom)
    ├── prompts/
    │   ├── base-template.ts    # parameterized prompt builder
    │   ├── conditions.ts       # condition variant prompt modifiers
    │   └── custom/             # per-spot custom prompt overrides
    │       ├── scripps-pier.ts
    │       ├── huntington-beach-pier.ts
    │       └── ...
    ├── scripts/
    │   ├── generate-images.ts  # Gemini API — interactive + batch modes
    │   ├── generate-videos.ts  # Kling via PiAPI — batch with retry
    │   ├── upload.ts           # FFmpeg + Supabase Storage upload
    │   ├── review.ts           # open preview, collect approve/redo input
    │   └── manifest.ts         # track generation state per spot/condition
    ├── output/                 # generated assets (gitignored)
    │   ├── scripps-pier/
    │   │   ├── small_day.png
    │   │   ├── small_day.mp4
    │   │   ├── small_golden.png
    │   │   └── ...
    │   └── ...
    └── manifest.json           # tracks status of every spot × condition
```

### Spot Config Format

```json
{
  "slug": "scripps-pier",
  "beach_id": "uuid-from-supabase",
  "name": "Scripps Pier",
  "custom": true,
  "landmarks": "Long wooden research pier with Scripps Institution building at far end, La Jolla sandstone bluffs with ice plant vegetation",
  "break_type": "pier",
  "features": ["pier", "sandstone_cliffs", "lifeguard_tower", "research_station"],
  "sand_color": "golden",
  "wave_direction": "west",
  "vibe": "Research station meets mellow surf spot, UCSD campus nearby"
}
```

Semi-custom spots use the same format but with `"custom": false` and rely on `break_type` + `features` for prompt assembly rather than a hand-crafted prompt.

### Prompt Template (Gemini)

**Style: "Diorama Light"** — photorealistic cinematic surf photography with BUCK studio material/texture cues that give it a crafted, tactile feel. NOT full miniature-on-a-display-base. The Surfline-style landscape angle (camera from bluff/beach looking out toward ocean) solved the wave direction problem that plagued the isometric top-down approach.

Base template — variables injected per spot and condition:

```
A hyper-detailed miniature diorama of {spot.name}, rendered as a handcrafted
architectural model. Camera positioned {spot.camera_position} — a scenic
landscape view, NOT top-down, NOT a display box with walls.

Foreground: {spot.foreground_description}. Mid-ground: {spot.midground_description}
with surfers and beachgoers. Waves rolling in from the ocean toward shore with
white foam lines. Background: {spot.background_description}.

{spot.extra_details}

Materials: {spot.materials_list}.

BUCK design studio stop-motion aesthetic. NOT a cross-section, cutaway, or
shadowbox. Photorealistic cinematic quality. The scene sits on a clean solid
dark navy background (#252D6B) so the diorama appears to float.
```

**Key prompt learnings (validated on Black's, Scripps, Rincon):**
- Surfline-style bluff/overlook angle completely solves wave direction problem
- Keeping "miniature diorama" + "handcrafted architectural model" steers Gemini toward crafted feel even though output reads as photorealistic
- BUCK studio + material descriptions (epoxy resin, polymer clay, balsa wood) add the "diorama light" quality
- "NOT a cross-section or cutaway" still needed to prevent geological cutaway views
- "NOT a display box with walls" prevents Gemini from adding shadowbox frames
- Don't over-specify wave direction — natural landscape perspective handles it
- Navy #252D6B background makes diorama float in the app's dark UI

Condition modifiers:

| Condition | Wave Description | Lighting Description |
|-----------|-----------------|---------------------|
| small_day | "Small gentle 1-3 foot waves with thin foam lines. Calm, glassy water surface. Surfers sitting in lineup waiting." | "Bright midday sunlight, crisp shadows, clear sky tones." |
| small_golden | (same waves) | "Warm golden hour light from the left casting long shadows. Peach and amber tones reflected in the water." |
| medium_day | "Medium 3-6 foot waves with white foam crests breaking consistently. Surfers actively riding waves." | (midday) |
| medium_golden | (same waves) | (golden hour) |
| large_day | "Large 6+ foot waves with heavy white water and spray. Powerful swells with deep faces. Only experienced surfers in the water." | (midday) |
| large_golden | (same waves) | (golden hour) |

### Video Generation (Kling 3.0)

```
POST to PiAPI Kling endpoint:
{
  "model": "kling-3.0",
  "input_image": "{output_image_url}",
  "input_image_end": "{output_image_url}",   // same image = seamless loop
  "prompt": "Animate only the ocean water. Gentle waves roll toward shore
             with white foam. Water surface ripples and catches light.
             Everything else remains perfectly still like a physical model.
             Camera locked. Seamless loop.",
  "duration": 5,
  "mode": "professional"
}
```

The prompt varies slightly per wave size bucket — "gentle small waves" vs. "powerful churning waves with heavy white water."

### Manifest Tracking

`manifest.json` tracks the state of every spot × condition:

```json
{
  "scripps-pier": {
    "small_day": {
      "image_status": "approved",
      "image_path": "output/scripps-pier/small_day.png",
      "image_attempts": 3,
      "video_status": "approved",
      "video_path": "output/scripps-pier/small_day.mp4",
      "video_attempts": 1,
      "uploaded": true,
      "supabase_url": "https://xxx.supabase.co/storage/v1/object/public/diorama-videos/scripps-pier/small_day.mp4"
    },
    "small_golden": {
      "image_status": "pending",
      "video_status": "pending"
    }
  }
}
```

Scripts resume from where they left off using this manifest — no re-generating approved assets.

## Human-in-the-Loop Workflow

### Interactive Mode (custom spots)

```bash
cd diorama-pipeline
yarn generate-images --spot scripps-pier --interactive
```

1. Generates ONE base image (small_day)
2. Opens in Preview.app
3. Prompts in terminal: `[approve / redo / redo "more surfers in water"]`
4. On approve: auto-generates remaining 5 condition variants
5. Shows thumbnail grid of all 6
6. Prompts: `[approve all / flag 2,5 for redo]`
7. Updates manifest, moves to next spot

### Batch Mode (semi-custom spots)

```bash
yarn generate-images --template pier --batch
```

1. Generates all images for all pier-type spots unattended
2. Saves contact sheet grid to `output/review-pier.html`
3. You open in browser, click approve/redo per image
4. Re-run with `--retry-flagged`

### Video Review

Same pattern — interactive for custom spots, batch for semi-custom. Videos auto-open in QuickTime for loop QA.

## Database Integration

### New Table: `beach_dioramas`

```sql
CREATE TABLE beach_dioramas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beach_id UUID NOT NULL REFERENCES beaches(id),
  condition_key TEXT NOT NULL,          -- 'small_day', 'medium_golden', etc.
  video_url TEXT NOT NULL,              -- Supabase Storage public URL
  thumbnail_url TEXT,                   -- Static image fallback
  wave_size_min NUMERIC NOT NULL,       -- 0 (ft)
  wave_size_max NUMERIC NOT NULL,       -- 3 (ft)
  time_of_day TEXT NOT NULL,            -- 'day' or 'golden_hour'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(beach_id, condition_key)
);
```

### Condition Resolution (in Quiver Native)

```typescript
function getDioramaConditionKey(forecast: SpotForecast): string {
  const waveSize =
    forecast.waveHeight < 3 ? "small" :
    forecast.waveHeight < 6 ? "medium" : "large";

  const hour = new Date().getHours();
  const timeOfDay = (hour >= 16 && hour < 19) ? "golden" : "day";

  return `${waveSize}_${timeOfDay}`;
}
```

### Native App Integration

In the beach detail screen, where the cam section currently shows:

```
if no camera_url → show "No live cam available" empty state
```

Replace with:

```
if no camera_url AND has diorama → show looping diorama video
if no camera_url AND no diorama → show existing empty state (fallback)
```

Video playback via `expo-video` with `isLooping={true}`, muted by default, pause when off-screen.

## Cost Estimate

| Item | Unit Cost | Quantity | Total |
|------|-----------|----------|-------|
| Gemini images (batch) | $0.023/image | ~600 (with retries) | ~$14 |
| Kling videos (PiAPI) | ~$0.13-0.50/clip | ~450 (with retries) | ~$60-225 |
| Supabase Storage | $0.021/GB/mo | ~3-5GB | ~$1/mo |
| **Total upfront** | | | **~$75-240** |
| **Total ongoing** | | | **~$1/mo** |

## Timeline

| Month | Work | Output |
|-------|------|--------|
| **Month 1** | Validate pipeline on 5 iconic spots. Dial in prompts, test Kling loops, build scripts. | 5 spots live, 30 clips |
| **Month 2** | Remaining 14 custom spots + semi-custom template development. | All 19 custom spots live |
| **Month 3** | Batch generate 30 semi-custom spots. Native app integration. | Full SoCal launch, 49 spots, 294 clips |

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Kling loops aren't seamless | Medium | Start/end frame anchoring + FFmpeg crossfade post-processing as fallback |
| Gemini can't consistently produce the diorama style | Low (already validated with Scripps) | Bank of working prompts from Scripps experiments as reference |
| PiAPI service interruption | Low | One-time batch job, not production dependency. Can pause and resume via manifest. |
| Video file sizes too large for mobile | Low | FFmpeg H.265 encoding targets 1-2MB per 5s clip at 720p |
| Users don't care / no engagement lift | Medium | Month 1 ships 5 spots — measure engagement before committing to full rollout |

## Success Criteria

- Diorama videos load in <2 seconds on 4G
- Loop is visually seamless (no visible jump/flash)
- Locals can identify their spot from the diorama
- Beach detail engagement (time on page) increases for no-cam spots
- "No cam available" empty state views decrease by >50%

## Out of Scope (Future)

- Night mode variant
- Swell period / tide as visual axes
- Animated figurines (surfers riding waves)
- User-submitted photos as diorama reference
- Real-time 3D rendering in-app
- Expanding beyond SoCal
