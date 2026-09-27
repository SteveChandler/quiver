import type { BeachWeekSwell } from "@/lib/utils/beach-week";

export interface SwellGlyphGeometry {
  lines: number;
  strokeWidth: number;
  rotationDeg: number;
}

/** Spacing reads as period, weight as size, tilt as where the swell comes from (W = level). */
export function swellGlyphGeometry(swell: BeachWeekSwell): SwellGlyphGeometry {
  const lines = swell.periodS >= 14 ? 2 : swell.periodS >= 10 ? 3 : 4;
  const strokeWidth = Math.min(4, Math.max(1.4, Math.round((1 + swell.heightFt * 0.5) * 10) / 10));
  const rotationDeg = Math.max(-80, Math.min(80, swell.directionDeg - 270));
  return { lines, strokeWidth, rotationDeg };
}

export function SwellGlyph({ swell, color }: { swell: BeachWeekSwell; color: string }) {
  const { lines, strokeWidth, rotationDeg } = swellGlyphGeometry(swell);
  const gap = 32 / (lines + 1);
  return (
    <svg width="100%" height="44" viewBox="0 0 120 44" aria-hidden="true">
      <g transform={`rotate(${rotationDeg} 60 22)`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round">
        {Array.from({ length: lines }, (_, i) => {
          const y = 6 + gap * (i + 1);
          return <path key={i} d={`M8 ${y}q26-8 52 0t52 0`} />;
        })}
      </g>
    </svg>
  );
}
