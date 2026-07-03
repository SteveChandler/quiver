/**
 * CreateDropSheet — modal drawer with the two-mode ("known spot" vs
 * "custom pin") drop-creation UI. Overlays the map, closes on submit +
 * hands the freshly-created share_slug back to the parent (the map page
 * client uses that to open the sibling agent's ShareDropSheet).
 *
 * Client-side clamps mirror lib/surf-drops/validation.ts so we don't waste a
 * round-trip on bad input:
 *   - starts_at ≤ now + 4 days
 *   - ends_at   > starts_at
 *   - ends_at - starts_at ≥ 15 min
 *   - note ≤ 240 chars
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const NOTE_MAX = 240;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 15 * 60 * 1000;

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
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const startsAt = roundUpTo15Min(new Date(Date.now() + 15 * 60 * 1000));
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    return { startsAt, endsAt };
  }, []);
  const [startsAtInput, setStartsAtInput] = useState<string>(
    toLocalInputValue(defaults.startsAt),
  );
  const [endsAtInput, setEndsAtInput] = useState<string>(
    toLocalInputValue(defaults.endsAt),
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
    if (selectedBeach) {
      setPickedBeach(selectedBeach);
      return;
    }
    if (defaultMode === "custom_pin") {
      setPickedBeach(null);
      setBeachSearch("");
      setBeachResults([]);
    }
  }, [defaultMode, open, selectedBeach]);

  useEffect(() => {
    if (customPin?.label && !generalArea) setGeneralArea(customPin.label);
  }, [customPin, generalArea]);

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
      if (note.length > NOTE_MAX) {
        setError(`Note must be ${NOTE_MAX} characters or fewer`);
        return;
      }

      const body: Record<string, unknown> = {
        location_type: mode,
        starts_at: clamped.starts_at,
        ends_at: clamped.ends_at,
        audience,
        note: note.trim() || null,
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
        onCreated({ id: data.id, share_slug: data.share_slug });
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
      note,
      startsAtInput,
      endsAtInput,
      onClose,
      onCreated,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        data-testid="create-drop-sheet"
        className="max-w-md"
        style={{ background: "#F4EBD8", color: "#11100D" }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: "'Bowlby One', 'Space Grotesk', system-ui",
              letterSpacing: "-0.01em",
            }}
          >
            Drop a spot
          </DialogTitle>
          <DialogDescription className="sr-only">
            Share a heads-up that you&apos;re surfing at a known spot or a
            custom pin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Mode toggle */}
          <div
            role="tablist"
            aria-label="Drop location mode"
            className="flex gap-1 rounded-md border p-1"
            style={{ borderColor: "rgba(17, 16, 13, 0.2)" }}
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
                className="flex-1 rounded px-3 py-1.5 text-sm font-semibold transition"
                style={{
                  background: mode === opt.id ? "#F78E42" : "transparent",
                  color: mode === opt.id ? "#F4EBD8" : "#11100D",
                }}
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
                  className="rounded px-2 py-1 text-sm"
                  style={{ background: "#F78E42", color: "#F4EBD8" }}
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
                  className="rounded px-2 py-1 text-sm"
                  style={{ background: "#F5EEDC" }}
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
              <input
                type="text"
                data-testid="create-drop-general-area"
                placeholder="e.g. North County SD"
                value={generalArea}
                onChange={(e) => setGeneralArea(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
                style={{
                  borderColor: "rgba(17, 16, 13, 0.25)",
                  background: "#F5EEDC",
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide">
                Starts
              </label>
              <input
                type="datetime-local"
                data-testid="create-drop-starts-at"
                value={startsAtInput}
                onChange={(e) => setStartsAtInput(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
                style={{
                  borderColor: "rgba(17, 16, 13, 0.25)",
                  background: "#F5EEDC",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide">
                Ends
              </label>
              <input
                type="datetime-local"
                data-testid="create-drop-ends-at"
                value={endsAtInput}
                onChange={(e) => setEndsAtInput(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
                style={{
                  borderColor: "rgba(17, 16, 13, 0.25)",
                  background: "#F5EEDC",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide">
              Note
            </label>
            <textarea
              data-testid="create-drop-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="Optional — tide, wax, meet at the stairs…"
              className="rounded border px-2 py-1.5 text-sm"
              style={{
                borderColor: "rgba(17, 16, 13, 0.25)",
                background: "#F5EEDC",
              }}
            />
            <div
              data-testid="create-drop-note-count"
              className="text-right text-[10px]"
              style={{ color: "rgba(17,16,13,0.6)" }}
            >
              {note.length}/{NOTE_MAX}
            </div>
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

          <div className="mt-1 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="create-drop-submit"
              disabled={submitting}
              style={{ background: "#F78E42", color: "#F4EBD8" }}
            >
              {submitting ? "Dropping…" : "Drop it"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
