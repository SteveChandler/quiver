"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import { Activity, Clock3, Gauge, Waves, Wind } from "lucide-react";

import { trackAppHandoffQrRendered } from "@/lib/analytics/app-handoff-tracking";
import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import { useTrackEvent } from "@/hooks/use-track-event";
import { cn } from "@/lib/utils";

type ReadingModeId = "buoy" | "wind" | "tide";

interface ReadingMetric {
  label: string;
  value: string;
  helper: string;
}

interface ReadingMode {
  id: ReadingModeId;
  label: string;
  shortLabel: string;
  Icon: typeof Waves;
  headline: string;
  body: string;
  call: string;
  mapCue: string;
  metrics: ReadingMetric[];
}

const READING_MODES: ReadingMode[] = [
  {
    id: "buoy",
    label: "Buoy read",
    shortLabel: "Buoy",
    Icon: Waves,
    headline: "Start with the buoy before trusting the spot number.",
    body: "Buoys show the raw swell moving through the water. Period tells you how much push it has; direction tells you whether that energy can reach the beach.",
    call: "Long-period swell with a direction that fits the beach gets upgraded. Short-period local wind swell gets checked against the map before you drive.",
    mapCue: "Tap swell field on the map, then compare the bright bands to nearby beach markers.",
    metrics: [
      {
        label: "Height",
        value: "3 ft",
        helper: "Raw energy, not always face height at the break.",
      },
      {
        label: "Period",
        value: "13 sec",
        helper: "More seconds means more push and more refraction.",
      },
      {
        label: "Direction",
        value: "WSW",
        helper: "Only useful if the beach is exposed to that angle.",
      },
    ],
  },
  {
    id: "wind",
    label: "Wind read",
    shortLabel: "Wind",
    Icon: Wind,
    headline: "Wind decides whether the swell has a clean face.",
    body: "Offshore or light side-shore wind can groom the wave. Onshore wind adds bump, crumble, and drift even when the swell number looks fine.",
    call: "Upgrade light offshore mornings. Downgrade afternoon onshore flow unless the spot has cliffs, kelp, or angle protection.",
    mapCue: "Use the map to compare nearby beaches. A protected cove can stay cleaner than an exposed beach on the same swell.",
    metrics: [
      {
        label: "Direction",
        value: "E",
        helper: "Offshore at many west-facing California beaches.",
      },
      {
        label: "Speed",
        value: "6 kt",
        helper: "Light enough to keep texture controlled.",
      },
      {
        label: "Trend",
        value: "Rising",
        helper: "A good dawn window can close fast.",
      },
    ],
  },
  {
    id: "tide",
    label: "Tide read",
    shortLabel: "Tide",
    Icon: Clock3,
    headline: "Tide turns a forecast into a time window.",
    body: "The same swell can be fun, drained, or swamped depending on water level. The best call is usually a tide window, not an all-day rating.",
    call: "Look for the spot's working range and the direction of change. Incoming tide can help soft sandbars; too much high tide can bury them.",
    mapCue: "Search a spot, then use the field guide to compare tide timing with the closest forecast window.",
    metrics: [
      {
        label: "Now",
        value: "2.4 ft",
        helper: "Current water level sets the baseline.",
      },
      {
        label: "Next",
        value: "Rising",
        helper: "Direction of movement often matters more than exact height.",
      },
      {
        label: "Window",
        value: "Dawn",
        helper: "Pair the tide change with the cleanest wind.",
      },
    ],
  },
];

const QR_VALUE = buildSmartQrHandoffUrl({
  source: "map_literacy_panel",
  surface: "map",
  placement: "field_guide_qr",
  qr_id: "map_literacy_field_guide",
  target: "download",
  utm_medium: "map_field_guide",
});

function getModeById(id: ReadingModeId): ReadingMode {
  return READING_MODES.find((mode) => mode.id === id) ?? READING_MODES[0];
}

export function MapLearningPanel(): ReactElement {
  const [activeModeId, setActiveModeId] = useState<ReadingModeId>("buoy");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeMetricIndex, setActiveMetricIndex] = useState(0);
  const { track } = useTrackEvent();
  const qrTracked = useRef(false);

  const activeMode = useMemo(() => getModeById(activeModeId), [activeModeId]);
  const activeMetric = activeMode.metrics[activeMetricIndex] ?? activeMode.metrics[0];

  useEffect(() => {
    if (qrTracked.current) return;
    qrTracked.current = true;
    trackAppHandoffQrRendered({
      source: "map_literacy_panel",
      surface: "map",
      placement: "field_guide_qr",
      platform: "desktop",
      destination_type: "app_handoff",
      destination_url: QR_VALUE,
      qr_id: "map_literacy_field_guide",
      target: "download",
    });
  }, []);

  function selectMode(modeId: ReadingModeId): void {
    setActiveModeId(modeId);
    setActiveMetricIndex(0);
    void track("map_interaction", {
      metadata: {
        action: "filter_change",
        filter: `forecast_literacy_mode:${modeId}`,
      },
      debounceMs: 0,
    });
  }

  function selectMetric(index: number): void {
    setActiveMetricIndex(index);
    void track("map_interaction", {
      metadata: {
        action: "filter_change",
        filter: `forecast_literacy_metric:${activeMode.id}:${activeMode.metrics[index]?.label ?? "unknown"}`,
      },
      debounceMs: 0,
    });
  }

  function handleModeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    const lastIndex = READING_MODES.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? (index + 1) % READING_MODES.length
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? (index - 1 + READING_MODES.length) % READING_MODES.length
            : null;
    if (nextIndex === null) return;

    event.preventDefault();
    selectMode(READING_MODES[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <aside
      data-testid="map-learning-panel"
      className="zine-tab h-full min-h-0 overflow-y-auto border-t border-[#11100D]/10 bg-[#F4EBD8] text-[#11100D] shadow-[0_-10px_28px_rgba(0,0,0,0.18)] xl:border-l xl:border-t-0"
      aria-label="How to read buoy wind and tide"
    >
      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0B3A75]">
            Read the call
          </p>
          <h2 className="font-heading text-2xl font-black leading-none text-[#11100D] sm:text-3xl">
            Buoy, wind, tide.
          </h2>
          <p className="font-mono text-sm leading-6 text-[#11100D]/78">
            Use this map like a field guide. Switch layers, read the cue, then
            decide whether the marker deserves a YES, MAYBE, or NO.
          </p>
        </div>

        <div
          className="grid grid-cols-3 gap-2"
          role="tablist"
          aria-label="Forecast reading layers"
        >
          {READING_MODES.map(({ id, shortLabel, Icon }, index) => {
            const active = id === activeMode.id;
            return (
              <button
                key={id}
                ref={(node) => { tabRefs.current[index] = node; }}
                type="button"
                role="tab"
                id={`map-learning-tab-${id}`}
                aria-controls={`map-learning-panel-${id}`}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                data-testid={`map-learning-mode-${id}`}
                onClick={() => selectMode(id)}
                onKeyDown={(event) => handleModeKeyDown(event, index)}
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2 border-2 border-[#11100D] px-2 font-mono text-xs font-black uppercase tracking-[0.08em] shadow-[2px_3px_0_rgba(17,16,13,0.18)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]",
                  active
                    ? "bg-[#F78E42] text-[#11100D]"
                    : "bg-[#F5EEDC] text-[#11100D] hover:-translate-y-0.5",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{shortLabel}</span>
              </button>
            );
          })}
        </div>

        <section
          role="tabpanel"
          id={`map-learning-panel-${activeMode.id}`}
          aria-labelledby={`map-learning-tab-${activeMode.id}`}
          className="space-y-4 border-2 border-[#11100D] bg-[#F5EEDC] p-4 shadow-[4px_6px_0_rgba(17,16,13,0.16)]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#11100D] bg-[#11100D] text-[#F5EEDC]">
              <activeMode.Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-xl font-black leading-tight">
                {activeMode.headline}
              </h3>
              <p className="mt-2 font-mono text-sm leading-6 text-[#11100D]/76">
                {activeMode.body}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            {activeMode.metrics.map((metric, index) => {
              const selected = index === activeMetricIndex;
              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => selectMetric(index)}
                  className={cn(
                    "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]",
                    selected
                      ? "border-[#0B3A75] bg-[#0B3A75] text-[#F5EEDC]"
                      : "border-[#11100D]/25 bg-[#F4EBD8] text-[#11100D] hover:border-[#11100D]",
                  )}
                >
                  <span className="font-mono text-xs font-black uppercase tracking-[0.12em]">
                    {metric.label}
                  </span>
                  <span className="font-mono text-lg font-black">
                    {metric.value}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="border border-[#11100D]/20 bg-[#F4EBD8] p-3">
              <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.16em] text-[#0B3A75]">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                Active cue
              </div>
              <p
                data-testid="map-learning-active-helper"
                className="font-mono text-sm leading-6 text-[#11100D]/78"
              >
                {activeMetric.helper}
              </p>
            </div>
            <div className="border border-[#11100D]/20 bg-[#F4EBD8] p-3">
              <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.16em] text-[#0B3A75]">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Make the call
              </div>
              <p className="font-mono text-sm leading-6 text-[#11100D]/78">
                {activeMode.call}
              </p>
            </div>
          </div>

          <div className="border-l-4 border-[#F78E42] bg-[#11100D] p-3 text-[#F5EEDC]">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-[#FDB84B]">
              Map cue
            </p>
            <p className="mt-1 font-mono text-sm leading-6 text-[#F5EEDC]/82">
              {activeMode.mapCue}
            </p>
          </div>
        </section>

        <section className="grid gap-4 border-2 border-[#11100D] bg-[#11100D] p-4 text-[#F5EEDC] shadow-[4px_6px_0_rgba(247,142,66,0.28)] sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center xl:grid-cols-1">
          <div className="mx-auto hidden rounded-md bg-white p-2 sm:block">
            <QRCodeSVG
              aria-label="Scan to open Quiver on your phone"
              data-testid="map-learning-smart-qr"
              data-smart-url={QR_VALUE}
              value={QR_VALUE}
              size={116}
              level="H"
              marginSize={2}
              bgColor="#FFFFFF"
              fgColor="#252D6B"
              imageSettings={{
                src: "/quiver-app-icon-128.png",
                width: 24,
                height: 24,
                excavate: true,
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm leading-6 text-[#F5EEDC]/78">
              Take the map with you. Scan the code to get Quiver on your phone
              and check conditions wherever you surf.
            </p>
            <a
              href={QR_VALUE}
              className="mt-3 inline-flex min-h-11 items-center justify-center bg-[#F78E42] px-4 font-mono text-xs font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(245,238,220,0.2)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDB84B]"
            >
              Get the app
            </a>
          </div>
        </section>
      </div>
    </aside>
  );
}
