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
