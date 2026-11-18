"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuthRetry } from "@/lib/fetch-with-auth-retry";
import {
  ALERT_EMAIL_EARLIEST_VALUES,
  alertEmailEarliestSchema,
  DEFAULT_ALERT_EMAIL_EARLIEST,
  type AlertEmailEarliest,
} from "@/lib/profile/alert-email-earliest";

const ENDPOINT = "/api/profile/alert-email-earliest";
const LABELS: Record<AlertEmailEarliest, string> = { "05:00": "5 AM", "06:00": "6 AM", "07:00": "7 AM", "09:00": "9 AM" };

type LoadState = "loading" | "ready" | "hidden";

/**
 * Earliest local time a condition alert email may arrive. Saves on tap, like the native setting;
 * it is not part of the profile form, so a profile save never names the column.
 */
export function AlertEmailEarliestPills() {
  const labelId = useId();
  const [state, setState] = useState<LoadState>("loading");
  const [value, setValue] = useState<AlertEmailEarliest>(DEFAULT_ALERT_EMAIL_EARLIEST);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const response = await fetchWithAuthRetry(ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data?: { earliest?: unknown; supported?: unknown } };
        if (!mounted.current) return;
        // Before the column exists the setting cannot be saved, so it is not shown.
        if (body.data?.supported !== true) return setState("hidden");
        const parsed = alertEmailEarliestSchema.safeParse(body.data.earliest);
        setValue(parsed.success ? parsed.data : DEFAULT_ALERT_EMAIL_EARLIEST);
        setState("ready");
      } catch (error) {
        console.warn("[AlertEmailEarliestPills] load failed", error);
        if (mounted.current) setState("hidden");
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function select(next: AlertEmailEarliest) {
    if (saving || next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const response = await fetchWithAuthRetry(ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ earliest: next }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn("[AlertEmailEarliestPills] save failed", error);
      if (mounted.current) setValue(previous);
      toast.error("Setting not saved");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  if (state === "hidden") return null;

  return (
    <div className="flex flex-col gap-2 py-3" data-testid="alert-email-earliest">
      <span id={labelId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Earliest alert email
      </span>
      <p className="text-sm text-muted-foreground">
        Dawn windows need an early heads-up. Other emails still come in the day.
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {ALERT_EMAIL_EARLIEST_VALUES.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={state === "loading" || saving}
              onClick={() => void select(option)}
              className={cn(
                "min-h-11 min-w-16 rounded-full border px-4 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-[#F78E42] bg-[#F78E42] text-[#1A1A2E]"
                  : "border-gray-300 text-foreground hover:border-[#F78E42] dark:border-gray-700",
              )}
            >
              {LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
