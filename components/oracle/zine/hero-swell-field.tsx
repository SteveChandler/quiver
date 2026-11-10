"use client";

import { useEffect, useRef } from "react";

import { flowForPoint, partitionToPoint } from "@/components/map/swell-field/field-sampler";
import {
  BIRTH_FADE_PORTION,
  CREST_DEPTH_ASPECT,
  CREST_SOLID_PORTION,
  CREST_WAKE_START_ALPHA,
  DASH_FRACTION,
  DEATH_FADE_PORTION,
  FRAME_MS,
  LIFE_JITTER_FRAMES,
  MAX_FRAME_STEP,
  MIN_LIFE_FRAMES,
  PARTICLE_DASH_LENGTH_SCALE,
  STEP_FRACTION,
  STRENGTH_DENSITY_CULL,
  crestSizeScale,
  gridDimensions,
  resolveParticleCount,
} from "@/components/map/swell-field/particle-style";
import { waterMaskFromPixels } from "@/components/map/swell-field/water-mask";
import {
  SWELL_FIELD_DARK_STAGE_DASH_LENGTH_SCALE,
  SWELL_FIELD_PARTICLE_COLOR,
} from "@/components/map/swell-map-theme";
import type { SwellPartition } from "@/lib/domains/conditions/map-forecast";

/** `#RRGGBB` as an `rgba()` string with the given alpha. */
function hexWithAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

/** A loaded map image. `src` changes when `<picture>` swaps sources at a breakpoint. */
export interface LoadedMapImage {
  element: HTMLImageElement;
  src: string;
}

/** Water is read on cells this many CSS pixels across, as native's hero does. */
const MASK_CELL_PX = 4;
const GOLDEN_RATIO_FRACTION = 0.6180339887498949;

/**
 * The primary swell this reading draws, as /map picks it (the complete
 * offshore tuple, else swell 1), or null when it has nothing to draw.
 */
export function heroPrimarySwellFlow(partition: SwellPartition): ReturnType<typeof flowForPoint> | null {
  const point = partitionToPoint(0, 0, partition, "s1");
  if (!point) return null;
  const flow = flowForPoint(point);
  return flow.speed > 0 ? flow : null;
}

/**
 * Native's home hero field on a 2D canvas over the hero's streets map: the
 * primary swell as crest dashes across its direction of travel, clipped to
 * the water in the map image. Size, speed and fades are /map's
 * (components/map/swell-field/particle-style.ts); the colour and longer
 * crests are its dark stage, as native draws them. The hero shows one beach,
 * so the field carries that beach's reading everywhere, which is what /map
 * shows right beside it.
 */
export function HeroSwellField({
  image,
  partition,
}: {
  image: LoadedMapImage | null;
  partition: SwellPartition;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A fresh object with the same reading must not reseed the field.
  const partitionKey = JSON.stringify(partition);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !image) return;
    const flow = heroPrimarySwellFlow(JSON.parse(partitionKey) as SwellPartition);
    if (!flow) return;

    const pixels = readPixels(image.element);
    // Without the map's pixels there's no coastline, and crests over land read wrong.
    if (!pixels) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strength = Math.min(1, Math.max(0, flow.alpha));
    const baseAlpha = Math.min(1, 0.3 + strength * 0.7) * (reduceMotion ? 0.95 : 1);
    // The compact hero needs more open water than the full map.
    const count = Math.round(resolveParticleCount(window.innerWidth) * 0.25);
    const px = new Float64Array(count);
    const py = new Float64Array(count);
    const page = new Float32Array(count);
    const life = new Float32Array(count);
    const maskCanvas = document.createElement("canvas");
    let width = 0;
    let height = 0;
    let ratio = 1;
    let cols = 1;
    let rows = 1;
    let frame = 0;
    let lastFrameMs: number | null = null;
    let onScreen = true;

    const randomLife = () => MIN_LIFE_FRAMES + Math.random() * LIFE_JITTER_FRAMES;

    const layout = () => {
      ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const mask = waterMaskFromPixels(
        pixels.data,
        pixels.width,
        pixels.height,
        width,
        height,
        Math.ceil(width / MASK_CELL_PX),
        Math.ceil(height / MASK_CELL_PX),
      );
      const maskContext = maskCanvas.getContext("2d");
      if (maskContext && mask.cols > 0) {
        maskCanvas.width = mask.cols;
        maskCanvas.height = mask.rows;
        const cells = maskContext.createImageData(mask.cols, mask.rows);
        mask.cells.forEach((water, index) => {
          cells.data[index * 4 + 3] = water ? 255 : 0;
        });
        maskContext.putImageData(cells, 0, 0);
      }

      ({ cols, rows } = gridDimensions(count, { minX: 0, minY: 0, maxX: width, maxY: height }));
      for (let i = 0; i < count; i += 1) {
        px[i] = (i % cols + Math.random()) * (width / cols);
        py[i] = (Math.floor(i / cols) % rows + Math.random()) * (height / rows);
        life[i] = randomLife();
        page[i] = Math.random() * life[i];
      }
      lastFrameMs = null;
    };

    const draw = (deltaFrames: number) => {
      context.clearRect(0, 0, width, height);
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const step = width * STEP_FRACTION * flow.speed * deltaFrames;
      const halfLength = width * crestSizeScale(width) * DASH_FRACTION * PARTICLE_DASH_LENGTH_SCALE.s1
        * SWELL_FIELD_DARK_STAGE_DASH_LENGTH_SCALE * (0.45 + strength) * 0.5;
      // /map's crest chip: a solid band at the leading edge and a wake fading
      // behind it, drawn in a frame whose x runs along the crest and y along travel.
      const travel = Math.hypot(flow.vx, flow.vy) || 1;
      const ux = flow.vx / travel;
      const uy = flow.vy / travel;
      const depth = (halfLength * 2) / CREST_DEPTH_ASPECT;
      const solid = Math.max(depth * CREST_SOLID_PORTION, 1 / ratio);
      const front = depth * 0.5;
      const mid = front - solid;
      const back = -depth * 0.5;
      const densityFloor = 0.55 + strength * 0.45;
      const color = SWELL_FIELD_PARTICLE_COLOR.s1;
      const wake = context.createLinearGradient(0, mid, 0, back);
      wake.addColorStop(0, hexWithAlpha(color, CREST_WAKE_START_ALPHA));
      wake.addColorStop(1, hexWithAlpha(color, 0));

      for (let i = 0; i < count; i += 1) {
        px[i] += flow.vx * step;
        py[i] += flow.vy * step;
        page[i] += deltaFrames;
        if (px[i] < 0 || px[i] > width || py[i] < 0 || py[i] > height || page[i] > life[i]) {
          // Respawn in the particle's own grid cell so coverage stays even.
          px[i] = (i % cols + Math.random()) * cellWidth;
          py[i] = (Math.floor(i / cols) % rows + Math.random()) * cellHeight;
          life[i] = randomLife() * (0.55 + strength * 0.9);
          page[i] = 0;
          continue;
        }
        // Weaker swell thins the field: a stable per-particle threshold, no flicker.
        if (densityFloor < ((i * GOLDEN_RATIO_FRACTION) % 1) * STRENGTH_DENSITY_CULL) continue;
        const age = Math.min(1, Math.max(0, page[i] / Math.max(life[i], 1)));
        const fade = Math.min(1, age / BIRTH_FADE_PORTION, (1 - age) / DEATH_FADE_PORTION);
        if (fade <= 0) continue;
        context.globalAlpha = baseAlpha * fade;
        context.setTransform(-uy * ratio, ux * ratio, ux * ratio, uy * ratio, px[i] * ratio, py[i] * ratio);
        context.fillStyle = color;
        context.fillRect(-halfLength, mid, halfLength * 2, solid);
        context.fillStyle = wake;
        context.fillRect(-halfLength, back, halfLength * 2, mid - back);
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "destination-in";
      context.imageSmoothingEnabled = true;
      context.drawImage(maskCanvas, 0, 0, width, height);
      context.globalCompositeOperation = "source-over";
    };

    const tick = (now: number) => {
      const deltaMs = lastFrameMs == null ? FRAME_MS : now - lastFrameMs;
      lastFrameMs = now;
      const deltaFrames = deltaMs > 0 ? Math.min(MAX_FRAME_STEP, deltaMs / FRAME_MS) : 1;
      draw(deltaFrames);
      frame = window.requestAnimationFrame(tick);
    };
    const start = () => {
      if (reduceMotion || frame || !onScreen) return;
      lastFrameMs = null;
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    layout();
    if (reduceMotion) draw(0);
    start();

    const resizeObserver = new ResizeObserver(() => {
      layout();
      if (reduceMotion) draw(0);
    });
    resizeObserver.observe(canvas);
    // Like /map, only animate while the field is on screen.
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      if (onScreen) start();
      else stop();
    });
    intersectionObserver.observe(canvas);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [image, partitionKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="hero-swell-field"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

/** The map at its CSS size: enough for 4px water cells, a quarter of the @2x pixels. */
function readPixels(
  element: HTMLImageElement,
): { data: Uint8ClampedArray; width: number; height: number } | null {
  const width = Math.max(1, Math.round(element.naturalWidth / 2));
  const height = Math.max(1, Math.round(element.naturalHeight / 2));
  const sample = document.createElement("canvas");
  sample.width = width;
  sample.height = height;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context || !element.naturalWidth) return null;
  try {
    context.drawImage(element, 0, 0, width, height);
    return { data: context.getImageData(0, 0, width, height).data, width, height };
  } catch {
    // A map served without CORS headers taints the canvas.
    return null;
  }
}
