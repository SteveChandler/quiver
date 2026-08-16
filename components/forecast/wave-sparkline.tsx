"use client";

/**
 * Wave Sparkline Component
 *
 * Lightweight 7-day wave height trend visualization.
 * Renders as an SVG path with bezier curves for wave-like appearance.
 *
 * @module components/forecast/wave-sparkline
 */

import { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Data point for the sparkline
 */
export interface SparklineDataPoint {
  /** Day label (e.g., "Mon", "Tue") */
  day: string;
  /** Wave height value */
  value: number;
  /** Whether this is the peak day */
  isPeak?: boolean;
}

/**
 * Props for the WaveSparkline component
 */
export interface WaveSparklineProps {
  /** Array of data points (typically 7 for week view) */
  data: SparklineDataPoint[];
  /** Width of the sparkline (default: 120) */
  width?: number;
  /** Height of the sparkline (default: 32) */
  height?: number;
  /** Whether to show the gradient fill (default: true) */
  showFill?: boolean;
  /** Whether to highlight the peak point (default: true) */
  showPeak?: boolean;
  /** Line color (default: ocean blue) */
  lineColor?: string;
  /** Fill gradient color (default: ocean blue) */
  fillColor?: string;
  /** Animation duration in ms (default: 800) */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generate smooth bezier curve path from data points
 */
function generateSmoothPath(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  padding = 4
): string {
  if (points.length < 2) return "";

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  // Normalize points to SVG coordinates
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const range = maxY - minY || 1;

  const normalizedPoints = points.map((p, i) => ({
    x: padding + (i / (points.length - 1)) * usableWidth,
    y: padding + usableHeight - ((p.y - minY) / range) * usableHeight,
  }));

  // Generate smooth bezier curve
  let path = `M ${normalizedPoints[0].x},${normalizedPoints[0].y}`;

  for (let i = 0; i < normalizedPoints.length - 1; i++) {
    const p0 = normalizedPoints[Math.max(0, i - 1)];
    const p1 = normalizedPoints[i];
    const p2 = normalizedPoints[i + 1];
    const p3 = normalizedPoints[Math.min(normalizedPoints.length - 1, i + 2)];

    // Calculate control points for smooth curve
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}

/**
 * Generate fill path (closes the curve to bottom)
 */
function generateFillPath(
  linePath: string,
  width: number,
  height: number,
  padding = 4
): string {
  if (!linePath) return "";

  // Close the path to create a fill area
  return `${linePath} L ${width - padding},${height} L ${padding},${height} Z`;
}

/**
 * WaveSparkline Component
 *
 * Displays a mini wave height trend chart with smooth curves.
 * Animates on scroll into view with path drawing effect.
 *
 * @example
 * ```tsx
 * const weekData = [
 *   { day: "Mon", value: 3.2 },
 *   { day: "Tue", value: 4.1, isPeak: true },
 *   { day: "Wed", value: 3.8 },
 *   { day: "Thu", value: 2.9 },
 *   { day: "Fri", value: 2.5 },
 *   { day: "Sat", value: 3.1 },
 *   { day: "Sun", value: 3.4 },
 * ];
 *
 * <WaveSparkline data={weekData} />
 * ```
 */
export function WaveSparkline({
  data,
  width = 120,
  height = 32,
  showFill = true,
  showPeak = true,
  lineColor = "#0ea5e9", // sky-500
  fillColor = "#0ea5e9",
  duration = 800,
  className,
}: WaveSparklineProps) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<SVGSVGElement>(null);
  const reducedMotion = useReducedMotion();

  // Generate path data
  const points = data.map((d, i) => ({ x: i, y: d.value }));
  const linePath = generateSmoothPath(points, width, height);
  const fillPath = generateFillPath(linePath, width, height);

  // Find peak point for highlighting
  const peakIndex = data.findIndex((d) => d.isPeak);
  const peakPoint =
    peakIndex >= 0
      ? {
          x:
            4 +
            (peakIndex / (data.length - 1)) * (width - 8),
          y:
            4 +
            (height - 8) -
            ((data[peakIndex].value - Math.min(...data.map((d) => d.value))) /
              (Math.max(...data.map((d) => d.value)) -
                Math.min(...data.map((d) => d.value)) || 1)) *
              (height - 8),
        }
      : null;

  // Intersection observer for animation trigger
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (reducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(element);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [reducedMotion]);

  // Calculate path length for animation
  const pathLength = 1000; // Approximate, will be animated

  return (
    <svg
      ref={elementRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-label="Wave height trend"
      role="img"
    >
      <defs>
        {/* Gradient fill */}
        <linearGradient
          id={`sparkline-gradient-${width}-${height}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      {showFill && fillPath && (
        <path
          d={fillPath}
          fill={`url(#sparkline-gradient-${width}-${height})`}
          className={cn(
            "transition-opacity duration-500",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Line path */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={reducedMotion ? "none" : pathLength}
        strokeDashoffset={reducedMotion || isVisible ? 0 : pathLength}
        style={{
          transition: reducedMotion
            ? "none"
            : `stroke-dashoffset ${duration}ms ease-out`,
        }}
      />

      {/* Peak point indicator */}
      {showPeak && peakPoint && (
        <circle
          cx={peakPoint.x}
          cy={peakPoint.y}
          r={3}
          fill={lineColor}
          className={cn(
            "transition-[opacity,transform] duration-300",
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
          )}
          style={{
            transitionDelay: reducedMotion ? "0ms" : `${duration}ms`,
            transformOrigin: `${peakPoint.x}px ${peakPoint.y}px`,
          }}
        />
      )}
    </svg>
  );
}

/**
 * Helper to create sparkline data from day summaries
 */
export function createSparklineData(
  days: Array<{
    dayOfWeek: string;
    avgWaveHeight: number;
    score: number;
  }>
): SparklineDataPoint[] {
  if (!days || days.length === 0) return [];

  // Find the peak day (highest score)
  const peakScore = Math.max(...days.map((d) => d.score));

  return days.map((day) => ({
    day: day.dayOfWeek.slice(0, 3),
    value: day.avgWaveHeight,
    isPeak: day.score === peakScore,
  }));
}
