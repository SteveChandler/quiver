"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import { Button } from "@/components/ui/button";

export interface LeadCaptureProps {
  breakSlug: string;
  breakName: string;
  heatTotal: number;
  challengeCode: string;
  sessionId?: string;
}

export function LeadCapture({ breakSlug, breakName, heatTotal, challengeCode, sessionId }: LeadCaptureProps): ReactElement {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "validation-error" | "server-error">("idle");
  const smsEnabled = process.env.NEXT_PUBLIC_PLAY_SMS_ENABLED === "true";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("idle");
    const hasContact = Boolean(email.trim() || (smsEnabled && phone.trim()));
    if (!hasContact || !consent || !event.currentTarget.checkValidity()) {
      setStatus("validation-error");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/play/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined, phone: smsEnabled && phone.trim() ? phone.trim() : undefined, consent, breakSlug, breakName, heatTotal, challengeCode, sessionId }),
      });
      const result: { success?: boolean } = await response.json();
      setStatus(response.ok && result.success ? "success" : "server-error");
    } catch {
      setStatus("server-error");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="torn torn-tb mt-5 border-2 border-[#11100D] bg-[#F4EBD8] p-5 text-left text-[#11100D] shadow">
      <h3 className="font-heading text-xl font-black uppercase">{breakName} is real.</h3>
      <p className="mt-2 text-sm leading-6 text-[#11100D]/75">Quiver tells you the morning it is actually working. Get this week&apos;s {breakName} forecast and the app.</p>
      {status === "success" ? <p className="mt-4 border-l-4 border-[#B91C1C] pl-3 font-heading text-lg font-black" role="status">Forecast on its way. Now go beat your score.</p> : null}
      <form className="mt-4 grid gap-3" aria-label={`${breakName} forecast signup`} onSubmit={handleSubmit} noValidate>
        <label className="grid gap-1 font-mono text-xs font-bold uppercase tracking-[0.1em]">
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@outside.surf" autoComplete="email" className="h-11 border-2 border-[#11100D] bg-[#F5EEDC] px-3 font-sans text-sm" />
        </label>
        {smsEnabled ? <label className="grid gap-1 font-mono text-xs font-bold uppercase tracking-[0.1em]">
          Mobile number <span className="font-sans text-[10px] font-normal normal-case tracking-normal">(optional)</span>
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(831) 555-0123" autoComplete="tel" className="h-11 border-2 border-[#11100D] bg-[#F5EEDC] px-3 font-sans text-sm" />
        </label> : null}
        <label className="flex items-start gap-2 text-xs leading-5">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
          <span>Send me the forecast for this break and Quiver updates. Unsubscribe any time.</span>
        </label>
        {status === "validation-error" ? <p className="text-sm font-bold text-[#B91C1C]" role="alert">Add an email or mobile number and check consent to try again.</p> : null}
        {status === "server-error" ? <p className="text-sm font-bold text-[#B91C1C]" role="alert">Couldn&apos;t save that. Try again in a moment.</p> : null}
        <Button type="submit" disabled={pending} className="rounded-none font-heading uppercase">{pending ? "Sending..." : "Get the real forecast"}</Button>
      </form>
    </section>
  );
}
