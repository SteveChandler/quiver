"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { ZineSurface } from "@/components/zine";
import { Button } from "@/components/ui/button";

type LinkState = "confirm" | "linked" | "expired" | "entry" | "unavailable" | "error";

interface GarminLinkConfirmProps {
  initialCode: string | null;
  onLinked?: () => void;
  headingLevel?: 1 | 2 | 3;
}

export function GarminLinkConfirm({ initialCode, onLinked, headingLevel = 1 }: GarminLinkConfirmProps): ReactElement {
  const sanitizedInitialCode = (initialCode ?? "").replace(/\D/g, "").slice(0, 6);
  const [code, setCode] = useState(sanitizedInitialCode);
  const [state, setState] = useState<LinkState>(sanitizedInitialCode.length === 6 ? "confirm" : "entry");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const Heading = headingLevel === 3 ? "h3" : headingLevel === 2 ? "h2" : "h1";

  async function confirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setState("entry");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/v1/garmin/link-codes/${code}/confirm`, { method: "POST", cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.status === 404 || response.status === 409) {
        setState(response.status === 404 && result?.error === "unavailable" ? "unavailable" : "expired");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (result?.success !== true || result.data?.linked !== true || typeof result.data?.deviceName !== "string") {
        throw new Error("Invalid link confirmation");
      }
      setDeviceName(result.data.deviceName);
      if (onLinked) {
        setCode("");
        setState("entry");
        onLinked();
      } else {
        setState("linked");
      }
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ZineSurface sectionLabel="Garmin watch" paperClassName="space-y-5 p-5 md:p-7">
      {state === "linked" ? (
        <div className="space-y-3" role="status">
          <Heading className="font-heading text-2xl font-bold text-ink">Watch linked</Heading>
          <p className="text-ink">{deviceName} is linked to your Quiver account.</p>
          <Link href="/profile?tab=surf-profile" className="font-semibold text-ink underline">View Garmin settings</Link>
        </div>
      ) : (
        <form onSubmit={(event) => void confirm(event)} className="space-y-4">
          <Heading className="font-heading text-2xl font-bold text-ink">Link this Garmin watch?</Heading>
          {deviceName && <p role="status" className="text-sm text-ink">{deviceName} is linked to your Quiver account.</p>}
          <label htmlFor="garmin-link-code" className="block font-semibold text-ink">Six-digit watch code</label>
          <input
            id="garmin-link-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-describedby={code.length !== 6 ? "garmin-link-code-hint" : undefined}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setState("entry");
            }}
            className="w-full max-w-48 rounded-lg border-2 border-ink bg-white px-3 py-2 font-mono text-ink"
          />
          {code.length !== 6 && <p id="garmin-link-code-hint" className="text-sm text-ink/70">Enter the six-digit code shown on your watch.</p>}
          <div><Button type="submit" disabled={busy || !/^\d{6}$/.test(code)}>{busy ? "Linking…" : "Link watch"}</Button></div>
          {state === "expired" && <p role="alert" className="text-sm text-ink">That code expired. Start again on your watch.</p>}
          {state === "unavailable" && <p role="alert" className="text-sm text-ink">Garmin watches aren&apos;t available yet</p>}
          {state === "error" && <p role="alert" className="text-sm text-ink">Couldn&apos;t link this watch. Try again.</p>}
        </form>
      )}
    </ZineSurface>
  );
}
