"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { ZineSurface } from "@/components/zine";
import { Button } from "@/components/ui/button";

type LinkState = "confirm" | "linked" | "expired" | "entry" | "unavailable" | "error";

interface GarminLinkConfirmProps {
  initialCode: string | null;
  onLinked?: () => void;
}

export function GarminLinkConfirm({ initialCode, onLinked }: GarminLinkConfirmProps): ReactElement {
  const [code, setCode] = useState(initialCode ?? "");
  const [state, setState] = useState<LinkState>(initialCode ? "confirm" : "entry");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setState("expired");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/v1/garmin/link-codes/${code}/confirm`, { method: "POST", cache: "no-store" });
      if (response.status === 404) {
        setState("unavailable");
        return;
      }
      if (response.status === 409) {
        setState("expired");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result?.success !== true || result.data?.linked !== true || typeof result.data?.deviceName !== "string") {
        throw new Error("Invalid link confirmation");
      }
      setDeviceName(result.data.deviceName);
      setState("linked");
      onLinked?.();
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
          <h2 className="font-heading text-2xl font-bold text-ink">Watch linked</h2>
          <p className="text-ink">{deviceName} is linked to your Quiver account.</p>
          <Link href="/profile?tab=surf-profile" className="font-semibold text-ink underline">View Garmin settings</Link>
        </div>
      ) : (
        <form onSubmit={(event) => void confirm(event)} className="space-y-4">
          <h1 className="font-heading text-2xl font-bold text-ink">Link this Garmin watch?</h1>
          <label htmlFor="garmin-link-code" className="block font-semibold text-ink">Six-digit watch code</label>
          <input
            id="garmin-link-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setState("entry");
            }}
            className="w-full max-w-48 rounded-lg border-2 border-ink bg-white px-3 py-2 font-mono text-ink"
          />
          <div><Button type="submit" disabled={busy || !/^\d{6}$/.test(code)}>{busy ? "Linking…" : "Link watch"}</Button></div>
          {state === "expired" && <p role="alert" className="text-sm text-ink">That code expired. Start again on your watch.</p>}
          {state === "unavailable" && <p role="alert" className="text-sm text-ink">Garmin watches aren&apos;t available yet</p>}
          {state === "error" && <p role="alert" className="text-sm text-ink">Couldn&apos;t link this watch. Try again.</p>}
        </form>
      )}
    </ZineSurface>
  );
}
