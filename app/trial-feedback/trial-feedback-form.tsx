"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { WebRecoveryCard } from "./web-recovery-card";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { FEEDBACK_REASONS, FEEDBACK_OFFER_COPY, feedbackContextSchema, type FeedbackContext } from "@/lib/trial-feedback/contract";

function AccountFeedback({ userId }: { userId: string }): React.ReactElement {
  const search = useSearchParams();
  const { user } = useAuth();
  const current = useRef(user?.id); current.current = user?.id;
  const [data, setData] = useState<FeedbackContext | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const confirmation = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!data?.submission_id) return;
    confirmation.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [data?.submission_id]);
  const load = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/trial-feedback", { cache: "no-store" });
    if (!response.ok) throw new Error("Feedback unavailable");
    const next = feedbackContextSchema.parse(await response.json());
    if (current.current !== userId || next.user_id !== userId) return;
    setData(next); setMessage("");
  }, [userId]);
  useEffect(() => {
    current.current = userId;
    void load().catch(() => setMessage("Your feedback form could not be loaded. Please try again."));
    return () => { current.current = undefined; };
  }, [load, userId]);
  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    const messageId = search.get("message_instance_id");
    try {
      const response = await fetch("/api/trial-feedback", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId.current, reason, note,
          ...(messageId && /^[0-9a-f-]{36}$/i.test(messageId) ? { message_instance_id: messageId } : {}) }) });
      if (!response.ok) throw new Error("Feedback not confirmed");
      const next = feedbackContextSchema.parse(await response.json());
      if (current.current === userId && next.user_id === userId) setData(next);
    } catch { if (current.current === userId) setMessage("We couldn’t confirm that your feedback was saved. Refresh to check before trying again."); }
    finally { inFlight.current = false; if (current.current === userId) setBusy(false); }
  }
  if (data?.submission_id) return <div className="space-y-4" role="status">
    <h2 ref={confirmation} tabIndex={-1} className="font-heading text-2xl">Thanks for sharing that.</h2>
    <WebRecoveryCard userId={userId} fallback={data.status === "verified" ? <p>Your extra month is confirmed through {new Date(data.verified_until!).toLocaleDateString()}. Manage renewal with your billing provider.</p>
      : data.redemption_state === "reserved" ? <p>Your offer is awaiting confirmation from your billing provider. Your feedback is saved.</p>
      : data.offer ? <><p>{FEEDBACK_OFFER_COPY}</p><a href="quiver://settings" className="inline-flex min-h-11 items-center rounded-md bg-[var(--ink)] px-4 text-[var(--paper)]">Review my extra month</a><p className="text-sm">Open Quiver on the device where you subscribed to review your free-period dates, subscription price and paid renewal before accepting. Sending feedback hasn’t restarted your subscription.</p></>
      : <p>Your feedback is saved. If you’re looking for more time with Pro, offer availability depends on your subscription. Your subscription hasn’t changed.</p>} />
  </div>;
  return <div className="space-y-4">
    {data?.status === "available" ? <form className="space-y-5" onSubmit={event => void submit(event)}>
      <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 font-semibold">What led you to cancel?</legend>
        {Object.entries(FEEDBACK_REASONS).map(([value, label]) => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--paper-deep)] px-3 py-2"><input type="radio" name="reason" value={value} required checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}
      </fieldset>
      <div className="space-y-2"><label htmlFor="feedback-note" className="block font-semibold">Anything you’d like me to know? {reason === "other" ? "(Required)" : "(Optional)"}</label>
        <textarea id="feedback-note" data-sentry-mask required={reason === "other"} disabled={busy} maxLength={2000} rows={4} value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-md border border-[var(--ink)] bg-[var(--paper)] p-3" /></div>
      <Button type="submit" disabled={busy || !reason || (reason === "other" && !note.trim())} className="min-h-11">{busy ? "Saving…" : "Send feedback"}</Button>
    </form> : data ? <p>This account doesn’t have an eligible trial feedback request right now.</p> : !message ? <p role="status">Loading your feedback form…</p> : null}
    {message && <><p role="alert">{message}</p><Button variant="outline" onClick={() => void load().catch(() => setMessage("The form is still unavailable. Please try later."))}>Refresh feedback</Button></>}
  </div>;
}

export function TrialFeedbackForm({ enabled }: { enabled: boolean }): React.ReactElement {
  const { user } = useAuth();
  const search = useSearchParams();
  if (!enabled) return <p>The feedback form isn’t available right now. Please check back later.</p>;
  const messageId = search.get("message_instance_id");
  const returnTo = `/trial-feedback${messageId && /^[0-9a-f-]{36}$/i.test(messageId) ? `?message_instance_id=${messageId}` : ""}`;
  if (!user) return <Link href={`/auth/sign-in?redirectTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center underline">Sign in to share your feedback</Link>;
  return <AccountFeedback key={user.id} userId={user.id} />;
}
