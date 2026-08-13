"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

interface AnonAlertCaptureFormProps {
  beachId: string;
  beachName: string;
  returnPath: string;
}

const PRESETS: Array<{
  value: "glass_off" | "big_day" | "mellow_session";
  label: string;
}> = [
  { value: "glass_off", label: "Glassy mornings" },
  { value: "big_day", label: "Big swells" },
  { value: "mellow_session", label: "Beginner-friendly" },
];

/**
 * AnonAlertCaptureForm — inline email capture + preset chooser for anonymous
 * users on beach-detail pages. Submits to `/api/alerts/anon-capture` which
 * sends a magic link; the callback materializes the alert rule. Self-guards
 * against authenticated users via `useAuth()` per CLAUDE.md CTA
 * defense-in-depth.
 */
export function AnonAlertCaptureForm({
  beachId,
  beachName,
  returnPath,
}: AnonAlertCaptureFormProps): React.ReactElement | null {
  const { user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [preset, setPreset] =
    useState<(typeof PRESETS)[number]["value"]>("glass_off");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const viewedRef = useRef<boolean>(false);

  // Dwell-gated view tracking. Mirrors trackSignupCtaView pattern: 500ms
  // delay + visibility check filters background-tab prefetches and
  // fast-bouncers from the CTA conversion denominator.
  useEffect(() => {
    if (authLoading || user || viewedRef.current) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    const t = setTimeout(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (viewedRef.current) return;
      viewedRef.current = true;
      fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_type: "anon_alert_capture_view",
          metadata: { beach_id: beachId, surface: "beach-detail-anon" },
        }),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [authLoading, user, beachId]);

  // Defense-in-depth: never render to authenticated users.
  if (authLoading || user) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      const honeypot = (formData.get("website") as string) ?? "";
      const res = await fetch("/api/alerts/anon-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          beach_id: beachId,
          preset_type: preset,
          return_path: returnPath,
          website: honeypot,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "unknown_error");
        fetch("/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            event_type: "anon_alert_capture_error",
            metadata: { beach_id: beachId, error_code: data.error },
          }),
        }).catch(() => {});
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-lg border border-[#404C92] bg-[#1E2660] p-5"
        data-testid="anon-alert-capture-success"
        role="status"
        aria-live="polite"
      >
        <p className="text-base font-bold text-white">Check your email</p>
        <p className="mt-1 text-sm text-gray-300">
          We sent a sign-in link to {email}. Click it to confirm your alert.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[#404C92] bg-[#1E2660] p-5 space-y-3"
      data-testid="anon-alert-capture-form"
      aria-label={`Email me when ${beachName} is firing`}
    >
      <p className="text-base font-bold text-white">
        Email me when {beachName} is firing
      </p>
      {/* Honeypot — hidden from users + screen readers. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        data-testid="anon-alert-capture-email"
        className="w-full rounded border border-[#404C92] bg-[#252D6B] px-3 py-2 text-sm text-white placeholder:text-[#9AABC6] focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50"
      />
      <fieldset className="space-y-1">
        <legend className="text-xs uppercase tracking-widest text-gray-400">
          Notify me about
        </legend>
        {PRESETS.map((p) => (
          <label
            key={p.value}
            className="flex items-center gap-2 text-sm text-white"
          >
            <input
              type="radio"
              name="preset"
              value={p.value}
              checked={preset === p.value}
              onChange={() => setPreset(p.value)}
            />
            {p.label}
          </label>
        ))}
      </fieldset>
      {error && (
        <p
          className="text-sm text-red-400"
          role="alert"
          data-testid="anon-alert-capture-error"
        >
          Something went wrong: {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={submitting}
        data-testid="anon-alert-capture-submit"
        className="w-full bg-[#F78E42] hover:bg-[#F78E42]/90 text-[#11100D]"
      >
        {submitting ? "Sending..." : "Get alerts"}
      </Button>
    </form>
  );
}
