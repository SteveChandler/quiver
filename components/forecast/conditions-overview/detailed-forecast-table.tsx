"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import {
  extractForecastDate,
  extractForecastTime,
} from "@/lib/utils/forecast-at-adapter";
import {
  getLocalDateString,
  resolveBeachTimezone,
} from "@/lib/utils/timezone-utils";
import { cn } from "@/lib/utils";

interface DetailedForecastTableProps {
  forecasts: EnhancedForecastEntity[];
  beachTimezone?: string | null;
}

type ForecastDayGroup = {
  date: string;
  label: string;
  rows: EnhancedForecastEntity[];
  isToday: boolean;
};

function formatTime(forecast: EnhancedForecastEntity, timezone: string): string {
  if (forecast.forecast_at) {
    const time = extractForecastTime(forecast.forecast_at, timezone);
    const [hoursRaw, minutesRaw = "00"] = time.split(":");
    const hours = Number(hoursRaw);
    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutesRaw} ${suffix}`;
  }

  const [hoursRaw, minutesRaw = "00"] = forecast.forecast_time.split(":");
  const hours = Number(hoursRaw);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutesRaw} ${suffix}`;
}

function formatDayLabel(date: string, today: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const label = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return date === today ? `Today, ${label}` : label;
}

function formatSignal(...parts: Array<string | null | undefined>): string {
  const present = parts.filter(Boolean);
  return present.length > 0 ? present.join(" ") : "-";
}

function formatSource(source: string | null | undefined): string {
  if (!source) return "Unknown";
  return source.replace(/_/g, " ");
}

function groupForecasts(
  forecasts: EnhancedForecastEntity[],
  timezone: string,
): ForecastDayGroup[] {
  const today = getLocalDateString(new Date(), timezone);
  const grouped = new Map<string, EnhancedForecastEntity[]>();

  for (const forecast of forecasts) {
    const date = forecast.forecast_at
      ? extractForecastDate(forecast.forecast_at, timezone)
      : forecast.forecast_date;
    if (date < today) continue;
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(forecast);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({
      date,
      label: formatDayLabel(date, today),
      rows: [...rows].sort((a, b) =>
        (a.forecast_at || a.forecast_time).localeCompare(
          b.forecast_at || b.forecast_time,
        ),
      ),
      isToday: date === today,
    }));
}

function DataCell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-3 align-top", className)}>
      <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#5F5646]">
        {label}
      </span>
      <span className="mt-1 block text-sm font-semibold text-[#11100D]">
        {children}
      </span>
    </td>
  );
}

function MobileRow({
  forecast,
  timezone,
}: {
  forecast: EnhancedForecastEntity;
  timezone: string;
}) {
  return (
    <div className="rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-3 shadow-[2px_2px_0_#11100D]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#5F5646]">
            {formatTime(forecast, timezone)}
          </p>
          <div className="mt-1 text-xl font-black text-[#11100D]">
            <WaveHeightDisplay
              height={forecast.wave_height}
              showTooltip
              dataSource={forecast.data_source}
              confidenceScore={forecast.confidence_score}
              isMlCalibrated={forecast.is_ml_calibrated}
              isCalibrated={forecast.isCalibrated}
            />
          </div>
        </div>
        <span className="rounded-full border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#11100D]">
          {forecast.confidence_score ?? "-"}%
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Signal label="Primary" value={formatSignal(forecast.swell_1_height, forecast.swell_1_period, forecast.swell_1_direction)} />
        <Signal label="Secondary" value={formatSignal(forecast.swell_2_height, forecast.swell_2_period, forecast.swell_2_direction)} />
        <Signal label="Wind Wave" value={formatSignal(forecast.wind_wave_height, forecast.wind_wave_period, forecast.wind_wave_direction)} />
        <Signal label="Wind" value={formatSignal(forecast.wind_speed, forecast.wind_direction)} />
        <Signal label="Tide" value={formatSignal(forecast.tide_height, forecast.tide_status)} />
        <Signal label="Water" value={forecast.water_temp ?? "-"} />
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#5F5646]">
        {label}
      </p>
      <p className="mt-0.5 font-semibold text-[#11100D]">{value}</p>
    </div>
  );
}

export function DetailedForecastTable({
  forecasts,
  beachTimezone,
}: DetailedForecastTableProps) {
  const timezone = resolveBeachTimezone(beachTimezone);
  const groups = useMemo(
    () => groupForecasts(forecasts, timezone),
    [forecasts, timezone],
  );
  const groupDateKey = useMemo(
    () => groups.map((group) => group.date).join("|"),
    [groups],
  );
  const initializedGroupDateKeyRef = useRef<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initializedGroupDateKeyRef.current === groupDateKey) return;

    initializedGroupDateKeyRef.current = groupDateKey;
    const defaultGroup = groups.find((group) => group.isToday) ?? groups[0];
    setExpandedDates(defaultGroup ? new Set([defaultGroup.date]) : new Set());
  }, [groupDateKey, groups]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="detailed-forecast-table"
      className="space-y-3"
      aria-label="Detailed forecast data"
    >
      <div>
        <h3 className="font-heading text-2xl font-black uppercase text-[#11100D]">
          Full Forecast
        </h3>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#5F5646]">
          Tide, wind, swell, weather, confidence
        </p>
      </div>

      {groups.map((group) => {
        const isExpanded = expandedDates.has(group.date);
        const Icon = isExpanded ? ChevronDown : ChevronRight;
        return (
          <div
            key={group.date}
            className="overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] shadow-[3px_3px_0_#11100D]"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between gap-3 border-b-2 border-[#11100D] bg-[#F4EBD8] px-4 py-3 text-left focus-ring"
              onClick={() => {
                setExpandedDates((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.date)) next.delete(group.date);
                  else next.add(group.date);
                  return next;
                });
              }}
            >
              <span className="flex items-center gap-2 font-heading text-lg font-black uppercase text-[#11100D]">
                <Icon className="h-4 w-4" />
                {group.label}
              </span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#0B3A75]">
                {group.rows.length} slots
              </span>
            </button>

            {isExpanded && (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1180px] border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#11100D] bg-[#0B3A75] text-left">
                        {[
                          "Time",
                          "Surf",
                          "Primary",
                          "Secondary",
                          "Wind Wave",
                          "Wind",
                          "Tide",
                          "Weather",
                          "Water",
                          "Confidence",
                        ].map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#F4EBD8]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((forecast, index) => (
                        <tr
                          key={forecast.id}
                          className={cn(
                            "border-b border-[#11100D]/20",
                            index % 2 === 0 ? "bg-[#F8F0DF]" : "bg-[#EFE5CF]",
                          )}
                        >
                          <DataCell label="Local">{formatTime(forecast, timezone)}</DataCell>
                          <DataCell label="Height">
                            <WaveHeightDisplay
                              height={forecast.wave_height}
                              showTooltip
                              dataSource={forecast.data_source}
                              confidenceScore={forecast.confidence_score}
                              isMlCalibrated={forecast.is_ml_calibrated}
                              isCalibrated={forecast.isCalibrated}
                            />
                          </DataCell>
                          <DataCell label="Swell">
                            {formatSignal(forecast.swell_1_height, forecast.swell_1_period, forecast.swell_1_direction)}
                          </DataCell>
                          <DataCell label="Swell">
                            {formatSignal(forecast.swell_2_height, forecast.swell_2_period, forecast.swell_2_direction)}
                          </DataCell>
                          <DataCell label="Wind sea">
                            {formatSignal(forecast.wind_wave_height, forecast.wind_wave_period, forecast.wind_wave_direction)}
                          </DataCell>
                          <DataCell label="Wind">
                            {formatSignal(forecast.wind_speed, forecast.wind_direction)}
                          </DataCell>
                          <DataCell label="Tide">
                            {formatSignal(forecast.tide_height, forecast.tide_status)}
                          </DataCell>
                          <DataCell label="Air">
                            {formatSignal(forecast.weather_condition, forecast.air_temperature)}
                          </DataCell>
                          <DataCell label="Water">{forecast.water_temp ?? "-"}</DataCell>
                          <DataCell label={formatSource(forecast.data_source)}>
                            {forecast.confidence_score ?? "-"}%
                          </DataCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-3 md:hidden">
                  {group.rows.map((forecast) => (
                    <MobileRow
                      key={forecast.id}
                      forecast={forecast}
                      timezone={timezone}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
