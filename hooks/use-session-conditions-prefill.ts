"use client";

import { useEffect, useRef } from "react";
import { useSessionForecast } from "./use-session-forecast";
import { useSessionTideSnapshot } from "./use-session-tide-snapshot";
import type { SessionFormState, SessionFormMode } from "./use-session-form";

type FieldKey =
  | "waveHeight"
  | "windSpeed"
  | "windDirection"
  | "waterTemp";

const FIELD_KEYS: FieldKey[] = [
  "waveHeight",
  "windSpeed",
  "windDirection",
  "waterTemp",
];

function isFieldEmpty(formState: SessionFormState, field: FieldKey): boolean {
  switch (field) {
    case "waveHeight":
      return formState.waveHeight === undefined || formState.waveHeight === null;
    case "windSpeed":
      return formState.windSpeed === undefined || formState.windSpeed === null;
    case "windDirection":
      return !formState.windDirection;
    case "waterTemp":
      return !formState.waterTemp;
  }
}

/**
 * Auto-prefill session conditions from the forecast for the chosen beach/time.
 *
 * Runs at the form level so prefill happens regardless of whether the user has
 * opened the conditions UI (QuickLog hides it behind a collapsed accordion).
 * Tide fields are preview-only so the database snapshot trigger can preserve
 * NOAA provenance unless the user actually edits tide values.
 *
 * Behavior:
 *   - Log mode only.
 *   - Prefills each tracked field at most once per (beach, date, time) combo,
 *     and only if the field is empty when the forecast arrives.
 *   - A field already set when the hook first sees this combo (e.g. the user
 *     typed something or the field was carried over) is never overwritten.
 *   - Changing beach/date/time re-arms prefill for any fields that are empty
 *     at that moment.
 */
export function useSessionConditionsPrefill(
  mode: SessionFormMode,
  formState: SessionFormState,
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void
): void {
  // Per-key set of fields we've already attempted to prefill. Once a field is
  // listed here for the active key, we never touch it again — even if the user
  // clears it back to empty.
  const attemptedRef = useRef<Map<string, Set<FieldKey>>>(new Map());
  const lastKeyRef = useRef<string>("");

  const { forecastData, loading } = useSessionForecast(
    formState.selectedBeachId ?? null,
    formState.selectedDate ?? null,
    formState.selectedTime ?? null
  );
  const { tideSnapshot } = useSessionTideSnapshot(
    formState.selectedBeachId ?? null,
    formState.selectedDate ?? null,
    formState.selectedTime ?? null
  );

  useEffect(() => {
    if (mode !== "log") return;
    if (!forecastData || loading) return;

    const currentKey = `${formState.selectedBeachId}-${formState.selectedDate}-${formState.selectedTime}`;
    if (currentKey !== lastKeyRef.current) {
      lastKeyRef.current = currentKey;
      if (!attemptedRef.current.has(currentKey)) {
        attemptedRef.current.set(currentKey, new Set());
      }
    }
    const attempted = attemptedRef.current.get(currentKey)!;

    const tryPrefill = <K extends keyof SessionFormState>(
      field: FieldKey,
      sessionField: K,
      value: SessionFormState[K] | undefined
    ) => {
      if (attempted.has(field)) return;
      if (value === undefined || value === null || value === "") return;
      if (!isFieldEmpty(formState, field)) {
        // User (or caller) already set this field before we ran. Mark as
        // attempted so we never come back and overwrite it.
        attempted.add(field);
        return;
      }
      updateField(sessionField, value);
      attempted.add(field);
    };

    tryPrefill("waveHeight", "waveHeight", forecastData.wave_height);
    if (
      formState.recommendationId &&
      formState.forecastWaveHeightFt === undefined &&
      forecastData.wave_height !== undefined &&
      forecastData.wave_height !== null
    ) {
      updateField("forecastWaveHeightFt", forecastData.wave_height);
    }
    tryPrefill("windSpeed", "windSpeed", forecastData.wind_speed);
    tryPrefill("windDirection", "windDirection", forecastData.wind_direction);
    tryPrefill(
      "waterTemp",
      "waterTemp",
      forecastData.water_temp !== undefined
        ? String(forecastData.water_temp)
        : undefined
    );

    if (formState.recommendationId) {
      const tideStatus =
        tideSnapshot?.tideStatus?.toLowerCase() ??
        forecastData.tide_status?.toLowerCase();
      if (!formState.forecastTideStatus && tideStatus) {
        updateField("forecastTideStatus", tideStatus);
      }
      if (!formState.tideStatus && tideStatus) {
        updateField("tideStatus", tideStatus);
      }
    }
  }, [
    forecastData,
    tideSnapshot,
    loading,
    mode,
    formState.selectedBeachId,
    formState.selectedDate,
    formState.selectedTime,
    formState,
    updateField,
  ]);

  // Reference FIELD_KEYS to keep the export shape stable for tests that may
  // import it later if needed. No runtime effect.
  void FIELD_KEYS;
}
