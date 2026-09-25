"use client";

import { useEffect, useRef } from "react";

import { flowForPoint, partitionToPoint } from "@/components/map/swell-field/field-sampler";
import {
  BIRTH_FADE_PORTION,
  COMBINED_PARTICLE_COUNT,
  DASH_FRACTION,
  DASH_WIDTH_PX_BASE,
  DASH_WIDTH_PX_GAIN,
  DEATH_FADE_PORTION,
  FRAME_MS,
  LIFE_JITTER_FRAMES,
  MAX_FRAME_STEP,
  MIN_LIFE_FRAMES,
  PARTICLE_DASH_LENGTH_SCALE,
  PARTICLE_MOTION_SCALE,
  STEP_FRACTION,
  STRENGTH_DENSITY_CULL,
  WIND_PARTICLE_SCALE,
  WIND_STREAK_FRACTION,
  gridDimensions,
  resolveParticleCount,
} from "@/components/map/swell-field/particle-style";
import { waterMaskFromPixels } from "@/components/map/swell-field/water-mask";
import {
  SWELL_FIELD_DARK_STAGE_DASH_LENGTH_SCALE,
  SWELL_FIELD_PARTICLE_COLOR_DARK_STAGE,
} from "@/components/map/swell-map-theme";
import type { SwellPartition } from "@/lib/domains/conditions/map-forecast";

/** A loaded map image. `src` changes when `<picture>` swaps sources at a breakpoint. */
export interface LoadedMapImage {
  element: HTMLImageElement;
  src: string;
}

type HeroFieldLayerId = "s1" | "s2" | "wind";

/** /map's layer names (swell-layer-selector.tsx). */
export const HERO_FIELD_LAYER_LABELS: Record<HeroFieldLayerId, string> = {
  s1: "Primary",
  s2: "Secondary",
  wind: "Wind",
};

const LAYER_ORDER: readonly HeroFieldLayerId[] = ["s1", "s2", "wind"];

/** Water is read on cells this many CSS pixels across, as native's hero does. */
const MASK_CELL_PX = 4;
const GOLDEN_RATIO_FRACTION = 0.6180339887498949;

/** The layers this reading can draw, in /map's order. Calm wind draws nothing. */
export function heroFieldLayers(partition: SwellPartition): HeroFieldLayerId[] {
  return LAYER_ORDER.filter((id) => {
    const point = partitionToPoint(0, 0, partition, id);
    if (!point) return false;
    return id === "wind" ? (partition.windMph ?? 0) > 0 : flowForPoint(point).speed > 0;
  });
}

/** Native's wind opacity (quiver-native forecast-swell-field.ts windOpacityForSpeed). */
function windOpacityForSpeed(windMph: number): number {
  return Math.max(0.15, Math.min(0.9, windMph * 0.045));
}

interface FieldLayer {
  id: HeroFieldLayerId;
  wind: boolean;
  color: string;
  count: number;
  vx: number;
  vy: number;
  speed: number;
  strength: number;
  baseAlpha: number;
  px: Float64Array;
  py: Float64Array;
  page: Float32Array;
  life: Float32Array;
  cols: number;
  rows: number;
}

/**
 * Native's combined swell field, the one its Explore map and beach forecast
 * draw, on a 2D canvas over the hero's streets map. Primary and secondary
 * swell are crest dashes across their direction of travel, clipped to the
 * water in the map image. Wind is a thin streak along its travel, over land
 * and water alike. Spacing, size, speed and fades are /map's
 * (components/map/swell-field/particle-style.ts); colours and the longer
 * crests are its dark stage. The hero shows one beach, so each layer carries
 * that beach's reading everywhere, which is what the field shows beside it.
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
    const reading = JSON.parse(partitionKey) as SwellPartition;
    const ids = heroFieldLayers(reading);
    if (ids.length === 0) return;

    const pixels = readPixels(image.element);
    // Without the map's pixels there's no coastline, and crests over land read wrong.
    if (!pixels) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const baseCount = ids.length > 1 ? COMBINED_PARTICLE_COUNT : resolveParticleCount(window.innerWidth);
    const layers: FieldLayer[] = ids.map((id) => {
      const flow = flowForPoint(partitionToPoint(0, 0, reading, id)!);
      const strength = Math.min(1, Math.max(0, flow.alpha));
      const wind = id === "wind";
      const count = wind ? Math.round(baseCount * WIND_PARTICLE_SCALE) : baseCount;
      return {
        id,
        wind,
        color: SWELL_FIELD_PARTICLE_COLOR_DARK_STAGE[id],
        count,
        vx: flow.vx,
        vy: flow.vy,
        speed: flow.speed * PARTICLE_MOTION_SCALE[id],
        strength,
        baseAlpha:
          (wind ? windOpacityForSpeed(reading.windMph ?? 0) : Math.min(1, 0.3 + strength * 0.7))
          * (reduceMotion ? 0.95 : 1),
        px: new Float64Array(count),
        py: new Float64Array(count),
        page: new Float32Array(count),
        life: new Float32Array(count),
        cols: 1,
        rows: 1,
      };
    });
    const maskCanvas = document.createElement("canvas");
    let width = 0;
    let height = 0;
    let ratio = 1;
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

      for (const layer of layers) {
        ({ cols: layer.cols, rows: layer.rows } = gridDimensions(layer.count, {
          minX: 0,
          minY: 0,
          maxX: width,
          maxY: height,
        }));
        for (let i = 0; i < layer.count; i += 1) {
          layer.px[i] = (i % layer.cols + Math.random()) * (width / layer.cols);
          layer.py[i] = (Math.floor(i / layer.cols) % layer.rows + Math.random()) * (height / layer.rows);
          layer.life[i] = randomLife();
          layer.page[i] = Math.random() * layer.life[i];
        }
      }
      lastFrameMs = null;
    };

    const drawLayer = (layer: FieldLayer, deltaFrames: number) => {
      const { px, py, page, life, cols, rows, strength } = layer;
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const step = width * STEP_FRACTION * layer.speed * deltaFrames;
      const halfLength = layer.wind
        ? width * WIND_STREAK_FRACTION * (0.55 + strength * 0.8) * 0.5
        : width * DASH_FRACTION * PARTICLE_DASH_LENGTH_SCALE[layer.id]
          * SWELL_FIELD_DARK_STAGE_DASH_LENGTH_SCALE * (0.45 + strength) * 0.5;
      // Wind streaks run with the flow; swell crests run across it.
      const markX = (layer.wind ? layer.vx : -layer.vy) * halfLength;
      const markY = (layer.wind ? layer.vy : layer.vx) * halfLength;
      const densityFloor = 0.55 + strength * 0.45;

      context.strokeStyle = layer.color;
      context.lineCap = "butt";
      // Weights are device pixels, as on /map.
      context.lineWidth = layer.wind ? 1 / ratio : (DASH_WIDTH_PX_BASE + strength * DASH_WIDTH_PX_GAIN) / ratio;

      for (let i = 0; i < layer.count; i += 1) {
        px[i] += layer.vx * step;
        py[i] += layer.vy * step;
        page[i] += deltaFrames;
        if (px[i] < 0 || px[i] > width || py[i] < 0 || py[i] > height || page[i] > life[i]) {
          // Respawn in the particle's own grid cell so coverage stays even.
          px[i] = (i % cols + Math.random()) * cellWidth;
          py[i] = (Math.floor(i / cols) % rows + Math.random()) * cellHeight;
          life[i] = randomLife() * (0.55 + strength * 0.9);
          page[i] = 0;
          continue;
        }
        // Weaker fields thin out: a stable per-particle threshold, no flicker.
        if (densityFloor < ((i * GOLDEN_RATIO_FRACTION) % 1) * STRENGTH_DENSITY_CULL) continue;
        const age = Math.min(1, Math.max(0, page[i] / Math.max(life[i], 1)));
        const fade = Math.min(1, age / BIRTH_FADE_PORTION, (1 - age) / DEATH_FADE_PORTION);
        if (fade <= 0) continue;
        context.globalAlpha = layer.baseAlpha * fade;
        context.beginPath();
        context.moveTo(px[i] - markX, py[i] - markY);
        context.lineTo(px[i] + markX, py[i] + markY);
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    const draw = (deltaFrames: number) => {
      context.clearRect(0, 0, width, height);
      for (const layer of layers) if (!layer.wind) drawLayer(layer, deltaFrames);
      // Clip the swell to water before wind goes on top, as /map masks only swell.
      context.globalCompositeOperation = "destination-in";
      context.imageSmoothingEnabled = true;
      context.drawImage(maskCanvas, 0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      for (const layer of layers) if (layer.wind) drawLayer(layer, deltaFrames);
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
