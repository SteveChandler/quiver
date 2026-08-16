"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Database,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TideVerifiedBadge } from "./tide-verified-badge";
import type { TideDiagnosticsPanelProps } from "@/types/tide-diagnostics";

/**
 * Format date for display
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format time only
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Info row component
 */
function InfoRow({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2 py-1.5", className)}>
      {Icon && <Icon className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}

/**
 * TideDiagnosticsPanel - Detailed tide data diagnostics for debugging
 *
 * Collapsible panel showing:
 * - Station name + ID
 * - Datum + Units + Timezone
 * - Now height from source
 * - Next high/low with times
 * - Raw sample (last 5 points)
 * - Clickable NOAA source link
 *
 * Triggered by query param ?tide_debug=true or development mode
 */
export function TideDiagnosticsPanel({
  diagnostics,
  isOpen,
  onToggle,
  className,
}: TideDiagnosticsPanelProps) {
  const {
    stationId,
    stationName,
    isPrimaryStation,
    datum,
    units,
    timezone,
    nowHeightFromSource,
    nowHeightInterpolated,
    nextHigh,
    nextLow,
    rawSample,
    totalPredictions,
    sourceUrl,
    stationPageUrl,
    dataFreshness,
    lastFetchTime,
    cacheHit,
    cacheTtlRemaining,
    validationErrors,
    verificationStatus,
    confidenceScore,
  } = diagnostics;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white overflow-hidden",
        isOpen ? "border-blue-200" : "border-slate-200",
        className
      )}
      data-testid="tide-diagnostics-panel"
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-3 text-left",
          "hover:bg-slate-50 transition-colors",
          isOpen && "bg-blue-50"
        ) + " focus-ring"}
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            NOAA CO-OPS Tide Data
          </span>
          <TideVerifiedBadge
            status={verificationStatus}
            tooltip=""
            confidenceScore={confidenceScore}
            showConfidence
          />
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-slate-200 p-4 space-y-4">
          {/* Station Info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoRow
              icon={MapPin}
              label="Station"
              value={
                <span>
                  {stationName}{" "}
                  <span className="text-slate-500">({stationId})</span>
                  {!isPrimaryStation && (
                    <span className="ml-1.5 text-xs text-amber-600">
                      (Fallback)
                    </span>
                  )}
                </span>
              }
            />
            <InfoRow
              icon={Gauge}
              label="Configuration"
              value={
                <span>
                  Datum: {datum} · Units: {units}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoRow
              icon={Clock}
              label="Timezone"
              value={timezone}
            />
            <InfoRow
              label="Data Freshness"
              value={
                <span
                  className={cn(
                    dataFreshness === "fresh" && "text-emerald-600",
                    dataFreshness === "cached" && "text-blue-600",
                    dataFreshness === "stale" && "text-amber-600"
                  )}
                >
                  {dataFreshness.charAt(0).toUpperCase() + dataFreshness.slice(1)}
                  {cacheHit && " (from cache)"}
                  {cacheTtlRemaining !== null && cacheTtlRemaining > 0 && (
                    <span className="text-slate-500">
                      {" "}
                      · {Math.floor(cacheTtlRemaining / 60)}m TTL
                    </span>
                  )}
                </span>
              }
            />
          </div>

          {/* Current Heights */}
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500 mb-2">
              Current Tide Height
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">From source (water level)</div>
                <div className="text-lg font-semibold text-slate-800">
                  {nowHeightFromSource !== null
                    ? `${nowHeightFromSource.toFixed(2)} ${units}`
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Interpolated</div>
                <div className="text-lg font-semibold text-slate-800">
                  {nowHeightInterpolated !== null
                    ? `${nowHeightInterpolated.toFixed(2)} ${units}`
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Next High/Low */}
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500 mb-2">
              Next Extremes
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">Next High</div>
                <div className="text-sm font-medium">
                  {nextHigh
                    ? `${formatTime(nextHigh.time)} · ${nextHigh.height.toFixed(1)} ${units}`
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Next Low</div>
                <div className="text-sm font-medium">
                  {nextLow
                    ? `${formatTime(nextLow.time)} · ${nextLow.height.toFixed(1)} ${units}`
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Raw Sample */}
          {rawSample.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                <Code className="h-3.5 w-3.5" />
                Raw Data Sample ({totalPredictions} total predictions)
              </div>
              <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left pr-4">Time (UTC)</th>
                      <th className="text-right pr-4">Height</th>
                      <th className="text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawSample.map((point, i) => (
                      <tr key={i}>
                        <td className="pr-4">{point.t}</td>
                        <td className="text-right pr-4">{point.v}</td>
                        <td className="text-center">
                          <span
                            className={cn(
                              point.type === "H"
                                ? "text-blue-400"
                                : "text-slate-400"
                            )}
                          >
                            {point.type === "H" ? "HIGH" : "LOW"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Validation Errors
              </div>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Passed */}
          {validationErrors.length === 0 && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              All validation checks passed
            </div>
          )}

          {/* Source Links */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <div className="text-xs font-medium text-slate-500">Source URLs</div>
            <div className="flex flex-wrap gap-2">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                NOAA API
              </a>
              <a
                href={stationPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Station Page
              </a>
            </div>
            <div className="text-xs text-slate-400">
              Last fetched: {formatDateTime(lastFetchTime)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal header-only version that shows key info without expanding
 */
export function TideDiagnosticsHeader({
  diagnostics,
  className,
}: {
  diagnostics: TideDiagnosticsPanelProps["diagnostics"];
  className?: string;
}) {
  const { stationName, stationId, verificationStatus, confidenceScore } =
    diagnostics;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-slate-400" />
        <span className="font-medium text-slate-700">{stationName}</span>
        <span className="text-slate-400">({stationId})</span>
      </div>
      <TideVerifiedBadge
        status={verificationStatus}
        tooltip={`Confidence: ${confidenceScore}%`}
        confidenceScore={confidenceScore}
      />
    </div>
  );
}
