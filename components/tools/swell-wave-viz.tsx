"use client";

import { useMemo } from "react";

interface SwellWaveVizProps {
  heightFt: number;
  periodSeconds: number;
  /** Quality tier for color */
  qualityColor: "red" | "yellow" | "lime" | "green";
  width?: number;
  height?: number;
}

const COLOR_MAP = {
  red: "#ef4444",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
};

/**
 * SVG wave cross-section visualization.
 * Short period = choppy/close-together waves. Long period = smooth, spaced waves.
 *
 * Respects prefers-reduced-motion: renders a static bar chart instead of the
 * animated wave shape when the user has requested reduced motion.
 */
export function SwellWaveViz({
  heightFt,
  periodSeconds,
  qualityColor,
  width = 320,
  height = 120,
}: SwellWaveVizProps) {
  const waveColor = COLOR_MAP[qualityColor];

  const { wavePath, flatPath, waterLinePath } = useMemo(() => {
    const amplitude = Math.min(45, Math.max(8, (heightFt / 20) * 50));
    const wavelength = Math.max(30, Math.min(200, periodSeconds * 10));
    const baseY = height * 0.65;

    const points: [number, number][] = [];
    const steps = Math.ceil(width / 2);
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const y = baseY - amplitude * Math.sin((x / wavelength) * 2 * Math.PI);
      points.push([x, y]);
    }

    const waveParts = points
      .map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`))
      .join(" ");

    const filledPath = `${waveParts} L ${width},${height} L 0,${height} Z`;

    // Static flat-water path for reduced-motion fallback
    const flatPath = `M 0,${baseY} L ${width},${baseY} L ${width},${height} L 0,${height} Z`;

    const waterLinePath = `M 0,${baseY} L ${width},${baseY}`;

    return { wavePath: filledPath, flatPath, waterLinePath };
  }, [heightFt, periodSeconds, width, height]);

  // Reduced-motion: render a simple height bar instead of the wave shape
  const reducedMotionBar = (
    <>
      {/* Static fill */}
      <path d={flatPath} fill={waveColor} opacity={0.25} />
      <path
        d={`M 0,${height * 0.65} L ${width},${height * 0.65}`}
        fill="none"
        stroke={waveColor}
        strokeWidth={2}
      />
    </>
  );

  const waveAnimation = (
    <>
      {/* Reference water line */}
      <path
        d={waterLinePath}
        stroke="#334155"
        strokeWidth={1}
        strokeDasharray="4 4"
        fill="none"
      />
      {/* Wave fill */}
      <path d={wavePath} fill={waveColor} opacity={0.25} />
      {/* Wave line — strip the closing "L x,h L 0,h Z" segments */}
      <path
        d={wavePath.split(" L").slice(0, -2).join(" L")}
        fill="none"
        stroke={waveColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </>
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Wave cross-section: ${Math.round(heightFt)} ft at ${Math.round(periodSeconds)}s period`}
      style={{ maxWidth: "100%", height: "auto" }}
      className="select-none"
    >
      {/* Ocean background */}
      <rect x={0} y={0} width={width} height={height} fill="#0f172a" rx={8} />

      {/*
        @media (prefers-reduced-motion: reduce) hides the wave shape and shows
        the flat bar. CSS media query inside SVG via a <style> block is the
        simplest way to handle this without a JS matchMedia hook.
      */}
      <style>{`
        .wave-shape { display: block; }
        .reduced-shape { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .wave-shape { display: none; }
          .reduced-shape { display: block; }
        }
      `}</style>

      <g className="wave-shape">{waveAnimation}</g>
      <g className="reduced-shape">{reducedMotionBar}</g>

      {/* Labels always visible */}
      <text
        x={8}
        y={16}
        fontSize={11}
        fill="#94a3b8"
        fontFamily="var(--font-mono, monospace)"
      >
        {Math.round(periodSeconds)}s period
      </text>
      <text
        x={width - 8}
        y={16}
        textAnchor="end"
        fontSize={11}
        fill="#94a3b8"
        fontFamily="var(--font-mono, monospace)"
      >
        {heightFt % 1 === 0 ? heightFt : heightFt.toFixed(1)} ft
      </text>
    </svg>
  );
}
