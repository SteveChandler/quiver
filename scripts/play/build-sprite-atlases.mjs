// Slices the art-direction reference sheets into Phaser atlases.
// Usage: node scripts/play/build-sprite-atlases.mjs  (reads .planning/play/reference/sheet-*.png)
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHEETS = [
  { key: "surfer", file: "sheet-1.png", groups: "groups-surfer.json", stripLabels: true },
  { key: "obstacles", file: "sheet-3.png", groups: "groups-obstacles.json", stripLabels: true },
  { key: "water", file: "sheet-4.png", groups: "groups-water.json", stripLabels: false },
  {
    key: "ui", file: "sheet-5.png", groups: "groups-ui.json", stripLabels: false,
    // plain plate corners (no baked text) for nine-slicing live HUD panels
    derived: [
      { name: "plate-dark", from: "panel-best-0", w: 36, h: 30, insetX: 0, insetY: 0 },
      { name: "plate-blue", from: "bar-danger-0", w: 36, h: 30, insetX: 0, insetY: 0 },
    ],
  },
];
const REFERENCE_DIR = ".planning/play/reference";
const OUT_DIR = "public/play/sprites";
const ALPHA_MIN = 24;

function baseBoxes(mask, W, H, rowGap = 6, colGap = 10, minSize = 12) {
  const rowCount = new Int32Array(H);
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) c += mask[y * W + x]; rowCount[y] = c; }
  const bands = []; let y = 0;
  while (y < H) { while (y < H && rowCount[y] === 0) y++; if (y >= H) break; let start = y, gap = 0, end = y; while (y < H) { if (rowCount[y] > 0) { end = y; gap = 0; } else { gap++; if (gap >= rowGap) break; } y++; } bands.push([start, end]); }
  const boxes = [];
  for (const [y0, y1] of bands) {
    const colCount = new Int32Array(W);
    for (let x = 0; x < W; x++) { let c = 0; for (let yy = y0; yy <= y1; yy++) c += mask[yy * W + x]; colCount[x] = c; }
    let x = 0;
    while (x < W) { while (x < W && colCount[x] === 0) x++; if (x >= W) break; let xs = x, gap = 0, xe = x; while (x < W) { if (colCount[x] > 0) { xe = x; gap = 0; } else { gap++; if (gap >= colGap) break; } x++; }
      let ty0 = y1, ty1 = y0; for (let yy = y0; yy <= y1; yy++) for (let xx = xs; xx <= xe; xx++) if (mask[yy * W + xx]) { if (yy < ty0) ty0 = yy; if (yy > ty1) ty1 = yy; }
      const w = xe - xs + 1, h = ty1 - ty0 + 1; if (w >= minSize && h >= minSize) boxes.push({ x: xs, y: ty0, w, h }); }
  }
  return boxes;
}

function stripLabelPlates(data, mask, W, H) {
  const navy = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const o = i * 4; navy[i] = data[o + 3] > 200 && data[o] < 70 && data[o + 1] < 90 && data[o + 2] < 130 && data[o + 2] > data[o] ? 1 : 0; }
  const seen = new Uint8Array(W * H); const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!navy[s] || seen[s]) continue;
    let x0 = W, x1 = 0, y0 = H, y1 = 0, n = 0; stack.push(s); seen[s] = 1;
    while (stack.length) { const p = stack.pop(); n++; const px = p % W, py = (p / W) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      for (const q of [p - 1, p + 1, p - W, p + W]) { if (q < 0 || q >= W * H || seen[q] || !navy[q]) continue; if (Math.abs((q % W) - px) > 1) continue; seen[q] = 1; stack.push(q); } }
    const h = y1 - y0 + 1, w = x1 - x0 + 1;
    if (h >= 18 && h <= 34 && w >= 40 && n > w * h * 0.3) for (let yy = y0 - 1; yy <= y1 + 1; yy++) for (let xx = x0 - 1; xx <= x1 + 1; xx++) if (yy >= 0 && yy < H && xx >= 0 && xx < W) mask[yy * W + xx] = 0;
  }
}

function splitAxis(lo, hi, n, density) {
  const cuts = [lo]; const span = hi - lo + 1;
  for (let k = 1; k < n; k++) { const exp = lo + Math.round((k * span) / n); const half = Math.round((span / n) * 0.35); let best = exp, bestV = Infinity; for (let v = exp - half; v <= exp + half; v++) { const d = density(v); if (d < bestV) { bestV = d; best = v; } } cuts.push(best); }
  cuts.push(hi + 1); return cuts;
}

function sliceGroups(mask, W, base, groups) {
  const tight = (l, r, t, b) => { let tx0 = r, tx1 = l, ty0 = b, ty1 = t; for (let yy = t; yy <= b; yy++) for (let xx = l; xx <= r; xx++) if (mask[yy * W + xx]) { if (xx < tx0) tx0 = xx; if (xx > tx1) tx1 = xx; if (yy < ty0) ty0 = yy; if (yy > ty1) ty1 = yy; } return tx1 < tx0 ? null : { x: tx0, y: ty0, w: tx1 - tx0 + 1, h: ty1 - ty0 + 1 }; };
  const frames = []; const counters = {};
  for (const g of groups) {
    const bs = (g.boxes ?? []).map((i) => base[i]);
    const x0 = g.xRange ? g.xRange[0] : Math.min(...bs.map((b) => b.x)), x1 = g.xRange ? g.xRange[1] : Math.max(...bs.map((b) => b.x + b.w - 1));
    const y0 = g.yRange ? g.yRange[0] : Math.min(...bs.map((b) => b.y)), y1 = g.yRange ? g.yRange[1] : Math.max(...bs.map((b) => b.y + b.h - 1));
    const rowsN = g.rows ?? 1; const upper = g.upper ?? 0.7;
    const rowCuts = splitAxis(y0, y1, rowsN, (yy) => { let c = 0; for (let xx = x0; xx <= x1; xx++) c += mask[yy * W + xx]; return c; });
    for (let r = 0; r < rowsN; r++) {
      const ry0 = rowCuts[r], ry1 = rowCuts[r + 1] - 1; const yTop = ry0 + Math.round((ry1 - ry0) * upper);
      const cuts = splitAxis(x0, x1, g.count, (xx) => { let c = 0; for (let yy = ry0; yy <= yTop; yy++) c += mask[yy * W + xx]; return c; });
      for (let k = 0; k < g.count; k++) { const t = tight(cuts[k], cuts[k + 1] - 1, ry0, ry1); if (!t) continue; counters[g.name] = counters[g.name] ?? 0; frames.push({ name: `${g.name}-${counters[g.name]++}`, ...t }); }
    }
  }
  return frames;
}

function shelfPack(frames, maxWidth = 2048, pad = 2) {
  const sorted = [...frames].sort((a, b) => b.h - a.h);
  let x = pad, y = pad, shelf = 0, width = 0;
  for (const f of sorted) { if (x + f.w + pad > maxWidth) { x = pad; y += shelf + pad; shelf = 0; } f.ax = x; f.ay = y; x += f.w + pad; shelf = Math.max(shelf, f.h); width = Math.max(width, x); }
  return { width: Math.min(maxWidth, width + pad), height: y + shelf + pad };
}

mkdirSync(OUT_DIR, { recursive: true });
const manifest = { atlases: [] };
for (const sheet of SHEETS) {
  const input = path.join(REFERENCE_DIR, sheet.file);
  const groups = JSON.parse(readFileSync(path.join("scripts/play", sheet.groups), "utf8"));
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const mask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > ALPHA_MIN ? 1 : 0;
  const base = baseBoxes(mask, W, H);
  if (sheet.stripLabels) stripLabelPlates(data, mask, W, H);
  const frames = sliceGroups(mask, W, base, groups);
  for (const d of sheet.derived ?? []) { const src = frames.find((f) => f.name === d.from); if (!src) continue; frames.push({ name: d.name, x: src.x + src.w - d.w - d.insetX, y: src.y + src.h - d.h - d.insetY, w: d.w, h: d.h }); }
  const size = shelfPack(frames);
  const composites = [];
  for (const f of frames) {
    // keep only masked pixels inside the crop so neighbouring spray and label remnants do not bleed in
    const crop = Buffer.alloc(f.w * f.h * 4);
    for (let yy = 0; yy < f.h; yy++) for (let xx = 0; xx < f.w; xx++) { const si = ((f.y + yy) * W + (f.x + xx)); const di = (yy * f.w + xx) * 4; if (!mask[si]) continue; crop[di] = data[si * 4]; crop[di + 1] = data[si * 4 + 1]; crop[di + 2] = data[si * 4 + 2]; crop[di + 3] = data[si * 4 + 3]; }
    composites.push({ input: crop, raw: { width: f.w, height: f.h, channels: 4 }, left: f.ax, top: f.ay });
  }
  const image = `${sheet.key}.png`, json = `${sheet.key}.json`;
  await sharp({ create: { width: size.width, height: size.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 }).toFile(path.join(OUT_DIR, image));
  const hash = {};
  for (const f of frames) hash[f.name] = { frame: { x: f.ax, y: f.ay, w: f.w, h: f.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h } };
  writeFileSync(path.join(OUT_DIR, json), JSON.stringify({ frames: hash, meta: { app: "build-sprite-atlases", image, size: size, scale: "1" } }));
  manifest.atlases.push({ key: sheet.key, image: `/play/sprites/${image}`, json: `/play/sprites/${json}`, frames: frames.map((f) => f.name) });
  console.log(sheet.key, frames.length, "frames", `${size.width}x${size.height}`);
}
writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
