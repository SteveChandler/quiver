"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ownedOffersSchema, offerResultSchema } from "@/lib/subscription/offer-contract";
import type { z } from "zod";

export function OwnedOffers({ enabled }: { enabled: boolean }): React.ReactElement | null {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const userId = user?.id;
  const currentUser = useRef(userId); currentUser.current = userId;
  const [cachedData, setData] = useState<z.infer<typeof ownedOffersSchema> | null>(null);
  const data = cachedData?.user_id === userId ? cachedData : null;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState(false);
  const load = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/offers", { cache: "no-store" });
    if (response.status === 401) { setAuth(true); return; }
    if (!response.ok) throw new Error("Offers unavailable");
    const next = ownedOffersSchema.parse(await response.json());
    if (currentUser.current !== userId || next.user_id !== userId) return;
    setAuth(false); setData(next);
  }, [userId]);
  useEffect(() => {
    setData(null); setMessage(""); setBusy(false);
    if (!enabled || !userId) return;
    void load().catch(() => setMessage("Your offers could not be loaded. Refresh to try again."));
    const refresh = (): void => { if (document.visibilityState === "visible") void load().catch(() => setMessage("Your offers could not be refreshed.")); };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [enabled, load, userId]);
  if (!enabled) return null;
  async function act(path: string, body: unknown): Promise<void> {
    if (busy) return;
    if (path.endsWith("claim") && body && typeof body === "object") {
      const messageId = searchParams.get("message_instance_id");
      if (messageId && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(messageId)) body = { ...body, messageInstanceId: messageId };
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 401) { setAuth(true); setData(null); return; }
      const result = await response.json();
      if (currentUser.current !== userId) return;
      if (path.endsWith("claim")) {
        const claim = offerResultSchema.parse(result);
        if (claim.status === "disabled") { setMessage("Offer claims are paused. Please try later."); return; }
        setMessage(claim.status === "verified" ? "Your Pro reward is confirmed. Open Quiver to refresh your access."
          : claim.status === "held_active_access" ? "Your claim is saved. It will start automatically after your current access ends."
          : claim.status === "not_earned" ? "Your claim is saved. Once you have five completed sessions, your reward will start automatically when you have no other active access."
          : "Your claim is being checked. It is saved on your account; you do not need to enter another code.");
      } else if (!response.ok) throw new Error("Unavailable");
      else setMessage(path.endsWith("consent") ? "Email preference saved. Existing reply pauses and unsubscribe choices still apply." : "You’re enrolled. Your previous completed sessions count.");
      await load();
    } catch { setMessage("We could not confirm that change. Refresh to check your saved status before retrying."); }
    finally { if (currentUser.current === userId) setBusy(false); }
  }
  return <section className="space-y-4 border-b border-[var(--paper-deep)] pb-6" aria-label="Your account offers">
    <h2 className="text-xl font-semibold">Your account offers</h2>
    {auth || !userId ? <Link className="underline" href="/auth/sign-in?redirectTo=%2Foffers%2Fclaim">Sign in to see your offers</Link> : <>
      {!data && <p>Loading your offers…</p>}
      {data?.offers.map(offer => <div key={offer.award_id} className="space-y-3">
        <h3 className="font-semibold">{offer.months === 1 ? "One month of Pro for five sessions" : "Three months of Pro on us"}</h3>
        <p>{offer.months === 1 && `${Math.min(5, offer.completed_sessions)} of five completed sessions. Previous sessions count. `}No payment or automatic renewal. Access begins when your claim is fulfilled; existing paid, trial or promotional access takes priority.</p>
        {offer.state === "verified" ? <p>Confirmed through {new Date(offer.expires_at!).toLocaleDateString()}.{!offer.mirror_verified && " Your account access is still syncing."} <a className="underline" href="quiver://settings">Open Quiver</a></p>
          : offer.claim_requested ? <p>Your claim is saved. We’ll fulfill it automatically when eligible.</p>
          : <Button className="min-h-11" disabled={busy} onClick={() => void act("/api/offers/claim", { awardId: offer.award_id, mode: "claim" })}>Accept and save my claim</Button>}
      </div>)}
      {data?.enrollment && !data.offers.some(offer => offer.program_id === "five_sessions_month") && <div className="space-y-3"><p>Log five completed sessions for one calendar month of Pro on us. Historical completed sessions count. No payment or automatic renewal.</p><Button disabled={busy} onClick={() => void act("/api/offers", { terms_version: data.enrollment!.terms_version, accept: true })}>Join the five-session reward</Button></div>}
      {data && data.offers.length === 0 && !data.enrollment && <p>No offers are available for this account right now.</p>}
      {data && <div className="space-y-2"><p className="text-sm">Optional: get founder notes, session support and eligible offers by email. This is separate from your reward.</p><Button className="min-h-11 border-[var(--ink)] !bg-[var(--paper)] !text-[var(--ink)] hover:!bg-[var(--paper-deep)]" variant="outline" disabled={busy} onClick={() => void act("/api/email/lifecycle/consent", { consent: true, version: "lifecycle-v1" })}>Opt in to lifecycle emails</Button><Button className="min-h-11 !text-[var(--ink)]" variant="ghost" disabled={busy} onClick={() => void act("/api/email/lifecycle/consent", { consent: false, version: "lifecycle-v1" })}>Stop lifecycle emails</Button></div>}
    </>}
    {message && <p role="status" aria-live="polite">{message}</p>}
  </section>;
}
