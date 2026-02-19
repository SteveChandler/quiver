"use client";

import { useEffect, useRef, type RefObject } from "react";
import type {
  IChartApi,
  MouseEventParams,
  LogicalRange,
  Time,
} from "lightweight-charts";

/**
 * Synchronizes crosshair position and visible time range across multiple
 * lightweight-charts instances. When the user hovers over one chart, the
 * crosshair appears at the same time point on all other charts. When one
 * chart's visible range changes (zoom/scroll), all others follow.
 *
 * Accepts RefObjects so it always reads the latest chart instance, avoiding
 * stale-ref bugs when charts are initialised asynchronously.
 */
export function useChartSync(
  chartRefs: RefObject<IChartApi | null>[],
  enabled: boolean
) {
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const validCharts = chartRefs
      .map((r) => r.current)
      .filter((c): c is IChartApi => c !== null);
    if (validCharts.length < 2) return;

    const unsubscribers: (() => void)[] = [];

    // --- Crosshair sync ---
    for (const sourceChart of validCharts) {
      const handler = (param: MouseEventParams<Time>) => {
        if (isSyncing.current) return;
        isSyncing.current = true;

        try {
          for (const targetChart of validCharts) {
            if (targetChart === sourceChart) continue;

            if (param.time !== undefined) {
              const targetSeries = targetChart.panes()[0]?.getSeries()[0];
              if (targetSeries) {
                targetChart.setCrosshairPosition(
                  NaN,
                  param.time,
                  targetSeries
                );
              }
            } else {
              targetChart.clearCrosshairPosition();
            }
          }
        } finally {
          isSyncing.current = false;
        }
      };

      sourceChart.subscribeCrosshairMove(handler);
      unsubscribers.push(() => sourceChart.unsubscribeCrosshairMove(handler));
    }

    // --- Visible time range sync ---
    for (const sourceChart of validCharts) {
      const handler = (range: LogicalRange | null) => {
        if (isSyncing.current || !range) return;
        isSyncing.current = true;

        try {
          for (const targetChart of validCharts) {
            if (targetChart === sourceChart) continue;
            targetChart.timeScale().setVisibleLogicalRange(range);
          }
        } finally {
          isSyncing.current = false;
        }
      };

      sourceChart.timeScale().subscribeVisibleLogicalRangeChange(handler);
      unsubscribers.push(() =>
        sourceChart
          .timeScale()
          .unsubscribeVisibleLogicalRangeChange(handler)
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [chartRefs, enabled]);
}
