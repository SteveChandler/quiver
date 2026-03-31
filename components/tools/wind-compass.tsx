"use client";

import { useMemo } from "react";
import { circularAngleDiff } from "@/lib/services/magic-hour/direction-utils";

interface WindCompassProps {
  windDirectionDeg: number;
  windSpeedMph: number;
  offshoreDeg: number | null;
  toleranceDeg: number | null;
  /** Cardinal label for the wind direction e.g. "NW" */
  windCardinal: string;
  size?: number;
}

/**
 * SVG compass showing wind direction relative to beach shore orientation.
 * Green sector = offshore, yellow = cross-shore, red = onshore.
 * Works without orientation data — just shows the wind arrow.
 */
export function WindCompass({
  windDirectionDeg,
  windSpeedMph,
  offshoreDeg,
  toleranceDeg,
  windCardinal,
  size = 280,
}: WindCompassProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;

  const { sectorPaths, arrowPath, qualityColor } = useMemo(() => {
    // Convert meteorological direction (where wind comes FROM) to display angle
    // SVG 0deg = top (north), increases clockwise
    // Wind direction 0 = from north, display 0 = pointing north
    const windAngleRad = ((windDirectionDeg - 90) * Math.PI) / 180;

    const arrowLength = r * 0.7;
    const arrowTipX = cx + Math.cos(windAngleRad) * arrowLength;
    const arrowTipY = cy + Math.sin(windAngleRad) * arrowLength;
    const arrowTailX = cx - Math.cos(windAngleRad) * (r * 0.15);
    const arrowTailY = cy - Math.sin(windAngleRad) * (r * 0.15);

    // Arrow head points
    const perpAngle = windAngleRad + Math.PI / 2;
    const headWidth = 10;
    const headBackX = arrowTipX - Math.cos(windAngleRad) * 20;
    const headBackY = arrowTipY - Math.sin(windAngleRad) * 20;
    const headL = `${headBackX + Math.cos(perpAngle) * headWidth},${headBackY + Math.sin(perpAngle) * headWidth}`;
    const headR = `${headBackX - Math.cos(perpAngle) * headWidth},${headBackY - Math.sin(perpAngle) * headWidth}`;
    const arrowPath = `M ${arrowTailX},${arrowTailY} L ${arrowTipX},${arrowTipY} M ${headL} L ${arrowTipX},${arrowTipY} L ${headR}`;

    if (offshoreDeg == null || toleranceDeg == null) {
      return {
        sectorPaths: [],
        arrowPath,
        qualityColor: "#94a3b8",
      };
    }

    const diff = circularAngleDiff(windDirectionDeg, offshoreDeg);

    let qualityColor: string;
    if (diff <= toleranceDeg) {
      qualityColor = "#22c55e"; // green-500
    } else if (diff <= toleranceDeg * 1.5 || diff <= 90) {
      qualityColor = "#eab308"; // yellow-500
    } else {
      qualityColor = "#ef4444"; // red-500
    }

    // Build colored arc sectors
    // offshore sector (green): offshoreDeg ± toleranceDeg
    // onshore sector (red): opposite of offshore ± toleranceDeg
    // yellow: the rest
    function arcPath(startDeg: number, endDeg: number, color: string) {
      // Convert compass degrees to SVG angles (SVG 0 = right = east)
      const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
      const start = toRad(startDeg);
      const end = toRad(endDeg);

      const x1 = cx + Math.cos(start) * r;
      const y1 = cy + Math.sin(start) * r;
      const x2 = cx + Math.cos(end) * r;
      const y2 = cy + Math.sin(end) * r;

      let sweep = endDeg - startDeg;
      if (sweep < 0) sweep += 360;
      const largeArc = sweep > 180 ? 1 : 0;

      return {
        d: `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`,
        color,
      };
    }

    const tol = toleranceDeg;
    const offshore = offshoreDeg;
    const onshore = (offshore + 180) % 360;

    const sectors = [
      // Offshore (green)
      arcPath(offshore - tol, offshore + tol, "#22c55e"),
      // Onshore (red)
      arcPath(onshore - tol, onshore + tol, "#ef4444"),
      // Cross-shore NE quadrant (yellow) — fill remaining
      arcPath(offshore + tol, onshore - tol, "#eab308"),
      arcPath(onshore + tol, offshore - tol, "#eab308"),
    ];

    return { sectorPaths: sectors, arrowPath, qualityColor };
  }, [windDirectionDeg, offshoreDeg, toleranceDeg, cx, cy, r]);

  // Cardinal labels around compass
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
      aria-label={`Wind compass: ${windSpeedMph} mph from ${windCardinal}`}
      className="select-none"
      style={{ maxWidth: "100%", height: "auto" }}
    >
      {/* Background sectors */}
      {sectorPaths.map((sector, i) => (
        <path
          key={i}
          d={sector.d}
          fill={sector.color}
          opacity={0.18}
        />
      ))}

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
        const inner = isMajor ? r - 14 : r - 8;
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
        const labelR = r + 14;
        const x = cx + Math.cos(rad) * labelR;
        const y = cy + Math.sin(rad) * labelR;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight="600"
            fill="#334155"
            fontFamily="var(--font-heading, sans-serif)"
          >
            {label}
          </text>
        );
      })}

      {/* Wind direction arrow */}
      <path
        d={arrowPath}
        stroke={qualityColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Center display */}
      <circle cx={cx} cy={cy} r={36} fill="#1A2158" stroke="rgba(64,76,146,0.6)" strokeWidth={1} />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={18}
        fontWeight="700"
        fill="#ffffff"
        fontFamily="var(--font-mono, monospace)"
      >
        {Math.round(windSpeedMph)}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fill="#7A8CC0"
        fontFamily="var(--font-sans, sans-serif)"
      >
        mph
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="600"
        fill="#B8C7E0"
        fontFamily="var(--font-sans, sans-serif)"
      >
        {windCardinal}
      </text>
    </svg>
  );
}
