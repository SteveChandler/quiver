"use client";

// Convert compass direction string to arrow rotation degrees.
// 0 degrees = arrow pointing up (North). Clockwise from there.
const COMPASS_MAP: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

/**
 * Convert a wind direction value to arrow rotation degrees.
 * Accepts compass strings ("NW", "SSE") or numeric degrees (0-360).
 * Returns 0 (North) for unrecognised values.
 */
function toArrowDegrees(direction: string | number | null | undefined): number {
  if (direction == null) return 0;

  // Numeric degrees — use directly (mod 360)
  if (typeof direction === "number") {
    return ((direction % 360) + 360) % 360;
  }

  // String — try compass lookup first, then parse as numeric string
  const dir = direction.trim().toUpperCase();
  if (COMPASS_MAP[dir] !== undefined) return COMPASS_MAP[dir];

  const parsed = parseFloat(dir);
  if (!isNaN(parsed)) return ((parsed % 360) + 360) % 360;

  return 0;
}

/**
 * Normalise wind direction to a display-friendly compass string.
 * If the input is already a compass string it passes through; numeric
 * degrees are converted to the nearest 16-point compass direction.
 */
function toCompassLabel(direction: string | number | null | undefined): string {
  if (direction == null) return "—";
  if (typeof direction === "string" && isNaN(Number(direction))) return direction;

  const deg = typeof direction === "number" ? direction : parseFloat(String(direction));
  if (isNaN(deg)) return "—";

  const DIRECTIONS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return DIRECTIONS[idx];
}

interface WindIndicatorProps {
  windDirection: string | number;
  windSpeed: number;
}

export function WindIndicator({ windDirection, windSpeed }: WindIndicatorProps) {
  const arrowDeg = toArrowDegrees(windDirection);
  const compassLabel = toCompassLabel(windDirection);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Compass circle */}
      <div
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#404C92] bg-[#2D357D]/70"
        aria-label={`Wind from ${compassLabel} at ${windSpeed} mph`}
      >
        {/* Arrow SVG — points in the wind direction */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          style={{ transform: `rotate(${arrowDeg}deg)` }}
        >
          {/* Arrow shaft */}
          <line x1="7" y1="11" x2="7" y2="3" stroke="#4A70D9" strokeWidth="1.5" strokeLinecap="round" />
          {/* Arrowhead */}
          <polyline points="4,6 7,3 10,6" stroke="#4A70D9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      {/* Label */}
      <span className="text-medium font-mono text-[11px] leading-none">
        {windSpeed === 0 ? "Calm" : `${compassLabel} ${windSpeed}mph`}
      </span>
    </div>
  );
}
