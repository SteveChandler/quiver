"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { offerResultSchema } from "@/lib/subscription/offer-contract";
import { Label } from "@/components/ui/label";

export function OfferClaimForm({ enabled }: { enabled: boolean }): React.ReactElement {
  const [code, setCode] = useState("");
  const [months, setMonths] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || !enabled) return;
    setBusy(true); setMessage(""); setNeedsAuth(false);
    try {
      const response = await fetch("/api/offers/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerToken: code.trim(), mode: months === null ? "preview" : "claim" }) });
      if (response.status === 401) { setNeedsAuth(true); setMessage("Sign in to the account that received this offer, then enter your code again."); return; }
      const result = offerResultSchema.parse(await response.json());
      if (response.ok && result.status === "preview" && (result.months === 1 || result.months === 3)) {
        setMonths(result.months); setMessage(`Your offer is ${result.months === 1 ? "one calendar month" : "three calendar months"} of Pro, starting when your claim is fulfilled. No payment or automatic renewal. Confirm below to use this offer.`);
      } else if (response.ok && result.status === "verified" && typeof result.expires_at === "string" && Number.isFinite(Date.parse(result.expires_at))) {
        setCode(""); setMessage(`Your Pro offer is confirmed through ${new Date(result.expires_at).toLocaleDateString()}. Open Quiver to refresh your access. If it has not appeared yet, keep this page and contact support.`);
      } else if (result.status === "held_active_access") setMessage("You already have active access. Your claim is saved and will resume automatically after that access ends.");
      else if (result.status === "not_earned") setMessage(`You have ${result.completed_sessions} of five completed sessions. Your claim is saved and will start automatically after you reach five and your existing access ends.`);
      else if (response.status === 404) setMessage("That code does not match this account. Check the code and the account you signed in with.");
      else setMessage("Your offer needs a little attention. Your reward has not been discarded. Please try later or contact support.");
    } catch { setMessage("We could not confirm your offer. Your reward has not been discarded. Please try again later."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4 ph-no-capture">
    {!enabled && <p role="status">Offer claims are not open yet. Keep your code for when claims open.</p>}
    <div className="space-y-2"><Label htmlFor="offer-code">Your offer code</Label>
      <Input className="border-[var(--paper-deep)] bg-[var(--paper)] text-[var(--ink)]" id="offer-code" type="password" data-sentry-mask data-zine-input="true" value={code} onChange={event => { setCode(event.target.value); setMonths(null); setMessage(""); }} autoComplete="off" spellCheck={false} required minLength={43} maxLength={43} disabled={!enabled || busy} />
    </div>
    <Button type="submit" className="w-full min-h-11" disabled={!enabled || busy}>{busy ? "Checking your offer…" : months === null ? "Review my offer" : "Confirm and claim Pro"}</Button>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {needsAuth && <Link className="block underline" href="/auth/sign-in?redirectTo=%2Foffers%2Fclaim">Sign in to claim</Link>}
    <a className="block text-sm underline" href="mailto:steve@quiversurf.app">Ask Steve for help</a>
  </form>;
}
