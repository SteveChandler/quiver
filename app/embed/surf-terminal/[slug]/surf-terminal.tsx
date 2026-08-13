"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  MouseEventParams,
  Time,
} from "lightweight-charts";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  transformForecastsToChartData,
  utcToLocalChartTimestamp,
  localChartTimestampToUtc,
  type BeachChartConfig,
  type SurfTerminalData,
} from "./data-transform";
import {
  DARK_THEME,
  LIGHT_THEME,
  PANE_RATIOS,
  TIME_RANGES,
  type ChartTheme,
  MIN_CHART_HEIGHT,
} from "./chart-config";
import { useChartSync } from "./use-chart-sync";
import { DetailCard } from "./detail-card";
import { useEmbedImpression } from "@/hooks/use-embed-impression";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SurfTerminalProps {
  beachName: string;
  beachUrl: string;
  slug: string;
  forecasts: EnhancedForecastEntity[];
  windOffshoreDeg: number;
  windOffshoreTolDeg: number;
  timezone: string;
  theme: "dark" | "light";
  initialRange: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findNearestForecast(
  forecasts: EnhancedForecastEntity[],
  timeSec: number
): EnhancedForecastEntity | null {
  if (!forecasts.length) return null;
  let nearest = forecasts[0];
  let minDist = Math.abs(
    new Date(forecasts[0].forecast_at).getTime() / 1000 - timeSec
  );
  for (const fc of forecasts) {
    const dist = Math.abs(
      new Date(fc.forecast_at).getTime() / 1000 - timeSec
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = fc;
    }
  }
  return nearest;
}

/** Build shared chart options from the active theme */
function buildChartOptions(t: ChartTheme) {
  return {
    layout: {
      background: { color: t.background },
      textColor: t.textColor,
      fontFamily: "monospace",
    },
    grid: {
      vertLines: { color: t.gridColor },
      horzLines: { color: t.gridColor },
    },
    crosshair: {
      mode: 0 as const, // CrosshairMode.Normal
      vertLine: { color: t.crosshairColor },
      horzLine: { color: t.crosshairColor },
    },
    timeScale: {
      borderColor: t.gridColor,
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: t.gridColor,
    },
    handleScale: false as const,
    handleScroll: true,
  };
}

/** Set data on all series from the provided chart data */
function setDataOnSeries(
  data: SurfTerminalData,
  wave: ISeriesApi<"Area"> | null,
  tide: ISeriesApi<"Line"> | null,
  ml: ISeriesApi<"Line"> | null,
  windAnchor: ISeriesApi<"Line"> | null,
  wind: ISeriesApi<"Histogram"> | null,
  swell: ISeriesApi<"Line"> | null
) {
  if (wave) {
    wave.setData(
      data.waveHeight.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }))
    );
  }

  if (tide) {
    tide.setData(
      data.tideHeight.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }))
    );
  }

  if (ml) {
    ml.setData(
      data.mlCorrectedHeight.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }))
    );
  }

  // Invisible anchor series shares wave chart's dense time points so
  // the crosshair on the wind pane snaps to fine-grained positions.
  if (windAnchor) {
    windAnchor.setData(
      data.waveHeight.map((d) => ({
        time: d.time as UTCTimestamp,
        value: 0,
      }))
    );
  }

  if (wind) {
    wind.setData(
      data.windSpeed.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
        color: d.color,
      }))
    );
  }

  if (swell) {
    swell.setData(
      data.swellPeriod.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }))
    );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SurfTerminal({
  beachName,
  beachUrl,
  slug,
  forecasts,
  windOffshoreDeg,
  windOffshoreTolDeg,
  timezone,
  theme,
  initialRange,
}: SurfTerminalProps) {
  // --- State ---
  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [selectedForecast, setSelectedForecast] =
    useState<EnhancedForecastEntity | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [legendState, setLegendState] = useState({
    waves: true,
    tide: true,
    mlCorrected: true,
  });
  const [chartsReady, setChartsReady] = useState(false);

  // --- Container refs ---
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const windContainerRef = useRef<HTMLDivElement>(null);
  const swellContainerRef = useRef<HTMLDivElement>(null);

  // --- Chart instance refs ---
  const waveChartRef = useRef<IChartApi | null>(null);
  const windChartRef = useRef<IChartApi | null>(null);
  const swellChartRef = useRef<IChartApi | null>(null);

  // --- Series refs ---
  const waveSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const tideSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const mlSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const windAnchorSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const windSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const swellSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // --- Initialization flag ---
  const isInitialized = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // --- Stable ref for forecasts (avoids stale closure in click handler) ---
  const forecastsRef = useRef(forecasts);
  useEffect(() => {
    forecastsRef.current = forecasts;
  }, [forecasts]);

  const isDark = theme === "dark";
  const t = (isDark ? DARK_THEME : LIGHT_THEME) as ChartTheme;

  // --- Embed impression ---
  useEmbedImpression("surf-terminal", slug);

  // --- Derived data ---
  const chartData = useMemo(
    () =>
      transformForecastsToChartData(
        forecasts,
        { windOffshoreDeg, windOffshoreTolDeg, timezone },
        selectedRange
      ),
    [forecasts, windOffshoreDeg, windOffshoreTolDeg, timezone, selectedRange]
  );

  // --- Chart sync (uses refs + enabled flag to avoid stale-ref issues) ---
  const chartRefArray = useMemo(
    () => [waveChartRef, windChartRef, swellChartRef],
    []
  );
  useChartSync(chartRefArray, chartsReady);

  // --- Click handler (uses forecastsRef to avoid stale closure) ---
  const handleChartClick = useCallback(
    (param: MouseEventParams<Time>) => {
      if (param.time === undefined) return;
      const chartTimeSec =
        typeof param.time === "number"
          ? param.time
          : new Date(param.time as string).getTime() / 1000;
      const realUtcSec = localChartTimestampToUtc(chartTimeSec, timezone);
      const nearest = findNearestForecast(forecastsRef.current, realUtcSec);
      if (nearest) {
        setSelectedForecast(nearest);
        setShowDetail(true);
      }
    },
    [timezone]
  );

  // --- Initialize charts (runs once after mount) ---
  useEffect(() => {
    if (isInitialized.current) return;

    const waveEl = waveContainerRef.current;
    const windEl = windContainerRef.current;
    const swellEl = swellContainerRef.current;
    if (!waveEl || !windEl || !swellEl) return;

    let cancelled = false;

    (async () => {
      const {
        createChart,
        createSeriesMarkers,
        AreaSeries,
        LineSeries,
        HistogramSeries,
      } = await import("lightweight-charts");

      if (cancelled) return;

      const chartOpts = buildChartOptions(t);

      // ---- Wave chart ----
      const waveChart = createChart(waveEl, {
        ...chartOpts,
        height: waveEl.clientHeight,
        width: waveEl.clientWidth,
      });

      const waveSeries = waveChart.addSeries(AreaSeries, {
        lineColor: t.waveColor,
        topColor: t.waveGradientTop,
        bottomColor: t.waveGradientBottom,
        lineWidth: 2,
        priceFormat: { type: "price", precision: 1, minMove: 0.1 },
      });

      const tideSeries = waveChart.addSeries(LineSeries, {
        color: t.tideColor,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceFormat: { type: "price", precision: 1, minMove: 0.1 },
      });

      const mlSeries = waveChart.addSeries(LineSeries, {
        color: t.mlColor,
        lineWidth: 1,
        lineStyle: 3, // Dotted
        priceFormat: { type: "price", precision: 1, minMove: 0.1 },
      });

      waveChart.subscribeClick(handleChartClick);

      // ---- Wind chart ----
      const windChart = createChart(windEl, {
        ...chartOpts,
        height: windEl.clientHeight,
        width: windEl.clientWidth,
      });

      // Invisible anchor series with dense time points (same as wave chart)
      // so the crosshair snaps to fine-grained positions instead of sparse
      // hourly bars. Must be added first so it's getSeries()[0].
      const windAnchorSeries = windChart.addSeries(LineSeries, {
        color: "rgba(0,0,0,0)",
        lineWidth: 1,
        lineVisible: false,
        pointMarkersVisible: false,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        priceScaleId: "_anchor",
        autoscaleInfoProvider: () => null,
      });
      // Hide the anchor's own price scale
      windChart.priceScale("_anchor").applyOptions({ visible: false });

      const windSeries = windChart.addSeries(HistogramSeries, {
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      });

      windChart.subscribeClick(handleChartClick);

      // ---- Swell chart ----
      const swellChart = createChart(swellEl, {
        ...chartOpts,
        height: swellEl.clientHeight,
        width: swellEl.clientWidth,
        timeScale: {
          ...chartOpts.timeScale,
          visible: true,
        },
      });

      const swellSeries = swellChart.addSeries(LineSeries, {
        color: t.swellColor,
        lineWidth: 2,
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      });

      swellChart.subscribeClick(handleChartClick);

      // Hide time scale on upper panes (only show on bottom)
      waveChart.timeScale().applyOptions({ visible: false });
      windChart.timeScale().applyOptions({ visible: false });

      // Store refs
      waveChartRef.current = waveChart;
      windChartRef.current = windChart;
      swellChartRef.current = swellChart;
      waveSeriesRef.current = waveSeries;
      tideSeriesRef.current = tideSeries;
      mlSeriesRef.current = mlSeries;
      windAnchorSeriesRef.current = windAnchorSeries;
      windSeriesRef.current = windSeries;
      swellSeriesRef.current = swellSeries;

      // ---- Now marker on wave chart (v5 plugin API) ----
      const nowSec = utcToLocalChartTimestamp(
        Math.floor(Date.now() / 1000),
        timezone
      ) as UTCTimestamp;
      createSeriesMarkers(waveSeries, [
        {
          time: nowSec,
          position: "aboveBar",
          color: t.nowLineColor,
          shape: "arrowDown",
          text: "Now",
        },
      ]);

      isInitialized.current = true;

      // Set initial data
      setDataOnSeries(
        chartData,
        waveSeries,
        tideSeries,
        mlSeries,
        windAnchorSeries,
        windSeries,
        swellSeries
      );

      waveChart.timeScale().fitContent();
      windChart.timeScale().fitContent();
      swellChart.timeScale().fitContent();

      // ---- ResizeObserver with rAF debounce ----
      let rafId = 0;
      const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (waveChartRef.current && waveEl) {
            waveChartRef.current.resize(waveEl.clientWidth, waveEl.clientHeight);
          }
          if (windChartRef.current && windEl) {
            windChartRef.current.resize(windEl.clientWidth, windEl.clientHeight);
          }
          if (swellChartRef.current && swellEl) {
            swellChartRef.current.resize(
              swellEl.clientWidth,
              swellEl.clientHeight
            );
          }
        });
      });

      resizeObserver.observe(waveEl);
      resizeObserver.observe(windEl);
      resizeObserver.observe(swellEl);
      resizeObserverRef.current = resizeObserver;

      // Signal that charts are ready so useChartSync can subscribe
      setChartsReady(true);
    })();

    return () => {
      cancelled = true;
      isInitialized.current = false;

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      waveChartRef.current?.remove();
      windChartRef.current?.remove();
      swellChartRef.current?.remove();

      waveChartRef.current = null;
      windChartRef.current = null;
      swellChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Update data when range/legend changes ---
  useEffect(() => {
    if (!isInitialized.current) return;

    setDataOnSeries(
      chartData,
      waveSeriesRef.current,
      tideSeriesRef.current,
      mlSeriesRef.current,
      windAnchorSeriesRef.current,
      windSeriesRef.current,
      swellSeriesRef.current
    );

    // Toggle series visibility based on legend state
    waveSeriesRef.current?.applyOptions({ visible: legendState.waves });
    tideSeriesRef.current?.applyOptions({ visible: legendState.tide });
    mlSeriesRef.current?.applyOptions({ visible: legendState.mlCorrected });

    // Fit content after data update
    waveChartRef.current?.timeScale().fitContent();
    windChartRef.current?.timeScale().fitContent();
    swellChartRef.current?.timeScale().fitContent();
  }, [chartData, legendState]);

  // --- Legend toggle helper ---
  const toggleLegend = useCallback(
    (key: keyof typeof legendState) => {
      setLegendState((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  // --- Render ---
  return (
    <div
      className={`relative flex flex-col font-mono ${
        isDark ? "bg-[#1a1a2e]" : "bg-white"
      }`}
      style={{ height: "100vh", minHeight: MIN_CHART_HEIGHT }}
    >
      {/* Header bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${
          isDark ? "border-white/10" : "border-black/10"
        }`}
      >
        <span
          className={`text-sm font-semibold truncate max-w-[140px] ${
            isDark ? "text-slate-200" : "text-slate-800"
          }`}
        >
          {beachName}
        </span>

        {/* Time range pills */}
        <div className="flex gap-1">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.label}
              onClick={() => setSelectedRange(tr.hours)}
              aria-label={`Show ${tr.label} of data`}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                selectedRange === tr.hours
                  ? "bg-[#4A70D9] text-black font-semibold"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    : "text-slate-500 hover:text-slate-800 hover:bg-black/5"
              }` + " focus-ring"}
            >
              {tr.label}
            </button>
          ))}
        </div>

        {/* Legend toggles */}
        <div className="flex gap-2 text-xs">
          <LegendToggle
            label="Waves"
            color={t.waveColor}
            active={legendState.waves}
            onClick={() => toggleLegend("waves")}
            isDark={isDark}
          />
          <LegendToggle
            label="Tide"
            color={t.tideColor}
            active={legendState.tide}
            onClick={() => toggleLegend("tide")}
            isDark={isDark}
          />
          {chartData.mlCorrectedHeight.length > 0 && (
            <LegendToggle
              label="ML"
              color={t.mlColor}
              active={legendState.mlCorrected}
              onClick={() => toggleLegend("mlCorrected")}
              isDark={isDark}
            />
          )}
        </div>
      </div>

      {/* Chart panes */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Wave pane */}
        <div
          ref={waveContainerRef}
          style={{ flex: PANE_RATIOS.wave }}
          className="relative"
        >
          <PaneLabel isDark={isDark}>
            WAVE HEIGHT (ft) &middot; TIDE (ft)
          </PaneLabel>
        </div>

        {/* Wind pane */}
        <div
          ref={windContainerRef}
          style={{ flex: PANE_RATIOS.wind }}
          className="relative"
        >
          <PaneLabel isDark={isDark}>WIND (mph)</PaneLabel>
        </div>

        {/* Swell pane */}
        <div
          ref={swellContainerRef}
          style={{ flex: PANE_RATIOS.swell }}
          className="relative"
        >
          <PaneLabel isDark={isDark}>PERIOD (s)</PaneLabel>
        </div>
      </div>

      {/* Watermark */}
      <a
        href={beachUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-3 text-xs opacity-30 hover:opacity-60 transition-opacity font-mono"
        style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
      >
        Powered by Quiver
      </a>

      {/* Detail card (slide-out) */}
      {showDetail && (
        <DetailCard
          forecast={selectedForecast}
          theme={theme}
          onClose={() => setShowDetail(false)}
          timezone={timezone}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PaneLabel({
  isDark,
  children,
}: {
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute top-1 left-2 z-10 text-[10px] font-mono tracking-wider pointer-events-none ${
        isDark ? "text-slate-500" : "text-slate-400"
      }`}
    >
      {children}
    </div>
  );
}

function LegendToggle({
  label,
  color,
  active,
  onClick,
  isDark,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Toggle ${label} series`}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-opacity ${
        active ? "opacity-100" : "opacity-40"
      } ${isDark ? "hover:bg-white/5" : "hover:bg-black/5"}` + " focus-ring"}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className={isDark ? "text-slate-300" : "text-slate-600"}>
        {label}
      </span>
    </button>
  );
}
