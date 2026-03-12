"use client";

// Convert compass direction string to arrow rotation degrees.
// 0 degrees = arrow pointing up (North). Clockwise from there.
function compassToArrowDegrees(direction: string): number {
  const dir = direction.trim().toUpperCase();
  const compassMap: Record<string, number> = {
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
  return compassMap[dir] ?? 0;
}

interface WindIndicatorProps {
  windDirection: string;
  windSpeed: number;
}

export function WindIndicator({ windDirection, windSpeed }: WindIndicatorProps) {
  const arrowDeg = compassToArrowDegrees(windDirection);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Compass circle */}
      <div
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#404C92] bg-[#2D357D]/70"
        aria-label={`Wind from ${windDirection} at ${windSpeed} mph`}
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
      <span className="text-medium font-mono text-[10px] leading-none">
        {windDirection} {windSpeed}mph
      </span>
    </div>
  );
}
