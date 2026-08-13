"use client";

import { memo } from "react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { formatTimeInBeachTimezone } from "@/lib/utils/date-time";

interface DetailCardProps {
  forecast: EnhancedForecastEntity | null;
  theme: "dark" | "light";
  onClose: () => void;
  timezone: string;
}

export const DetailCard = memo(function DetailCard({
  forecast,
  theme,
  onClose,
  timezone,
}: DetailCardProps) {
  if (!forecast) return null;

  const isDark = theme === "dark";

  const forecastTime = new Date(forecast.forecast_at).toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const display = (
    value: string | number | null | undefined,
    fallback = "\u2014"
  ) => (value != null && value !== "" ? String(value) : fallback);

  return (
    <div
      data-testid="detail-card"
      className={`absolute right-0 top-0 bottom-0 w-72 z-50 overflow-y-auto transition-transform duration-300 ${
        isDark
          ? "bg-[#1a1a2e]/95 text-slate-200 border-l border-white/10"
          : "bg-white/95 text-slate-800 border-l border-black/10"
      }`}
      style={{ backdropFilter: "blur(12px)" }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-3 border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
        <span className="text-xs font-mono opacity-70">{forecastTime}</span>
        <button
          onClick={onClose}
          data-testid="detail-card-close"
          className={`p-1 rounded hover:bg-white/10 transition-colors ${
            isDark ? "text-slate-400" : "text-slate-500"
          }` + " focus-ring"}
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      {/* Sections */}
      <div className="p-3 space-y-4 text-sm font-mono">
        {/* Waves */}
        <Section title="Waves" isDark={isDark}>
          <Row label="Height" value={display(forecast.wave_height)} />
          <Row label="Period" value={display(forecast.wave_period)} />
          <Row label="Direction" value={display(forecast.wave_direction)} />
        </Section>

        {/* Swell */}
        <Section title="Swell" isDark={isDark}>
          <Row
            label="Primary"
            value={`${display(forecast.swell_1_height)} @ ${display(forecast.swell_1_period)}`}
          />
          <Row label="Direction" value={display(forecast.swell_1_direction)} />
          {forecast.swell_2_height && (
            <>
              <Row
                label="Secondary"
                value={`${display(forecast.swell_2_height)} @ ${display(forecast.swell_2_period)}`}
              />
              <Row
                label="Direction"
                value={display(forecast.swell_2_direction)}
              />
            </>
          )}
        </Section>

        {/* Wind */}
        <Section title="Wind" isDark={isDark}>
          <Row label="Speed" value={display(forecast.wind_speed)} />
          <Row label="Direction" value={display(forecast.wind_direction)} />
        </Section>

        {/* Tide */}
        <Section title="Tide" isDark={isDark}>
          <Row label="Status" value={display(forecast.tide_status)} />
          <Row label="Height" value={display(forecast.tide_height)} />
          {forecast.next_tide_type && (
            <Row
              label={`Next ${forecast.next_tide_type}`}
              value={forecast.next_tide_at ? formatTimeInBeachTimezone(forecast.next_tide_at, timezone) : display(forecast.next_tide_time)}
            />
          )}
        </Section>

        {/* Conditions */}
        <Section title="Conditions" isDark={isDark}>
          <Row label="Air Temp" value={display(forecast.air_temperature)} />
          <Row label="Water Temp" value={display(forecast.water_temp)} />
          <Row label="Weather" value={display(forecast.weather_condition)} />
          {forecast.confidence_score != null && (
            <Row
              label="Confidence"
              value={`${forecast.confidence_score}%`}
            />
          )}
          <Row label="Source" value={display(forecast.data_source)} />
        </Section>
      </div>
    </div>
  );
});

function Section({
  title,
  isDark,
  children,
}: {
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3
        className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="opacity-60 text-xs">{label}</span>
      <span
        className={`text-xs ${accent ? "text-[#4A70D9] font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
