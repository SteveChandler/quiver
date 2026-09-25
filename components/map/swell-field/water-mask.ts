import type mapboxgl from "mapbox-gl";

/** Rasterize actual rendered water polygons, including island holes, at viewport resolution. */
export function drawWaterMask(map: mapboxgl.Map, canvas: HTMLCanvasElement): void {
  const size = map.getCanvas();
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !size.clientWidth || !size.clientHeight) return;
  ctx.scale(size.width / size.clientWidth, size.height / size.clientHeight);
  const layers = (map.getStyle()?.layers ?? [])
    .filter((layer) => layer.type === "fill" && layer.id === "water")
    .map((layer) => layer.id);
  if (!layers.length) return;
  ctx.fillStyle = "white";
  for (const feature of map.queryRenderedFeatures({ layers })) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates]
      : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach((coordinate, index) => {
          const point = map.project([coordinate[0], coordinate[1]]);
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  }
}

/** Water cells over a frame, sampled on a coarse grid. Mirrors native's lib/swell-field/water-mask.ts. */
interface PixelWaterMask {
  cols: number;
  rows: number;
  /** 1 = water, row-major. */
  cells: Uint8Array;
}

// Mapbox streets-v11 water is #75CFF0, measured as the dominant colour in
// static images of La Jolla, Pacific Beach, and Satellite Beach.
const STREET_WATER_RGB = [117, 207, 240] as const;

export function isStreetWaterColor(r: number, g: number, b: number, a = 255): boolean {
  return a >= 250 && (r - STREET_WATER_RGB[0]) ** 2 + (g - STREET_WATER_RGB[1]) ** 2
    + (b - STREET_WATER_RGB[2]) ** 2 <= 28 ** 2;
}

/**
 * Read water from a streets-v11 static image shown with a centred
 * `object-fit: cover` crop. A cell is water when at least 5 of the 3x3 pixels
 * around its centre are, so labels and road casings over water don't punch holes.
 */
export function waterMaskFromPixels(
  rgba: Uint8ClampedArray | Uint8Array,
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  cols: number,
  rows: number,
): PixelWaterMask {
  const valid = [imgW, imgH, frameW, frameH, cols, rows].every((v) => Number.isFinite(v) && v > 0)
    && Number.isInteger(cols) && Number.isInteger(rows) && rgba.length >= imgW * imgH * 4;
  const mask: PixelWaterMask = { cols: valid ? cols : 0, rows: valid ? rows : 0, cells: new Uint8Array(valid ? cols * rows : 0) };
  if (!valid) return mask;
  const scale = Math.max(frameW / imgW, frameH / imgH);
  const cropX = (imgW - frameW / scale) / 2;
  const cropY = (imgH - frameH / scale) / 2;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = Math.floor(cropX + (col + 0.5) * frameW / cols / scale);
    const y = Math.floor(cropY + (row + 0.5) * frameH / rows / scale);
    let water = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const offset = (Math.max(0, Math.min(imgH - 1, y + dy)) * imgW
        + Math.max(0, Math.min(imgW - 1, x + dx))) * 4;
      if (isStreetWaterColor(rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3])) water++;
    }
    mask.cells[row * cols + col] = Number(water >= 5);
  }
  return mask;
}
