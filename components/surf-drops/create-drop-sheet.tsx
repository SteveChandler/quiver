/**
 * CreateDropSheet — side panel with the two-mode ("known spot" vs "custom pin")
 * drop-creation UI. It stays off the map's center so the placed pin remains
 * visible while the user adds timing and audience details.
 *
 * Client-side clamps mirror lib/surf-drops/validation.ts so we don't waste a
 * round-trip on bad input:
 *   - starts_at ≤ now + 4 days
 *   - ends_at   > starts_at
 *   - ends_at - starts_at ≥ 15 min
 *
 * The Known-Spot mode uses `/api/beaches/search` when available; if search
 * returns nothing (or the parent passes a `selectedBeach` from the map), we
 * fall back to a single-row "use this spot" chip.
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreateDropMode = "known_spot" | "custom_pin";

export interface CreateDropSheetBeach {
  id: string;
  name: string;
  lat?: number | null;
  lon?: number | null;
}

export interface CreateDropSheetSuccess {
  id: string;
  share_slug: string;
  location_type: CreateDropMode;
  beach_id: string | null;
  lat: number | null;
  lon: number | null;
  spot_name: string | null;
  general_area: string | null;
  exact_label: string | null;
  starts_at: string;
  ends_at: string;
  audience: "mutuals" | "friends" | "link" | "private";
}

interface CreateDropSheetProps {
  open: boolean;
  onClose: () => void;
  /** Optional pre-selected beach (e.g. the currently-selected map beach). */
  selectedBeach?: CreateDropSheetBeach | null;
  /** Current custom-pin coordinates (parent owns the pin drag on the map). */
  customPin?: { lat: number; lon: number; label?: string | null } | null;
  /** Default mode when the sheet opens. */
  defaultMode?: CreateDropMode;
  onCreated: (result: CreateDropSheetSuccess) => void;
}

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_DURATION_MINUTES = 60;
const DURATION_OPTIONS = [
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
] as const;
const START_PRESETS = [
  { label: "Now", offsetMinutes: 0 },
  { label: "+30m", offsetMinutes: 30 },
  { label: "+1h", offsetMinutes: 60 },
] as const;

function roundUpTo15Min(date: Date): Date {
  const ms = 15 * 60 * 1000;
  const rounded = Math.ceil((date.getTime() + 1000) / ms) * ms;
  return new Date(rounded);
}

function toLocalInputValue(date: Date): string {
  // Format YYYY-MM-DDTHH:mm in local time for <input type="datetime-local">.
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function createDefaultWindow(): { startsAt: Date; endsAt: Date } {
  const startsAt = roundUpTo15Min(new Date(Date.now() + 15 * 60 * 1000));
  const endsAt = addMinutes(startsAt, DEFAULT_DURATION_MINUTES);
  return { startsAt, endsAt };
}

function createDefaultWindowInputs(): {
  startsAtInput: string;
  endsAtInput: string;
} {
  const { startsAt, endsAt } = createDefaultWindow();
  return {
    startsAtInput: toLocalInputValue(startsAt),
    endsAtInput: toLocalInputValue(endsAt),
  };
}

function formatWindowTime(value: string): string {
  const date = fromLocalInputValue(value);
  if (!date) return "Choose a time";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatForecastSummary(args: {
  mode: CreateDropMode;
  pickedBeach: CreateDropSheetBeach | null;
  customPin: { lat: number; lon: number; label?: string | null } | null | undefined;
  startsAtInput: string;
  endsAtInput: string;
}): string {
  const location =
    args.mode === "known_spot"
      ? args.pickedBeach?.name ?? "selected spot"
      : args.customPin?.label ?? "custom pin";
  const startLabel = formatWindowTime(args.startsAtInput);
  const endLabel = formatWindowTime(args.endsAtInput);
  return `Quiver forecast attached for ${location}: ${startLabel} to ${endLabel}.`;
}

interface ClampResult {
  ok: true;
  starts_at: string;
  ends_at: string;
}

interface ClampError {
  ok: false;
  message: string;
}

export function clampDropWindow(
  startsAt: Date,
  endsAt: Date,
  now: Date = new Date(),
): ClampResult | ClampError {
  if (!Number.isFinite(startsAt.getTime())) {
    return { ok: false, message: "Start time is invalid" };
  }
  if (!Number.isFinite(endsAt.getTime())) {
    return { ok: false, message: "End time is invalid" };
  }
  const maxStart = now.getTime() + FOUR_DAYS_MS;
  if (startsAt.getTime() > maxStart) {
    return { ok: false, message: "Start time must be within 4 days" };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, message: "End time must be after start" };
  }
  if (endsAt.getTime() - startsAt.getTime() < MIN_DURATION_MS) {
    return { ok: false, message: "Window must be at least 15 minutes" };
  }
  return {
    ok: true,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  };
}

export function CreateDropSheet({
  open,
  onClose,
  selectedBeach,
  customPin,
  defaultMode = "known_spot",
  onCreated,
}: CreateDropSheetProps) {
  const [mode, setMode] = useState<CreateDropMode>(defaultMode);
  const [beachSearch, setBeachSearch] = useState("");
  const [beachResults, setBeachResults] = useState<CreateDropSheetBeach[]>([]);
  const [pickedBeach, setPickedBeach] = useState<CreateDropSheetBeach | null>(
    selectedBeach ?? null,
  );
  const [generalArea, setGeneralArea] = useState<string>(
    customPin?.label ?? "",
  );
  const [audience, setAudience] = useState<
    "mutuals" | "friends" | "link" | "private"
  >("mutuals");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    DEFAULT_DURATION_MINUTES,
  );
  const [windowInputs, setWindowInputs] = useState(
    () => createDefaultWindowInputs(),
  );
  const { startsAtInput, endsAtInput } = windowInputs;

  const setStartsAtInput = useCallback((value: string) => {
    setWindowInputs((current) => ({ ...current, startsAtInput: value }));
  }, []);

  const setEndsAtInput = useCallback((value: string) => {
    setWindowInputs((current) => ({ ...current, endsAtInput: value }));
  }, []);

  const forecastSummary = useMemo(
    () =>
      formatForecastSummary({
        mode,
        pickedBeach,
        customPin,
        startsAtInput,
        endsAtInput,
      }),
    [mode, pickedBeach, customPin, startsAtInput, endsAtInput],
  );

  // Sync pre-selected beach when the parent updates it while the sheet is open.
  useEffect(() => {
    if (selectedBeach) setPickedBeach(selectedBeach);
  }, [selectedBeach]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode(defaultMode);
    setError(null);
    setDurationMinutes(DEFAULT_DURATION_MINUTES);
    setWindowInputs(createDefaultWindowInputs());
    if (selectedBeach) {
      setPickedBeach(selectedBeach);
      return;
    }
    if (defaultMode === "custom_pin") {
      setPickedBeach(null);
      setBeachSearch("");
      setBeachResults([]);
      setGeneralArea(customPin?.label ?? "Custom pin");
    }
  }, [customPin?.label, defaultMode, open, selectedBeach]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (open && customPin?.label) setGeneralArea(customPin.label);
  }, [customPin?.label, open]);

  // Beach search — hit /api/beaches/search if it exists; ignore errors so the
  // fallback (parent-passed beach) still works.
  useEffect(() => {
    if (mode !== "known_spot" || beachSearch.trim().length < 2) {
      setBeachResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/beaches/search?q=${encodeURIComponent(beachSearch.trim())}`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        if (!res.ok) return;
        const json = await res.json();
        const list =
          (json?.data?.beaches ?? json?.beaches ?? json?.data?.results ?? [])
            .slice(0, 8)
            .map((row: { id: string; name: string; lat?: number; lon?: number }) => ({
              id: row.id,
              name: row.name,
              lat: row.lat,
              lon: row.lon,
            }));
        setBeachResults(list);
      } catch {
        // ignore — user can still fall back to the map-selected beach.
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [mode, beachSearch]);

  const updateStartsAtInput = useCallback(
    (value: string) => {
      setStartsAtInput(value);
      const startsAt = fromLocalInputValue(value);
      if (!startsAt) return;
      setEndsAtInput(toLocalInputValue(addMinutes(startsAt, durationMinutes)));
    },
    [durationMinutes, setEndsAtInput, setStartsAtInput],
  );

  const applyStartPreset = useCallback(
    (offsetMinutes: number) => {
      const startsAt =
        offsetMinutes === 0
          ? roundUpTo15Min(new Date())
          : roundUpTo15Min(addMinutes(new Date(), offsetMinutes));
      setStartsAtInput(toLocalInputValue(startsAt));
      setEndsAtInput(toLocalInputValue(addMinutes(startsAt, durationMinutes)));
    },
    [durationMinutes, setEndsAtInput, setStartsAtInput],
  );

  const applyDuration = useCallback(
    (minutes: number) => {
      setDurationMinutes(minutes);
      const startsAt =
        fromLocalInputValue(startsAtInput) ?? createDefaultWindow().startsAt;
      setEndsAtInput(toLocalInputValue(addMinutes(startsAt, minutes)));
    },
    [setEndsAtInput, startsAtInput],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const startsAt = fromLocalInputValue(startsAtInput);
      const endsAt = fromLocalInputValue(endsAtInput);
      if (!startsAt || !endsAt) {
        setError("Please choose a valid start and end time");
        return;
      }
      const clamped = clampDropWindow(startsAt, endsAt);
      if (!clamped.ok) {
        setError(clamped.message);
        return;
      }

      const body: Record<string, unknown> = {
        location_type: mode,
        starts_at: clamped.starts_at,
        ends_at: clamped.ends_at,
        audience,
        note: forecastSummary,
        forecast_snapshot: {
          source: "quiver_map",
          summary: forecastSummary,
          location_type: mode,
          captured_at: new Date().toISOString(),
        },
      };
      if (mode === "known_spot") {
        if (!pickedBeach) {
          setError("Pick a spot first");
          return;
        }
        body.beach_id = pickedBeach.id;
      } else {
        if (
          !customPin ||
          !Number.isFinite(customPin.lat) ||
          !Number.isFinite(customPin.lon)
        ) {
          setError("Drop a pin on the map first");
          return;
        }
        body.custom_lat = customPin.lat;
        body.custom_lon = customPin.lon;
        body.general_area = generalArea.trim() || null;
        body.exact_label = customPin.label ?? null;
      }

      try {
        setSubmitting(true);
        const res = await fetch("/api/surf-drops", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          const message =
            json?.error || `Failed to create Surf Drop (${res.status})`;
          setError(String(message));
          return;
        }
        const data = json?.data ?? {};
        if (!data?.id || !data?.share_slug) {
          setError("Surf Drop was created but the server returned no slug");
          return;
        }
        onCreated({
          id: data.id,
          share_slug: data.share_slug,
          location_type: mode,
          beach_id: mode === "known_spot" ? pickedBeach?.id ?? null : null,
          lat:
            mode === "known_spot"
              ? pickedBeach?.lat ?? null
              : customPin?.lat ?? null,
          lon:
            mode === "known_spot"
              ? pickedBeach?.lon ?? null
              : customPin?.lon ?? null,
          spot_name: mode === "known_spot" ? pickedBeach?.name ?? null : null,
          general_area:
            mode === "custom_pin" ? generalArea.trim() || null : null,
          exact_label: mode === "custom_pin" ? customPin?.label ?? null : null,
          starts_at: clamped.starts_at,
          ends_at: clamped.ends_at,
          audience,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setSubmitting(false);
      }
    },
    [
      mode,
      pickedBeach,
      customPin,
      generalArea,
      audience,
      forecastSummary,
      startsAtInput,
      endsAtInput,
      onClose,
      onCreated,
    ],
  );

  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-32 z-40 flex items-end justify-end p-3 sm:p-4 lg:items-stretch lg:p-0">
      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby="create-drop-sheet-title"
        data-testid="create-drop-sheet"
        className="zine-tab pointer-events-auto flex max-h-[calc(100%-1.5rem)] w-full max-w-[26rem] flex-col overflow-hidden rounded-sm border-2 border-[#11100D] bg-[#F4EBD8] text-[#11100D] shadow-[6px_8px_0_rgba(17,16,13,0.28)] lg:h-full lg:max-h-none lg:rounded-none lg:border-y-0 lg:border-r-0"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#11100D] bg-[#F5EEDC] p-4">
          <div className="min-w-0">
            <h2
              id="create-drop-sheet-title"
              className="font-heading text-2xl font-black leading-none"
            >
              Drop a spot
            </h2>
            <p className="mt-2 font-mono text-sm leading-5 text-[#11100D]/72">
              Confirm the pin, pick a window, and Quiver attaches the forecast.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close drop details"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border-2 border-[#11100D] bg-[#F4EBD8] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.2)] transition hover:bg-[#F78E42]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-5"
        >
          {/* Mode toggle */}
          <div
            role="tablist"
            aria-label="Drop location mode"
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                { id: "known_spot", label: "Existing Spot" },
                { id: "custom_pin", label: "Custom Pin" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={mode === opt.id}
                data-testid={`create-drop-mode-${opt.id}`}
                onClick={() => setMode(opt.id)}
                className={
                  mode === opt.id
                    ? "min-h-11 border-2 border-[#11100D] bg-[#F78E42] px-3 py-2 font-heading text-sm font-black text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.18)]"
                    : "min-h-11 border-2 border-[#11100D] bg-[#F5EEDC] px-3 py-2 font-heading text-sm font-black text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.12)] transition hover:-translate-y-0.5"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {mode === "known_spot" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide">
                Spot
              </label>
              <input
                type="text"
                data-testid="create-drop-beach-search"
                placeholder={
                  pickedBeach ? pickedBeach.name : "Search a beach…"
                }
                value={beachSearch}
                onChange={(e) => setBeachSearch(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
                style={{
                  borderColor: "rgba(17, 16, 13, 0.25)",
                  background: "#F5EEDC",
                }}
              />
              {beachResults.length > 0 && (
                <ul
                  className="mt-1 max-h-40 overflow-auto rounded border"
                  style={{
                    borderColor: "rgba(17, 16, 13, 0.15)",
                    background: "#F5EEDC",
                  }}
                >
                  {beachResults.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        data-testid={`create-drop-beach-result-${row.id}`}
                        onClick={() => {
                          setPickedBeach(row);
                          setBeachSearch("");
                          setBeachResults([]);
                        }}
                        className="w-full px-2 py-1 text-left text-sm hover:bg-white/40"
                      >
                        {row.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pickedBeach && (
                <div
                  data-testid="create-drop-picked-beach"
                  className="border-2 border-[#11100D] bg-[#F78E42] px-3 py-2 font-heading text-sm font-black text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.18)]"
                >
                  {pickedBeach.name}
                </div>
              )}
              {!pickedBeach && beachResults.length === 0 && (
                <p className="text-xs" style={{ color: "rgba(17,16,13,0.7)" }}>
                  Tap a beach on the map to attach it — or search above.
                </p>
              )}
            </div>
          )}

          {mode === "custom_pin" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide">
                Custom pin
              </label>
              {customPin ? (
                <div
                  data-testid="create-drop-custom-pin"
                  className="border-2 border-[#11100D] bg-[#F5EEDC] px-3 py-2 font-mono text-sm shadow-[2px_3px_0_rgba(17,16,13,0.12)]"
                >
                  {customPin.lat.toFixed(4)}, {customPin.lon.toFixed(4)}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "rgba(17,16,13,0.7)" }}>
                  Drop the pin on the map first, then reopen this sheet.
                </p>
              )}
              <label className="mt-2 text-xs font-semibold uppercase tracking-wide">
                General area
              </label>
              <div
                data-testid="create-drop-general-area"
                className="border border-[#11100D]/25 bg-[#F5EEDC] px-3 py-2 font-mono text-sm text-[#11100D]/78"
              >
                {generalArea.trim() || "Custom pin"}
              </div>
            </div>
          )}

          <div className="space-y-3 border-2 border-[#11100D] bg-[#F5EEDC] p-3 shadow-[3px_4px_0_rgba(17,16,13,0.14)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#0B3A75]">
                  Surf window
                </p>
                <p className="mt-1 text-xs font-semibold text-[#11100D]/68">
                  Start now or schedule a quick heads-up.
                </p>
              </div>
              <div
                data-testid="create-drop-end-summary"
                className="shrink-0 border border-[#11100D]/25 bg-[#F4EBD8] px-2 py-1 text-right font-mono text-xs font-bold"
              >
                Ends {formatWindowTime(endsAtInput)}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide">
                Starts
              </label>
              <input
                type="datetime-local"
                data-testid="create-drop-starts-at"
                value={startsAtInput}
                onChange={(e) => updateStartsAtInput(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
                style={{
                  borderColor: "rgba(17, 16, 13, 0.25)",
                  background: "#F5EEDC",
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {START_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyStartPreset(preset.offsetMinutes)}
                  className="min-h-9 border-2 border-[#11100D] bg-[#F4EBD8] px-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0_rgba(17,16,13,0.12)] transition hover:-translate-y-0.5 hover:bg-[#F78E42]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide">
                Duration
              </label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    data-testid={`create-drop-duration-${option.minutes}`}
                    aria-pressed={durationMinutes === option.minutes}
                    onClick={() => applyDuration(option.minutes)}
                    className={
                      durationMinutes === option.minutes
                        ? "min-h-9 border-2 border-[#11100D] bg-[#F78E42] px-2 font-mono text-xs font-black uppercase text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.18)]"
                        : "min-h-9 border-2 border-[#11100D] bg-[#F4EBD8] px-2 font-mono text-xs font-black uppercase text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.12)] transition hover:-translate-y-0.5"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-2 border-[#11100D] bg-[#11100D] p-3 text-[#F5EEDC] shadow-[3px_4px_0_rgba(247,142,66,0.28)]">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#FDB84B]">
              Forecast attached
            </p>
            <p
              data-testid="create-drop-forecast-summary"
              className="mt-2 font-mono text-sm leading-6 text-[#F5EEDC]/82"
            >
              {forecastSummary}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide">
              Audience
            </label>
            <select
              data-testid="create-drop-audience"
              value={audience}
              onChange={(e) =>
                setAudience(
                  e.target.value as "mutuals" | "friends" | "link" | "private",
                )
              }
              className="rounded border px-2 py-1.5 text-sm"
              style={{
                borderColor: "rgba(17, 16, 13, 0.25)",
                background: "#F5EEDC",
              }}
            >
              <option value="mutuals">Mutuals</option>
              <option value="friends">Friends</option>
              <option value="link">Anyone with the link</option>
              <option value="private">Private (just me)</option>
            </select>
          </div>

          {error && (
            <p
              data-testid="create-drop-error"
              className="rounded px-2 py-1 text-xs"
              style={{ background: "#B91C1C", color: "#F4EBD8" }}
            >
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2 border-t-2 border-[#11100D]/15 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="rounded-sm border-2 border-[#11100D] bg-[#F4EBD8] font-heading font-black uppercase text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.18)] hover:bg-[#F0E5CC] hover:text-[#11100D]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="ghost"
              data-testid="create-drop-submit"
              disabled={submitting}
              className="rounded-sm border-2 border-[#11100D] !bg-[#F78E42] font-heading font-black uppercase !text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.28)] hover:!bg-[#F78E42] disabled:opacity-60"
            >
              {submitting ? "Dropping…" : "Drop it"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
