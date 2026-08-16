# Diorama Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a standalone `diorama-pipeline/` project that generates "diorama light" images via Gemini API, tracks state with a manifest, and supports interactive human-in-the-loop review.

**Architecture:** A TypeScript CLI tool at `~/Desktop/dev/diorama-pipeline/` (sibling to `quiver/`). Three scripts: `generate-images` (Gemini API), `generate-videos` (PiAPI/Kling), and `upload` (FFmpeg + Supabase Storage). A JSON manifest tracks the status of every spot × condition combination. This plan covers Stage 1 (image generation + review) only — video generation and upload will be separate plans once we have approved images.

**Tech Stack:** TypeScript, `@google/genai` (Gemini SDK), `tsx` (script runner), `readline` (interactive prompts), `open` (preview images), Node.js 20+

---

## File Structure

```
~/Desktop/dev/diorama-pipeline/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── spots.json                    # spot configs (4 validated spots to start)
├── src/
│   ├── types.ts                  # shared types (SpotConfig, ManifestEntry, Condition)
│   ├── prompts/
│   │   ├── base-template.ts      # parameterized prompt builder
│   │   └── conditions.ts         # 6 condition variant modifiers
│   ├── manifest.ts               # read/write/update manifest.json
│   ├── generate-images.ts        # Gemini API image generation script
│   └── review.ts                 # interactive review CLI (approve/redo/flag)
├── output/                       # generated assets (gitignored)
└── manifest.json                 # tracks status of every spot × condition
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `~/Desktop/dev/diorama-pipeline/package.json`
- Create: `~/Desktop/dev/diorama-pipeline/tsconfig.json`
- Create: `~/Desktop/dev/diorama-pipeline/.env.example`
- Create: `~/Desktop/dev/diorama-pipeline/.gitignore`

- [ ] **Step 1: Create project directory**

```bash
mkdir -p ~/Desktop/dev/diorama-pipeline/src/prompts
mkdir -p ~/Desktop/dev/diorama-pipeline/output
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "diorama-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "tsx src/generate-images.ts",
    "review": "tsx src/review.ts"
  },
  "dependencies": {
    "@google/genai": "^1.47.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "output"]
}
```

- [ ] **Step 4: Write .env.example**

```
GEMINI_API_KEY=your-gemini-api-key
# Future: PIAPI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
dist/
output/
.env
manifest.json
```

- [ ] **Step 6: Install dependencies**

```bash
cd ~/Desktop/dev/diorama-pipeline && npm install
```

Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 7: Initialize git and commit**

```bash
cd ~/Desktop/dev/diorama-pipeline
git init
git add package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "chore: scaffold diorama-pipeline project"
```

---

### Task 2: Types and Spot Config

**Files:**
- Create: `~/Desktop/dev/diorama-pipeline/src/types.ts`
- Create: `~/Desktop/dev/diorama-pipeline/spots.json`

- [ ] **Step 1: Write shared types**

```typescript
// src/types.ts

export type WaveSize = "small" | "medium" | "large";
export type TimeOfDay = "day" | "golden";
export type ConditionKey = `${WaveSize}_${TimeOfDay}`;

export const CONDITION_KEYS: ConditionKey[] = [
  "small_day",
  "small_golden",
  "medium_day",
  "medium_golden",
  "large_day",
  "large_golden",
];

export interface SpotConfig {
  slug: string;
  beach_id: string;
  name: string;
  custom: boolean;
  camera_position: string;
  foreground: string;
  midground: string;
  background: string;
  extra_details: string;
  materials: string;
}

export type ImageStatus = "pending" | "generating" | "review" | "approved" | "rejected";
export type VideoStatus = "pending" | "generating" | "review" | "approved" | "rejected";

export interface ConditionState {
  image_status: ImageStatus;
  image_path?: string;
  image_attempts: number;
  video_status: VideoStatus;
  video_path?: string;
  video_attempts: number;
  uploaded: boolean;
  supabase_url?: string;
}

export type SpotManifest = Record<ConditionKey, ConditionState>;
export type Manifest = Record<string, SpotManifest>;
```

- [ ] **Step 2: Write spots.json with 4 validated spots**

```json
[
  {
    "slug": "blacks-beach",
    "beach_id": "",
    "name": "Black's Beach, La Jolla",
    "custom": true,
    "camera_position": "at the bluff overlook, elevated slightly above the scene, looking out toward the ocean",
    "foreground": "Torrey Pines sandstone bluff edge with miniature chain fence posts, dry scrub vegetation, and tiny polymer clay figurines watching from the overlook",
    "midground": "wide sandy beach with small surfers and beachgoers",
    "background": "open ocean fading to sky",
    "extra_details": "Tall eroded sandstone cliffs on the left framing the scene. Paragliders optional in the sky above the cliffs.",
    "materials": "laser-cut balsa wood for fence posts, poured translucent epoxy resin for water, real fine craft sand, polymer clay figurines, dried moss for scrub vegetation"
  },
  {
    "slug": "scripps-pier",
    "beach_id": "",
    "name": "Scripps Pier, La Jolla",
    "custom": true,
    "camera_position": "from the beach looking out along the pier toward the ocean",
    "foreground": "golden sand beach with tidal foam, a polymer clay surfer in a wetsuit walking toward the water carrying a longboard",
    "midground": "the full length of Scripps Pier — a single continuous narrow wooden research pier on wooden pilings stretching from the beach straight out into the ocean. No gaps, no disconnected pilings — one unbroken pier structure. Surfers paddling in the lineup on both sides of the pier. Waves rolling in from the horizon with white foam",
    "background": "the Scripps Institution of Oceanography building at the far end of the pier, La Jolla sandstone bluffs with ice plant visible to the right",
    "extra_details": "La Jolla sandstone bluffs with ice plant vegetation visible in the distance to the right.",
    "materials": "laser-cut balsa wood for the pier, poured translucent epoxy resin for water, real fine craft sand, polymer clay figurines, brass wire railings on the pier"
  },
  {
    "slug": "rincon",
    "beach_id": "",
    "name": "Rincon Point, Santa Barbara",
    "custom": true,
    "camera_position": "from the cobblestone point looking out along the right-breaking wave",
    "foreground": "smooth river cobblestones and rounded boulders at the water's edge, kelp strands draped over rocks, a couple of polymer clay surfers in wetsuits waxing boards on the rocks",
    "midground": "a perfectly peeling right-hand point break wave wrapping along the cobblestone point, three or four surfers in the lineup. The wave peels cleanly from left to right with a translucent green face and white foam trail",
    "background": "the 101 freeway and railroad tracks visible hugging the hillside above, Ventura coastline stretching into the distance",
    "extra_details": "Dry golden California hillside with scrub brush rising behind the break.",
    "materials": "real smooth river pebbles for the cobblestone point, poured translucent epoxy resin for water, polymer clay figurines, dried moss for hillside vegetation"
  },
  {
    "slug": "huntington-beach-pier",
    "beach_id": "",
    "name": "Huntington Beach Pier",
    "custom": true,
    "camera_position": "from the sand looking up at the pier from the south side",
    "foreground": "wide flat sandy beach with beach cruiser bikes parked near a lifeguard tower, polymer clay beachgoers with towels and umbrellas",
    "midground": "the iconic concrete Huntington Beach Pier extending straight out into the ocean, Ruby's Diner visible as a red-and-white building at the end of the pier. Waves breaking on both sides of the pier with surfers riding close to the pilings",
    "background": "open ocean, a few sailboats on the horizon",
    "extra_details": "Volleyball nets on the beach to the left. The classic HB surf culture vibe — boardwalk energy.",
    "materials": "laser-cut balsa wood and styrene for the pier structure, poured translucent epoxy resin for water, real fine craft sand, polymer clay figurines, miniature painted signage for Ruby's Diner"
  }
]
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/dev/diorama-pipeline
git add src/types.ts spots.json
git commit -m "feat: add types and 4 validated spot configs"
```

---

### Task 3: Prompt Builder

**Files:**
- Create: `~/Desktop/dev/diorama-pipeline/src/prompts/conditions.ts`
- Create: `~/Desktop/dev/diorama-pipeline/src/prompts/base-template.ts`

- [ ] **Step 1: Write condition modifiers**

```typescript
// src/prompts/conditions.ts

import type { ConditionKey } from "../types.js";

interface ConditionModifier {
  wave_description: string;
  lighting_description: string;
}

export const CONDITIONS: Record<ConditionKey, ConditionModifier> = {
  small_day: {
    wave_description:
      "Small gentle 1-3 foot waves with thin foam lines. Calm, glassy water surface. Surfers sitting in lineup waiting.",
    lighting_description:
      "Bright midday sunlight, crisp shadows, clear sky tones.",
  },
  small_golden: {
    wave_description:
      "Small gentle 1-3 foot waves with thin foam lines. Calm, glassy water surface. Surfers sitting in lineup waiting.",
    lighting_description:
      "Warm golden hour light from the left casting long shadows. Peach and amber tones reflected in the water.",
  },
  medium_day: {
    wave_description:
      "Medium 3-6 foot waves with white foam crests breaking consistently. Surfers actively riding waves.",
    lighting_description:
      "Bright midday sunlight, crisp shadows, clear sky tones.",
  },
  medium_golden: {
    wave_description:
      "Medium 3-6 foot waves with white foam crests breaking consistently. Surfers actively riding waves.",
    lighting_description:
      "Warm golden hour light from the left casting long shadows. Peach and amber tones reflected in the water.",
  },
  large_day: {
    wave_description:
      "Large 6+ foot waves with heavy white water and spray. Powerful swells with deep faces. Only experienced surfers in the water.",
    lighting_description:
      "Bright midday sunlight, crisp shadows, clear sky tones.",
  },
  large_golden: {
    wave_description:
      "Large 6+ foot waves with heavy white water and spray. Powerful swells with deep faces. Only experienced surfers in the water.",
    lighting_description:
      "Warm golden hour light from the left casting long shadows. Peach and amber tones reflected in the water.",
  },
};
```

- [ ] **Step 2: Write base prompt template builder**

```typescript
// src/prompts/base-template.ts

import type { SpotConfig, ConditionKey } from "../types.js";
import { CONDITIONS } from "./conditions.js";

export function buildPrompt(spot: SpotConfig, condition: ConditionKey): string {
  const mod = CONDITIONS[condition];

  return `A hyper-detailed miniature diorama of ${spot.name}, rendered as a handcrafted architectural model. Camera positioned ${spot.camera_position} — a scenic landscape view, NOT top-down, NOT a display box with walls.

Foreground: ${spot.foreground}. Mid-ground: ${spot.midground}. ${mod.wave_description} Background: ${spot.background}.

${spot.extra_details}

${mod.lighting_description}

Materials: ${spot.materials}.

BUCK design studio stop-motion aesthetic. NOT a cross-section, cutaway, or shadowbox. Photorealistic cinematic quality. The scene sits on a clean solid dark navy background (#252D6B) so the diorama appears to float.`;
}
```

- [ ] **Step 3: Verify prompt output manually**

```bash
cd ~/Desktop/dev/diorama-pipeline
npx tsx -e "
import spots from './spots.json' with { type: 'json' };
import { buildPrompt } from './src/prompts/base-template.js';
console.log(buildPrompt(spots[0], 'medium_day'));
"
```

Expected: Full prompt for Black's Beach with medium_day conditions prints to stdout.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/dev/diorama-pipeline
git add src/prompts/
git commit -m "feat: add prompt builder with condition modifiers"
```

---

### Task 4: Manifest Tracking

**Files:**
- Create: `~/Desktop/dev/diorama-pipeline/src/manifest.ts`

- [ ] **Step 1: Write manifest module**

```typescript
// src/manifest.ts

import fs from "node:fs";
import path from "node:path";
import type {
  Manifest,
  SpotManifest,
  ConditionKey,
  ConditionState,
  SpotConfig,
  ImageStatus,
  CONDITION_KEYS,
} from "./types.js";
import { CONDITION_KEYS as ALL_CONDITIONS } from "./types.js";

const MANIFEST_PATH = path.resolve("manifest.json");

function emptyConditionState(): ConditionState {
  return {
    image_status: "pending",
    image_attempts: 0,
    video_status: "pending",
    video_attempts: 0,
    uploaded: false,
  };
}

function emptySpotManifest(): SpotManifest {
  const manifest = {} as SpotManifest;
  for (const key of ALL_CONDITIONS) {
    manifest[key] = emptyConditionState();
  }
  return manifest;
}

export function loadManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
}

export function saveManifest(manifest: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

export function ensureSpot(manifest: Manifest, slug: string): Manifest {
  if (!manifest[slug]) {
    manifest[slug] = emptySpotManifest();
  }
  return manifest;
}

export function updateCondition(
  manifest: Manifest,
  slug: string,
  condition: ConditionKey,
  update: Partial<ConditionState>
): Manifest {
  manifest = ensureSpot(manifest, slug);
  manifest[slug][condition] = { ...manifest[slug][condition], ...update };
  return manifest;
}

export function getNextPending(
  manifest: Manifest,
  slug: string
): ConditionKey | null {
  const spot = manifest[slug];
  if (!spot) return ALL_CONDITIONS[0];
  for (const key of ALL_CONDITIONS) {
    if (spot[key].image_status === "pending" || spot[key].image_status === "rejected") {
      return key;
    }
  }
  return null;
}

export function initManifestForSpots(spots: SpotConfig[]): Manifest {
  const manifest = loadManifest();
  for (const spot of spots) {
    ensureSpot(manifest, spot.slug);
  }
  saveManifest(manifest);
  return manifest;
}
```

- [ ] **Step 2: Verify manifest init**

```bash
cd ~/Desktop/dev/diorama-pipeline
npx tsx -e "
import spots from './spots.json' with { type: 'json' };
import { initManifestForSpots, loadManifest } from './src/manifest.js';
initManifestForSpots(spots);
const m = loadManifest();
console.log(Object.keys(m));
console.log(m['blacks-beach'].small_day);
"
```

Expected: Prints `['blacks-beach', 'scripps-pier', 'rincon', 'huntington-beach-pier']` and the default pending state for `small_day`.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/dev/diorama-pipeline
git add src/manifest.ts
git commit -m "feat: add manifest tracking for spot × condition state"
```

---

### Task 5: Gemini Image Generation Script

**Files:**
- Create: `~/Desktop/dev/diorama-pipeline/src/generate-images.ts`

This is the core script. It takes a `--spot` slug (or `--all`), builds prompts, calls Gemini, saves images to `output/{slug}/{condition}.png`, and updates the manifest.

- [ ] **Step 1: Write generate-images.ts**

```typescript
// src/generate-images.ts

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import spots from "../spots.json" with { type: "json" };
import { buildPrompt } from "./prompts/base-template.js";
import {
  loadManifest,
  saveManifest,
  ensureSpot,
  updateCondition,
  getNextPending,
} from "./manifest.js";
import type { SpotConfig, ConditionKey } from "./types.js";
import { CONDITION_KEYS } from "./types.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in environment. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL = "gemini-2.0-flash-exp";

function outputDir(slug: string): string {
  const dir = path.resolve("output", slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function imagePath(slug: string, condition: ConditionKey): string {
  return path.join(outputDir(slug), `${condition}.png`);
}

async function generateImage(
  spot: SpotConfig,
  condition: ConditionKey
): Promise<string> {
  const prompt = buildPrompt(spot, condition);
  console.log(`  Generating ${spot.slug}/${condition}...`);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error(`No response parts for ${spot.slug}/${condition}`);
  }

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data!, "base64");
      const outPath = imagePath(spot.slug, condition);
      fs.writeFileSync(outPath, buffer);
      console.log(`  Saved: ${outPath}`);
      return outPath;
    }
  }

  throw new Error(`No image in response for ${spot.slug}/${condition}`);
}

async function generateSpot(
  spot: SpotConfig,
  conditions: ConditionKey[]
): Promise<void> {
  let manifest = loadManifest();
  manifest = ensureSpot(manifest, spot.slug);

  for (const condition of conditions) {
    const state = manifest[spot.slug][condition];
    if (state.image_status === "approved") {
      console.log(`  Skipping ${condition} (already approved)`);
      continue;
    }

    manifest = updateCondition(manifest, spot.slug, condition, {
      image_status: "generating",
    });
    saveManifest(manifest);

    try {
      const outPath = await generateImage(spot, condition);
      manifest = updateCondition(manifest, spot.slug, condition, {
        image_status: "review",
        image_path: outPath,
        image_attempts: state.image_attempts + 1,
      });
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`);
      manifest = updateCondition(manifest, spot.slug, condition, {
        image_status: "pending",
        image_attempts: state.image_attempts + 1,
      });
    }

    saveManifest(manifest);
  }
}

// --- CLI ---

const args = process.argv.slice(2);
const spotSlug = args.find((a) => !a.startsWith("--"));
const allFlag = args.includes("--all");
const conditionArg = args.find((a) => a.startsWith("--condition="));
const conditionFilter = conditionArg?.split("=")[1] as ConditionKey | undefined;

if (!spotSlug && !allFlag) {
  console.log("Usage:");
  console.log("  yarn generate <spot-slug>                  # generate all pending conditions for a spot");
  console.log("  yarn generate <spot-slug> --condition=small_day  # generate one specific condition");
  console.log("  yarn generate --all                        # generate all pending across all spots");
  process.exit(0);
}

const targetSpots = allFlag
  ? (spots as SpotConfig[])
  : (spots as SpotConfig[]).filter((s) => s.slug === spotSlug);

if (targetSpots.length === 0) {
  console.error(`Unknown spot: ${spotSlug}`);
  console.log("Available:", (spots as SpotConfig[]).map((s) => s.slug).join(", "));
  process.exit(1);
}

const conditions = conditionFilter ? [conditionFilter] : CONDITION_KEYS;

for (const spot of targetSpots) {
  console.log(`\n=== ${spot.name} ===`);
  await generateSpot(spot, conditions);
}

console.log("\nDone. Run `yarn review` to approve/reject generated images.");
```

- [ ] **Step 2: Create .env file with real API key**

```bash
cd ~/Desktop/dev/diorama-pipeline
cp .env.example .env
# Then manually add your GEMINI_API_KEY
```

- [ ] **Step 3: Test with a single spot + condition**

```bash
cd ~/Desktop/dev/diorama-pipeline
npx tsx src/generate-images.ts blacks-beach --condition=small_day
```

Expected: Generates one image at `output/blacks-beach/small_day.png`, updates `manifest.json` with `image_status: "review"`.

- [ ] **Step 4: Verify manifest was updated**

```bash
cd ~/Desktop/dev/diorama-pipeline
cat manifest.json | npx tsx -e "
import fs from 'fs';
const m = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
console.log(m['blacks-beach'].small_day);
"
```

Expected: Shows `image_status: "review"`, `image_path` set, `image_attempts: 1`.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/dev/diorama-pipeline
git add src/generate-images.ts
git commit -m "feat: add Gemini image generation script with manifest tracking"
```

---

### Task 6: Interactive Review CLI

**Files:**
- Create: `~/Desktop/dev/diorama-pipeline/src/review.ts`

Opens each image in Preview.app, prompts for approve/redo/skip in the terminal.

- [ ] **Step 1: Write review.ts**

```typescript
// src/review.ts

import { exec } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import spots from "../spots.json" with { type: "json" };
import { loadManifest, saveManifest, updateCondition } from "./manifest.js";
import type { SpotConfig, ConditionKey } from "./types.js";
import { CONDITION_KEYS } from "./types.js";

function openImage(filePath: string): void {
  exec(`open "${filePath}"`);
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// --- CLI ---

const args = process.argv.slice(2);
const spotSlug = args.find((a) => !a.startsWith("--"));
const allFlag = args.includes("--all");

const targetSpots = allFlag
  ? (spots as SpotConfig[])
  : spotSlug
    ? (spots as SpotConfig[]).filter((s) => s.slug === spotSlug)
    : (spots as SpotConfig[]);

let manifest = loadManifest();
let reviewed = 0;

for (const spot of targetSpots) {
  const spotState = manifest[spot.slug];
  if (!spotState) continue;

  for (const condition of CONDITION_KEYS) {
    const state = spotState[condition];
    if (state.image_status !== "review") continue;

    if (!state.image_path || !fs.existsSync(state.image_path)) {
      console.log(`  Missing file for ${spot.slug}/${condition}, skipping`);
      continue;
    }

    console.log(`\n--- ${spot.name} / ${condition} ---`);
    console.log(`  File: ${state.image_path}`);
    console.log(`  Attempts: ${state.image_attempts}`);
    openImage(state.image_path);

    const answer = await ask("  [a]pprove / [r]edo / [s]kip? ");

    if (answer === "a" || answer === "approve") {
      manifest = updateCondition(manifest, spot.slug, condition, {
        image_status: "approved",
      });
      console.log("  ✓ Approved");
      reviewed++;
    } else if (answer === "r" || answer === "redo") {
      manifest = updateCondition(manifest, spot.slug, condition, {
        image_status: "rejected",
      });
      console.log("  ✗ Marked for redo");
      reviewed++;
    } else {
      console.log("  — Skipped");
    }

    saveManifest(manifest);
  }
}

if (reviewed === 0) {
  console.log("No images pending review.");
} else {
  console.log(`\nReviewed ${reviewed} images. Run \`yarn generate\` to regenerate rejected ones.`);
}
```

- [ ] **Step 2: Update package.json scripts to load .env**

The scripts need to load `.env` for the Gemini API key. Update `package.json` scripts:

```json
{
  "scripts": {
    "generate": "tsx --env-file=.env src/generate-images.ts",
    "review": "tsx src/review.ts"
  }
}
```

- [ ] **Step 3: Test the review flow**

```bash
cd ~/Desktop/dev/diorama-pipeline
yarn review blacks-beach
```

Expected: Opens `output/blacks-beach/small_day.png` in Preview.app, prompts for approve/redo/skip. On approve, manifest updates to `image_status: "approved"`.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/dev/diorama-pipeline
git add src/review.ts package.json
git commit -m "feat: add interactive review CLI for generated images"
```

---

### Task 7: End-to-End Smoke Test

No new files — this validates the full generate → review → regenerate cycle works.

- [ ] **Step 1: Generate all conditions for one spot**

```bash
cd ~/Desktop/dev/diorama-pipeline
yarn generate blacks-beach
```

Expected: 6 images generated (or 5 if small_day was already approved), all saved to `output/blacks-beach/`.

- [ ] **Step 2: Review all generated images**

```bash
yarn review blacks-beach
```

Expected: Opens each image one by one, prompts for approve/redo/skip. Mark at least one as "redo" to test the regeneration path.

- [ ] **Step 3: Regenerate rejected images**

```bash
yarn generate blacks-beach
```

Expected: Only regenerates the rejected conditions — approved ones are skipped with "Skipping (already approved)" message.

- [ ] **Step 4: Verify final manifest state**

```bash
cat manifest.json | python3 -m json.tool | head -30
```

Expected: Mix of `approved` and `review` statuses for blacks-beach conditions.

- [ ] **Step 5: Commit manifest initialization script update if any tweaks were needed**

Only commit if code changes were needed during smoke test. No commit needed if everything worked.

---

## What's Next (Future Plans)

These are **out of scope** for this plan but documented for sequencing:

1. **Remaining 15 custom spot prompts** — write spot configs for spots 5-19 in `spots.json`
2. **Video generation script** — `src/generate-videos.ts` using PiAPI/Kling API with seamless loop (`image_tail_url` = `image_url`), polling, and manifest tracking
3. **Upload script** — `src/upload.ts` with FFmpeg H.265 optimization + Supabase Storage upload + `beach_dioramas` table insert
4. **Semi-custom template system** — break-type templates (pier, point, beach break) for the ~30 non-custom spots
5. **Batch mode + contact sheet** — HTML review grid for batch-generated semi-custom spots
