"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { FEEDBACK_OFFER_COPY } from "@/lib/trial-feedback/contract";
import { webFeedbackContextSchema, type WebFeedbackContext } from "@/lib/trial-feedback/web-contract";

export function WebRecoveryCard({ userId, fallback }: { userId: string; fallback: ReactNode }): ReactNode {
  const { user } = useAuth();
  const current = useRef(user?.id); current.current = user?.id;
  const [data, setData] = useState<WebFeedbackContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    let active = true; current.current = userId;
    void fetch("/api/trial-feedback/web", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Web offer unavailable");
      const value = webFeedbackContextSchema.parse(await response.json());
      if (active && current.current === userId && value.user_id === userId) setData(value);
    }).catch(() => { if (active) setMessage("Your web offer could not be loaded. Refresh this page to try again."); });
    return () => { active = false; current.current = undefined; };
  }, [userId]);
  async function act(action: "accept" | "reconcile" | "portal"): Promise<void> {
    if (inFlight.current || current.current !== userId) return;
    inFlight.current = true; setBusy(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/trial-feedback/web", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "accept" ? { action, request_id: requestId.current, terms_version: data?.terms_version, accept: true } : { action }) });
      if (!response.ok) throw new Error("Offer not confirmed");
      const value = await response.json();
      if (current.current !== userId || value.user_id !== userId) return;
      if (action === "portal") {
        const url = new URL(value.url);
        if (url.origin !== "https://billing.revenuecat.com" || url.username || url.password) throw new Error("Portal unavailable");
        // eslint-disable-next-line no-restricted-properties -- Leave the app for the external, single-use billing portal.
        window.location.assign(url.toString());
      } else setData(webFeedbackContextSchema.parse(value));
    } catch { if (current.current === userId) setMessage("We couldn’t confirm that change. Check your saved offer status before trying again."); }
    finally { inFlight.current = false; if (current.current === userId) setBusy(false); }
  }
  if (!data || data.status === "unavailable") return <>{fallback}{message && <p role="alert">{message}</p>}</>;
  const formatted = (value: string | null): string => value ? new Date(value).toLocaleDateString() : "";
  const confirmed = data.status === "extended" || data.status === "renewing";
  return <section aria-label="Your extra month on the web" className="space-y-4">
    {data.status === "available" ? <>
      <p>{FEEDBACK_OFFER_COPY}</p>
      <p>Keep your remaining trial through {formatted(data.trial_ends_at)}, plus Pro at no charge through {formatted(data.free_ends_at)}.</p>
      <p className="text-sm">Adding this month won’t restart paid renewal. Afterwards, you can review your existing plan and price with our billing provider and choose to keep your subscription going.</p>
      <Button disabled={busy} className="min-h-11" onClick={() => void act("accept")}>Add my free month</Button>
    </> : confirmed ? <>
      <p>Your extra month is confirmed through {formatted(data.free_ends_at)}.</p>
      <p>{data.status === "renewing" ? "Your billing provider confirms renewal is on. You can review your plan, price and renewal settings below." : "Paid renewal is still off. Review your existing plan and price to decide whether to continue after your free time."}</p>
      <Button disabled={busy} className="min-h-11" onClick={() => void act("portal")}>{data.status === "renewing" ? "Manage my subscription" : "Review paid renewal"}</Button>
    </> : data.status === "closed" ? <p>Your extra free month ended on {formatted(data.free_ends_at)}. Your billing provider has your current subscription details.</p>
      : <p>{data.status === "review_required" ? "We’re checking your offer with our billing provider. Your feedback and request are saved; there’s no need to submit again." : "Your extra-month request is saved. We’re waiting for confirmation from our billing provider."}</p>}
    {(data.status !== "available" || message) && <div><Button variant="outline" disabled={busy} className="min-h-11 border-[var(--ink)] bg-transparent text-[var(--ink)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]" onClick={() => void act("reconcile")}>{busy ? "Checking…" : "Check saved offer status"}</Button></div>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
