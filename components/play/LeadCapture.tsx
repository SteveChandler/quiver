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
    <section className="mt-5 border-4 border-[#29C7F6] bg-[#0B5FA5] p-5 text-left text-[#F8FEFF] shadow-[4px_4px_0_#0A1D2B]">
      <h3 className="text-base uppercase">{breakName} is real.</h3>
      <p className="mt-3 font-sans text-sm font-bold leading-6 text-[#E6F9FF]">Quiver tells you the morning it is actually working. Get this week&apos;s {breakName} forecast and the app.</p>
      {status === "success" ? <p className="mt-4 border-l-4 border-[#43D87D] pl-3 font-sans text-sm font-black" role="status">Forecast on its way. Now go beat your score.</p> : null}
      <form className="mt-4 grid gap-3" aria-label={`${breakName} forecast signup`} onSubmit={handleSubmit} noValidate>
        <label className="grid gap-2 text-[7px] uppercase text-[#B8F1FF]">
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" className="h-11 border-2 border-[#29C7F6] bg-[#B8F1FF] px-3 font-sans text-sm font-bold text-[#0A1D2B]" />
        </label>
        {smsEnabled ? <label className="grid gap-2 text-[7px] uppercase text-[#B8F1FF]">
          Mobile number <span className="font-sans text-[10px] font-normal normal-case tracking-normal">(optional)</span>
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(831) 555-0123" autoComplete="tel" className="h-11 border-2 border-[#29C7F6] bg-[#B8F1FF] px-3 font-sans text-sm font-bold text-[#0A1D2B]" />
        </label> : null}
        <label className="flex items-start gap-2 font-sans text-xs font-bold leading-5 text-[#E6F9FF]">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
          <span>Send me the forecast for this break and Quiver updates. Unsubscribe any time.</span>
        </label>
        {status === "validation-error" ? <p className="font-sans text-sm font-bold text-[#FFD447]" role="alert">Add an email or mobile number and check consent to try again.</p> : null}
        {status === "server-error" ? <p className="font-sans text-sm font-bold text-[#FFD447]" role="alert">Couldn&apos;t save that. Try again in a moment.</p> : null}
        <Button type="submit" disabled={pending} className="rounded-none border-2 border-[#FFD447] bg-[#127CC1] text-[8px] uppercase text-[#F8FEFF] hover:bg-[#0B5FA5]">{pending ? "Sending..." : "Get the real forecast"}</Button>
      </form>
    </section>
  );
}
