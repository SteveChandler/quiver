"use client";

import { useMemo } from "react";
import { isAngleInWindow } from "@/lib/analyzers/swell-analyzer";

interface SwellCompassProps {
  /** Current swell direction in degrees */
  swellDirectionDeg: number | null;
  /** Beach optimal swell window min degrees */
  windowMinDeg: number | null;
  /** Beach optimal swell window max degrees */
  windowMaxDeg: number | null;
  swellCardinal?: string;
  size?: number;
}

/**
 * SVG compass showing current swell direction relative to beach's optimal swell window.
 * Green arc = optimal window, arrow = current swell direction.
 */
export function SwellCompass({
  swellDirectionDeg,
  windowMinDeg,
  windowMaxDeg,
  swellCardinal = "",
  size = 240,
}: SwellCompassProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;

  const { windowArcPath, swellArrowPath, arrowColor } = useMemo(() => {
    // Build optimal swell window arc (green)
    let windowArcPath: string | null = null;

    if (windowMinDeg != null && windowMaxDeg != null) {
      const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
      const startRad = toRad(windowMinDeg);
      const endRad = toRad(windowMaxDeg);

      let sweep = windowMaxDeg - windowMinDeg;
      if (sweep < 0) sweep += 360;
      const largeArc = sweep > 180 ? 1 : 0;

      const x1 = cx + Math.cos(startRad) * r;
      const y1 = cy + Math.sin(startRad) * r;
      const x2 = cx + Math.cos(endRad) * r;
      const y2 = cy + Math.sin(endRad) * r;

      windowArcPath = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    }

    // Build swell direction arrow
    let swellArrowPath: string | null = null;
    let arrowColor = "#94a3b8";

    if (swellDirectionDeg != null) {
      const arrowRad = ((swellDirectionDeg - 90) * Math.PI) / 180;
      const arrowLen = r * 0.72;
      const tailLen = r * 0.18;

      const tipX = cx + Math.cos(arrowRad) * arrowLen;
      const tipY = cy + Math.sin(arrowRad) * arrowLen;
      const tailX = cx - Math.cos(arrowRad) * tailLen;
      const tailY = cy - Math.sin(arrowRad) * tailLen;

      const perpAngle = arrowRad + Math.PI / 2;
      const hw = 9;
      const backX = tipX - Math.cos(arrowRad) * 18;
      const backY = tipY - Math.sin(arrowRad) * 18;
      const hl = `${backX + Math.cos(perpAngle) * hw},${backY + Math.sin(perpAngle) * hw}`;
      const hr = `${backX - Math.cos(perpAngle) * hw},${backY - Math.sin(perpAngle) * hw}`;

      swellArrowPath = `M ${tailX},${tailY} L ${tipX},${tipY} M ${hl} L ${tipX},${tipY} L ${hr}`;

      if (windowMinDeg != null && windowMaxDeg != null) {
        const inWindow = isAngleInWindow(swellDirectionDeg, windowMinDeg, windowMaxDeg);
        arrowColor = inWindow ? "#22c55e" : "#ef4444";
      } else {
        arrowColor = "#94a3b8";
      }
    }

    return { windowArcPath, swellArrowPath, arrowColor };
  }, [swellDirectionDeg, windowMinDeg, windowMaxDeg, cx, cy, r]);

  const cardinalLabels = [
    { label: "N", deg: 0 },
    { label: "E", deg: 90 },
    { label: "S", deg: 180 },
    { label: "W", deg: 270 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Swell compass${swellDirectionDeg != null ? `: ${swellCardinal} (${Math.round(swellDirectionDeg)}°)` : ""}`}
      style={{ maxWidth: "100%", height: "auto" }}
      className="select-none"
    >
      {/* Optimal window sector */}
      {windowArcPath && (
        <path d={windowArcPath} fill="#22c55e" opacity={0.18} />
      )}

      {/* Compass ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#334155"
        strokeWidth={1.5}
      />

      {/* Tick marks */}
      {Array.from({ length: 36 }, (_, i) => {
        const angleDeg = i * 10;
        const angleRad = ((angleDeg - 90) * Math.PI) / 180;
        const isMajor = angleDeg % 90 === 0;
        const inner = isMajor ? r - 12 : r - 6;
        const x1 = cx + Math.cos(angleRad) * inner;
        const y1 = cy + Math.sin(angleRad) * inner;
        const x2 = cx + Math.cos(angleRad) * r;
        const y2 = cy + Math.sin(angleRad) * r;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#64748b"
            strokeWidth={isMajor ? 1.5 : 0.75}
          />
        );
      })}

      {/* Cardinal labels */}
      {cardinalLabels.map(({ label, deg }) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const labelR = r + 13;
        const x = cx + Math.cos(rad) * labelR;
        const y = cy + Math.sin(rad) * labelR;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight="600"
            fill="#334155"
            fontFamily="var(--font-heading, sans-serif)"
          >
            {label}
          </text>
        );
      })}

      {/* Swell arrow */}
      {swellArrowPath && (
        <path
          d={swellArrowPath}
          stroke={arrowColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}

      {/* Center */}
      <circle cx={cx} cy={cy} r={28} fill="#1E2558" stroke="rgba(64,76,146,0.5)" strokeWidth={1} />
      {swellDirectionDeg != null ? (
        <>
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontWeight="700"
            fill="#B8C7E0"
            fontFamily="var(--font-sans, sans-serif)"
          >
            {swellCardinal}
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fill="#7A8CC0"
            fontFamily="var(--font-mono, monospace)"
          >
            {Math.round(swellDirectionDeg)}°
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fill="#94a3b8"
          fontFamily="var(--font-sans, sans-serif)"
        >
          —
        </text>
      )}
    </svg>
  );
}
