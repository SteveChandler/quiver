import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const MIN_AREA = 80;
const PADDING = 2;
const ATLAS_WIDTH = 1024;

function isNearWhite(data, offset) {
  return data[offset] >= 246 && data[offset + 1] >= 246 && data[offset + 2] >= 246;
}

function buildMask(data, width, height, hasAlpha) {
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    mask[index] = data[offset + 3] > 16 ? 1 : 0;
  }
  if (hasAlpha) return mask;

  const queue = new Int32Array(mask.length);
  const background = new Uint8Array(mask.length);
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (background[index] || !isNearWhite(data, index * 4)) return;
    background[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  for (let index = 0; index < mask.length; index += 1) {
    if (background[index]) mask[index] = 0;
  }
  return mask;
}

function findComponents(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const components = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 1;
    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;
    seen[start] = 1;
    queue[0] = start;
    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (!mask[next] || seen[next]) continue;
          seen[next] = 1;
          queue[tail] = next;
          tail += 1;
        }
      }
    }
    if (tail < MIN_AREA) continue;
    components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area: tail });
  }
  return components.sort((left, right) => right.height - left.height || right.width - left.width);
}

function pack(components) {
  let x = PADDING;
  let y = PADDING;
  let rowHeight = 0;
  for (const component of components) {
    if (x + component.width + PADDING > ATLAS_WIDTH) {
      x = PADDING;
      y += rowHeight + PADDING;
      rowHeight = 0;
    }
    component.atlasX = x;
    component.atlasY = y;
    x += component.width + PADDING;
    rowHeight = Math.max(rowHeight, component.height);
  }
  return y + rowHeight + PADDING;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function extractSheet(input, name, outputDirectory) {
  const source = sharp(input).ensureAlpha();
  const metadata = await sharp(input).metadata();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const mask = buildMask(data, info.width, info.height, metadata.hasAlpha === true);
  const components = findComponents(mask, info.width, info.height);
  const atlasHeight = pack(components);
  const composites = [];
  const frames = {};
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const frameName = `${name}-${String(index).padStart(3, "0")}`;
    const image = await source.clone().extract({
      left: component.x,
      top: component.y,
      width: component.width,
      height: component.height,
    }).png().toBuffer();
    composites.push({ input: image, left: component.atlasX, top: component.atlasY });
    frames[frameName] = {
      frame: { x: component.atlasX, y: component.atlasY, w: component.width, h: component.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: component.width, h: component.height },
      sourceSize: { w: component.width, h: component.height },
    };
  }

  const atlasFile = path.join(outputDirectory, `${name}.png`);
  const jsonFile = path.join(outputDirectory, `${name}.json`);
  await sharp({
    create: { width: ATLAS_WIDTH, height: Math.max(1, atlasHeight), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toFile(atlasFile);
  await writeFile(jsonFile, `${JSON.stringify({
    frames,
    meta: { app: "Quiver sprite extractor", image: `${name}.png`, format: "RGBA8888", size: { w: ATLAS_WIDTH, h: atlasHeight }, scale: "1" },
  }, null, 2)}\n`);

  const medianWidth = median(components.map((component) => component.width));
  const medianHeight = median(components.map((component) => component.height));
  const consistent = components.filter((component) => (
    component.width >= medianWidth * 0.55 && component.width <= medianWidth * 1.8
    && component.height >= medianHeight * 0.55 && component.height <= medianHeight * 1.8
  )).length;
  return {
    input,
    frames: components.length,
    medianSize: `${medianWidth}x${medianHeight}`,
    consistency: components.length === 0 ? 0 : Number((consistent / components.length).toFixed(2)),
    recommended: components.length >= 8 && consistent / components.length >= 0.7,
  };
}

const root = process.cwd();
const outputDirectory = path.join(root, "public/play/sprites/extracted");
const inputs = process.argv.slice(2);
const sheets = inputs.length > 0
  ? inputs.map((input, index) => ({ input, name: `sheet-${index + 1}` }))
  : [
      { input: ".planning/play/reference/sheet-1.png", name: "surfer" },
      { input: ".planning/play/reference/sheet-3.png", name: "obstacles" },
    ];
await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const sheet of sheets) results.push(await extractSheet(sheet.input, sheet.name, outputDirectory));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
