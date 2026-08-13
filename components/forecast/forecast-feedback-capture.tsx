"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Loader2, Send, TrendingDown, TrendingUp } from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { BeachForecastMetadata } from "@/hooks/use-beach-detail-data";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { ForecastFeedbackClientPayload } from "@/lib/services/forecast/forecast-feedback";
import { buildSessionWizardUrl } from "@/lib/utils/session-wizard-params";

type FeedbackValue = "too_low" | "about_right" | "too_high";

interface ForecastFeedbackCaptureProps {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  forecastMetadata?: BeachForecastMetadata | null;
  surfCall?: SurfCallResult | null;
  beachTimezone?: string | null;
  isCalibrated: boolean;
  isDisplayStaleForecast: boolean;
  forecastTimeLabel?: string | null;
  freshnessLabel?: string | null;
}

const FEEDBACK_OPTIONS: Array<{
  value: FeedbackValue;
  label: string;
  Icon: typeof TrendingDown;
}> = [
  { value: "too_low", label: "Too low", Icon: TrendingDown },
  { value: "about_right", label: "Right", Icon: Check },
  { value: "too_high", label: "Too high", Icon: TrendingUp },
];

const OBSERVED_HEIGHT_ERROR =
  "Enter a height from 0.5 to 50 ft in 0.5 ft increments.";

function compactNote(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function forecastHorizonHours(
  forecastAt: string,
  issuedAt: string | null | undefined,
): number | null {
  const forecastMs = parseDateMs(forecastAt);
  const issuedMs = parseDateMs(issuedAt);
  if (forecastMs == null || issuedMs == null) return null;
  const hours = Math.round((forecastMs - issuedMs) / (1000 * 60 * 60));
  return hours >= 0 && hours <= 168 ? hours : null;
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ),
  );
}

function parseObservedFaceHeight(value: string): {
  value: number | null;
  error: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };

  const parsed = Number(trimmed);
  const isValid =
    Number.isFinite(parsed) &&
    parsed >= 0.5 &&
    parsed <= 50 &&
    Number.isInteger(parsed * 2);

  return isValid
    ? { value: parsed, error: null }
    : { value: null, error: OBSERVED_HEIGHT_ERROR };
}

function fingerprintDraftPayload(
  payload: ForecastFeedbackClientPayload,
): string {
  return JSON.stringify({ ...payload, requestId: null });
}

function buildPayload(args: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  forecastMetadata?: BeachForecastMetadata | null;
  surfCall?: SurfCallResult | null;
  beachTimezone?: string | null;
  isCalibrated: boolean;
  isDisplayStaleForecast: boolean;
  forecastTimeLabel?: string | null;
  freshnessLabel?: string | null;
  routePathname?: string | null;
  feedbackValue: FeedbackValue;
  feedbackNote: string | null;
  observedFaceHeightFt: number | null;
  requestId: string;
}): ForecastFeedbackClientPayload {
  const { beach, forecast, surfCall, forecastMetadata } = args;
  const sourceContext = {
    data_source: forecast.data_source ?? null,
    model_version: forecast.ml_model_version ?? null,
    is_ml_calibrated: forecast.is_ml_calibrated ?? null,
    open_meteo_fetched_at: forecast.om_fetched_at ?? null,
    metadata_source: forecastMetadata?.dataSource ?? null,
    metadata_cached: forecastMetadata?.cached ?? null,
    metadata_stale: forecastMetadata?.stale ?? null,
  };
  const calibrationContext = {
    beach_is_calibrated: args.isCalibrated,
    displayed_height_kind: args.isCalibrated ? "face_height" : "forecast_height",
    ml_corrected_height_ft: forecast.ml_corrected_height ?? null,
    confidence_score: forecast.confidence_score ?? null,
  };
  const surfCallContext = surfCall
    ? {
        verdict: surfCall.verdict,
        score: surfCall.score,
        forecast_confidence: surfCall.forecastConfidence,
        why_sentence: surfCall.whySentence,
        best_window_start: surfCall.bestWindowStart,
        best_window_end: surfCall.bestWindowEnd,
        peak_time: surfCall.peakTime,
        wave_height: surfCall.waveHeight,
        wind_speed: surfCall.windSpeed,
        tide_phase: surfCall.tidePhase,
        rideable_waves_per_hour: surfCall.rideableWavesPerHour,
      }
    : {};

  return {
    beachId: beach.id,
    forecastAt: forecast.forecast_at,
    windowStart: surfCall?.bestWindowStart ?? forecast.forecast_at,
    windowEnd: surfCall?.bestWindowEnd ?? null,
    issuedAt: forecast.created_at ?? null,
    predictedAt: forecast.updated_at ?? null,
    forecastHorizonHours: forecastHorizonHours(
      forecast.forecast_at,
      forecast.created_at,
    ),
    feedbackKind: "forecast_accuracy",
    feedbackValue: args.feedbackValue,
    feedbackNote: args.feedbackNote,
    observedFaceHeightFt: args.observedFaceHeightFt,
    displayedContext: {
      wave_height_ft: forecast.ml_corrected_height ?? forecast.wave_height,
      raw_wave_height_ft: forecast.wave_height,
      wave_period_s: forecast.wave_period ?? forecast.swell_1_period ?? null,
      wave_direction: forecast.wave_direction ?? forecast.swell_1_direction ?? null,
      primary_swell_height_ft: forecast.swell_1_height ?? null,
      primary_swell_period_s: forecast.swell_1_period ?? null,
      primary_swell_direction: forecast.swell_1_direction ?? null,
      wind_speed: forecast.wind_speed ?? null,
      wind_direction: forecast.wind_direction ?? null,
      tide_status: forecast.tide_status ?? null,
      tide_height_ft: forecast.tide_height ?? null,
      display_time_label: args.forecastTimeLabel ?? null,
      display_stale: args.isDisplayStaleForecast,
      freshness_label: args.freshnessLabel ?? null,
    },
    sourceModelContext: sourceContext,
    calibrationContext,
    surfCallContext,
    missingFlags: surfCall ? {} : { surf_call_context: true },
    auditMetadata: {
      surface: "forecast_tab",
      route: args.routePathname ?? null,
      beach_name: beach.name,
      beach_slug: beach.slug,
      timezone: args.beachTimezone ?? null,
    },
    clientSource: "quiver-web",
    requestId: args.requestId,
  };
}

export function ForecastFeedbackCapture({
  beach,
  forecast,
  forecastMetadata,
  surfCall,
  beachTimezone,
  isCalibrated,
  isDisplayStaleForecast,
  forecastTimeLabel,
  freshnessLabel,
}: ForecastFeedbackCaptureProps) {
  const pathname = usePathname();
  const { track } = useTrackEvent();
  const [selectedValue, setSelectedValue] = useState<FeedbackValue | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [observedFaceHeight, setObservedFaceHeight] = useState("");
  const [observedHeightError, setObservedHeightError] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionLogUrl, setSessionLogUrl] = useState<string | null>(null);
  const draftRequestIdRef = useRef<string | null>(null);
  const draftFingerprintRef = useRef<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const observedHeightErrorId = useId();

  const isMismatch =
    selectedValue === "too_low" || selectedValue === "too_high";
  const isLocked = isSubmitting || status === "success";

  const selectedLabel = useMemo(
    () =>
      FEEDBACK_OPTIONS.find((option) => option.value === selectedValue)?.label ??
      null,
    [selectedValue],
  );

  const handleSubmit = async () => {
    if (
      !selectedValue ||
      submissionInFlightRef.current ||
      status === "success"
    ) {
      return;
    }

    const observedHeight = isMismatch
      ? parseObservedFaceHeight(observedFaceHeight)
      : { value: null, error: null };
    if (observedHeight.error) {
      setObservedHeightError(observedHeight.error);
      return;
    }

    const draftPayload = buildPayload({
      beach,
      forecast,
      forecastMetadata,
      surfCall,
      beachTimezone,
      isCalibrated,
      isDisplayStaleForecast,
      forecastTimeLabel,
      freshnessLabel,
      routePathname: pathname,
      feedbackValue: selectedValue,
      feedbackNote: compactNote(note),
      observedFaceHeightFt: observedHeight.value,
      requestId: "",
    });
    const draftFingerprint = fingerprintDraftPayload(draftPayload);
    const requestId =
      draftFingerprint === draftFingerprintRef.current &&
      draftRequestIdRef.current
        ? draftRequestIdRef.current
        : crypto.randomUUID();
    draftRequestIdRef.current = requestId;
    draftFingerprintRef.current = draftFingerprint;
    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setStatus("idle");
    setObservedHeightError(null);
    const payload: ForecastFeedbackClientPayload = {
      ...draftPayload,
      requestId,
    };

    try {
      const response = await fetch("/api/forecast-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.success !== true) {
        throw new Error("Feedback submit failed");
      }
      const feedbackId =
        typeof body?.data?.id === "string" && body.data.id.trim()
          ? body.data.id
          : undefined;
      const forecastFeedbackId = isUuid(feedbackId) ? feedbackId : undefined;
      const toValidDate = (
        value: string | null | undefined,
      ): Date | undefined => {
        if (!value) return undefined;
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? undefined : d;
      };
      const windowStart = toValidDate(payload.windowStart ?? payload.forecastAt);
      const windowEnd = toValidDate(payload.windowEnd);
      // "Log the session" records a surf that happened -- never pre-date the
      // form to a future forecast window.
      const carryWindow = windowStart ? windowStart.getTime() <= Date.now() : false;
      setSessionLogUrl(
        buildSessionWizardUrl({
          mode: "log",
          quick: true,
          beachId: beach.id,
          beachName: beach.name,
          startTime: carryWindow ? windowStart : undefined,
          endTime: carryWindow ? windowEnd : undefined,
          targetStep: 1,
          forecastFeedbackId,
          forecastFeedbackValue: selectedValue,
          observedFaceHeightFt: observedHeight.value ?? undefined,
        }),
      );
      setStatus("success");
      track("forecast_interaction", {
        beachId: beach.id,
        metadata: {
          action: "view_details",
          slot: `feedback_${selectedValue}`,
        },
      });
    } catch {
      setStatus("error");
      setSessionLogUrl(null);
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-[8px] border-2 border-[#11100D] bg-[#F8F0DF] p-4 shadow-[3px_3px_0_#11100D]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-heading text-base font-black uppercase text-[#11100D]">
            Did this forecast feel right?
          </h3>
          <p className="mt-1 text-sm font-medium text-[#5F5646]">
            {selectedLabel
              ? `${selectedLabel} selected`
              : `${beach.name} · ${forecastTimeLabel ?? "latest slot"}`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
          {FEEDBACK_OPTIONS.map(({ value, label, Icon }) => {
            const active = value === selectedValue;
            return (
              <button
                key={value}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  setSelectedValue(value);
                  setStatus("idle");
                  setObservedHeightError(null);
                  setSessionLogUrl(null);
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 px-2 py-2 text-xs font-black uppercase transition ${
                  active
                    ? "border-[#11100D] bg-[#11100D] text-[#F4EBD8]"
                    : "border-[#11100D] bg-[#F4EBD8] text-[#11100D] hover:bg-[#EFE5CF]"
                }` + " focus-ring"}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedValue && (
        <div className="mt-3 space-y-2">
          {isMismatch && (
            <div>
              <label className="block text-sm font-bold text-[#11100D]">
                What face height did you see?{" "}
                <span className="font-medium">(optional)</span>
                <span className="mt-1 flex max-w-48 items-center rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] focus-within:ring-2 focus-within:ring-[#0B3A75]">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={observedFaceHeight}
                    onChange={(event) => {
                      setObservedFaceHeight(event.target.value);
                      setObservedHeightError(null);
                    }}
                    disabled={isLocked}
                    aria-invalid={Boolean(observedHeightError)}
                    aria-describedby={
                      observedHeightError ? observedHeightErrorId : undefined
                    }
                    className="min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-medium text-[#11100D] outline-none"
                  />
                  <span className="pr-3 text-sm font-bold text-[#5F5646]">ft</span>
                </span>
              </label>
              {observedHeightError && (
                <p
                  id={observedHeightErrorId}
                  className="mt-1 text-sm font-bold text-[#B42318]"
                  role="alert"
                >
                  {observedHeightError}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              rows={2}
              disabled={isLocked}
              className="min-h-12 flex-1 rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-2 text-sm font-medium text-[#11100D] outline-none focus:ring-2 focus:ring-[#0B3A75] disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Add a detail"
            />
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isLocked}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-4 py-2 font-heading text-sm font-black uppercase text-[#11100D] shadow-[2px_2px_0_#11100D] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#11100D] disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>Send</span>
            </button>
          </div>
        </div>
      )}

      {status === "success" && (
        <div
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-bold text-[#0B7A4B]">
            Feedback saved.
          </p>
          {sessionLogUrl && (
            <Link
              href={sessionLogUrl}
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-4 py-2 font-heading text-xs font-black uppercase text-[#11100D] shadow-[2px_2px_0_#11100D] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#11100D]"
            >
              Log the session
            </Link>
          )}
        </div>
      )}
      {status === "error" && (
        <p
          className="mt-2 text-sm font-bold text-[#B42318]"
          role="status"
          aria-live="polite"
        >
          Feedback could not be saved.
        </p>
      )}
    </section>
  );
}
