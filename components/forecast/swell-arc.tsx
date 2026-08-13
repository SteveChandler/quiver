"use client";

/**
 * Swell Arc — sticky SVG data viz above the 7-Day Region Outlook.
 *
 * Plots `score` (0-100, absolute scale) as the primary smoothed curve so even
 * flat-wave weeks render a visible arc (wind/period/confidence all move the
 * score). A faint secondary trace shows `waveHeight` for the data-curious.
 * A single orange marker tracks whichever day row is most visible in the
 * viewport via IntersectionObserver on `[data-testid^="outlook-day-"]`. The
 * peak day gets a static anchor ring.
 *
 * The band is `position: sticky` above the outlook list. A 1px sentinel
 * above the sticky element detects the stuck state and adds a Charming
 * Orange top-edge accent.
 *
 * `prefers-reduced-motion` disables the marker transition and draw-in
 * animations; the arcs themselves always render.
 *
 * @module components/forecast/swell-arc
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface SwellArcPoint {
  dayOfWeek: string;
  dateString: string;
  waveHeight: number;
  score: number;
}

interface SwellArcProps {
  points: SwellArcPoint[];
  peakIndex: number;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 140;
const PADDING_X = 32;
const PADDING_Y_TOP = 20;
const PADDING_Y_BOTTOM = 28;
const INNER_H = VIEWBOX_HEIGHT - PADDING_Y_TOP - PADDING_Y_BOTTOM;
const INNER_W = VIEWBOX_WIDTH - PADDING_X * 2;

interface PlottedPoint {
  x: number;
  y: number;
  waveHeight: number;
  score: number;
}

/**
 * Plot points on an absolute 0–100 score scale. Keeps the arc visually
 * stable across regions (Hawaii and SoCal share the same y-axis) and
 * guarantees a visible curve even when every wave height is the same.
 */
function plotScore(points: SwellArcPoint[]): PlottedPoint[] {
  if (points.length === 0) return [];
  return points.map((p, i) => {
    const xRatio = points.length === 1 ? 0.5 : i / (points.length - 1);
    const scoreRatio = Math.max(0, Math.min(1, p.score / 100));
    return {
      x: PADDING_X + xRatio * INNER_W,
      y: VIEWBOX_HEIGHT - PADDING_Y_BOTTOM - scoreRatio * INNER_H,
      waveHeight: p.waveHeight,
      score: p.score,
    };
  });
}

/** Catmull-Rom → cubic Bezier conversion for a smoothly-interpolated curve. */
function smoothPath(pts: PlottedPoint[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  const path: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    );
  }
  return path.join(" ");
}

function areaPath(pts: PlottedPoint[]): string {
  if (pts.length === 0) return "";
  const top = smoothPath(pts);
  return `${top} L ${pts[pts.length - 1].x.toFixed(2)} ${VIEWBOX_HEIGHT - PADDING_Y_BOTTOM} L ${pts[0].x.toFixed(2)} ${VIEWBOX_HEIGHT - PADDING_Y_BOTTOM} Z`;
}

export function SwellArc({ points, peakIndex }: SwellArcProps) {
  const [activeIndex, setActiveIndex] = useState<number>(peakIndex);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const initializedRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const scorePoints = useMemo(() => plotScore(points), [points]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Active-day tracking via IntersectionObserver on each outlook row.
  // Deps intentionally exclude `activeIndex` — the observer should be set up
  // once per `points`/`peakIndex` change. Re-registering on every active-day
  // flip would tear down and rebuild the observer on every scroll tick.
  useEffect(() => {
    if (points.length === 0) return;
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid^="outlook-day-"]'
      )
    );
    if (rows.length === 0) return;

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(
            entry.target.getAttribute("data-testid")?.replace("outlook-day-", "")
          );
          if (!Number.isFinite(idx)) continue;
          ratios.set(idx, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestIdx = peakIndex;
        let bestRatio = -Infinity;
        ratios.forEach((ratio, idx) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIdx = idx;
          }
        });
        if (bestRatio > 0) {
          initializedRef.current = true;
          setActiveIndex(bestIdx);
        } else if (!initializedRef.current) {
          setActiveIndex(peakIndex);
        }
      },
      {
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [points, peakIndex]);

  // Sticky stuck-state via a 1px sentinel directly above the sticky band.
  // When the sentinel leaves the top of the viewport, the band has stuck.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: [0, 1] }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (scorePoints.length === 0) return null;

  const active =
    scorePoints[Math.min(activeIndex, scorePoints.length - 1)] ?? scorePoints[0];
  const peak = scorePoints[Math.min(peakIndex, scorePoints.length - 1)] ?? scorePoints[0];
  const activePoint =
    points[Math.min(activeIndex, points.length - 1)] ?? points[0];

  return (
    <>
      {/* Sentinel — the band becomes "stuck" once this scrolls off-screen. */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none h-[1px] w-full"
      />

      <div
        data-testid="swell-arc"
        data-stuck={isStuck ? "true" : undefined}
        className={[
          // Sticky offset clears `components/app-header.tsx` (sticky `top-0
          // z-50`). The offset reads `--site-header-height` if set (future-
          // proof when the header exposes its own height var) and falls back
          // to 72px, which covers the current desktop + mobile nav heights
          // with 4-8px of breathing room. z-20 sits ABOVE the outlook list
          // but BELOW both the app-header (z-50) and the mobile
          // StickySignupBar (z-50), so collisions are impossible.
          "sticky top-[calc(var(--site-header-height,72px))] z-20 mb-3 overflow-hidden rounded-2xl border bg-[#1a2051]/90 px-3 py-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-[border-color,box-shadow] duration-300",
          isStuck
            ? "border-[#F78E42]/50 shadow-[0_10px_36px_-14px_rgba(247,142,66,0.45)]"
            : "border-white/10",
        ].join(" ")}
      >
        <div className="mb-1.5 flex items-end justify-between gap-3 px-1">
          <div className="flex items-baseline gap-2">
            <span className="font-[var(--font-heading)] text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
              Swell arc
            </span>
            <span className="font-mono text-[0.68rem] uppercase tracking-wide text-white/40">
              score · 7d
            </span>
          </div>
          <span className="font-mono text-[0.72rem] uppercase tracking-wide text-[#F78E42]/90">
            {activePoint?.dayOfWeek?.slice(0, 3) ?? ""}
            {" · "}
            {activePoint?.score ?? 0}/100
            {" · "}
            {activePoint?.waveHeight?.toFixed(1) ?? "0.0"}ft
          </span>
        </div>

        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Swell arc across ${points.length} days, peak ${points[peakIndex]?.dayOfWeek ?? "unknown"}`}
          className="block h-[112px] w-full"
        >
          <defs>
            <linearGradient id="swell-arc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F78E42" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#F78E42" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="swell-arc-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7fb0ff" />
              <stop offset="55%" stopColor="#c7a3ff" />
              <stop offset="100%" stopColor="#F78E42" />
            </linearGradient>
          </defs>

          {/* Horizon reference line (score = 0) */}
          <line
            x1={PADDING_X}
            y1={VIEWBOX_HEIGHT - PADDING_Y_BOTTOM}
            x2={VIEWBOX_WIDTH - PADDING_X}
            y2={VIEWBOX_HEIGHT - PADDING_Y_BOTTOM}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {/* Filled area under the score curve */}
          <path
            d={areaPath(scorePoints)}
            fill="url(#swell-arc-area)"
            style={{
              animation: reduceMotion
                ? "none"
                : "swell-arc-fade 900ms ease-out both",
            }}
          />

          {/* Primary score curve */}
          <path
            d={smoothPath(scorePoints)}
            fill="none"
            stroke="url(#swell-arc-stroke)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: reduceMotion ? undefined : 2000,
              strokeDashoffset: reduceMotion ? undefined : 2000,
              animation: reduceMotion
                ? "none"
                : "swell-arc-draw 1100ms cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          />

          {/* Score dots */}
          {scorePoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === activeIndex ? 5.5 : 3}
              fill={i === activeIndex ? "#F78E42" : "rgba(255,255,255,0.65)"}
              stroke={i === activeIndex ? "#fff" : "none"}
              strokeWidth={i === activeIndex ? 1.5 : 0}
              style={{
                transition: reduceMotion
                  ? "none"
                  : "r 260ms cubic-bezier(0.34, 1.56, 0.64, 1), fill 260ms ease, stroke 260ms ease",
              }}
            />
          ))}

          {/* Peak-day anchor ring (static) */}
          <circle
            cx={peak.x}
            cy={peak.y}
            r={10}
            fill="none"
            stroke="#F78E42"
            strokeWidth={1.25}
            strokeOpacity={0.5}
          />

          {/* Active-day label above the marker */}
          <text
            x={active.x}
            y={Math.max(12, active.y - 10)}
            textAnchor="middle"
            className="font-mono"
            fill="rgba(255,255,255,0.85)"
            fontSize="11"
            style={{
              transition: reduceMotion ? "none" : "x 260ms ease, y 260ms ease",
            }}
          >
            {activePoint?.score ?? 0}
          </text>
        </svg>

        <style jsx>{`
          @keyframes swell-arc-draw {
            0% {
              stroke-dashoffset: 2000;
            }
            100% {
              stroke-dashoffset: 0;
            }
          }
          @keyframes swell-arc-fade {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </>
  );
}
