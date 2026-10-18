"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ZineSurface } from "@/components/zine";
import { Button } from "@/components/ui/button";
import { GarminLinkConfirm } from "./garmin-link-confirm";
import { useWatchDevices } from "@/hooks/use-watch-devices";

interface GarminWatchSectionProps { isOwner: boolean }

export function GarminWatchSection({ isOwner }: GarminWatchSectionProps): ReactElement | null {
  const { data, refresh } = useWatchDevices(isOwner);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  if (!isOwner || !data) return null;

  async function unlink(id: string): Promise<void> {
    setUnlinkError(null);
    try {
      const response = await fetch(`/api/v1/watch/devices/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result?.success !== true || result.data?.unlinked !== true) throw new Error("Invalid unlink response");
      setConfirmId(null);
      refresh();
    } catch {
      setUnlinkError("Couldn't unlink this watch. Try again.");
    }
  }

  return (
    <div className="space-y-4">
      <ZineSurface sectionLabel="Garmin watches" paperClassName="space-y-5 p-5 md:p-7">
        <h2 className="font-heading text-2xl font-bold text-ink">Garmin watches</h2>
        {data.devices.length === 0 && <p className="text-sm text-ink">No watches linked yet.</p>}
        <ul className="space-y-3">
          {data.devices.map((device) => <li key={device.id} className="rounded-lg border border-ink/20 bg-white/60 p-4">
            <p className="font-semibold text-ink">{device.name}</p>
            {device.partNumber && <p className="font-mono text-xs text-ink/70">{device.partNumber}</p>}
            {confirmId === device.id ? <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="w-full text-sm text-ink">Unlink this watch from your account?</p>
              <Button type="button" onClick={() => void unlink(device.id)}>Confirm unlink</Button>
              <Button type="button" variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            </div> : <Button type="button" variant="outline" className="mt-3" onClick={() => setConfirmId(device.id)}>Unlink {device.name}</Button>}
          </li>)}
        </ul>
        {unlinkError && <p role="alert" className="text-sm text-ink">{unlinkError}</p>}
        {data.problems.length > 0 && <div className="space-y-2">
          <h3 className="font-heading text-lg font-semibold text-ink">Surfs needing attention</h3>
          <ul className="space-y-2">{data.problems.map((problem) => <li key={problem.importId} className="text-sm text-ink">
            {problem.status === "needs_beach" ? <Link href={`/sessions/imports/${encodeURIComponent(problem.importId)}`} className="font-semibold underline">Pick a beach for this surf</Link> : <p>{problem.reason || "A surf couldn't be imported."}</p>}
          </li>)}</ul>
        </div>}
      </ZineSurface>
      <GarminLinkConfirm initialCode={null} onLinked={refresh} />
    </div>
  );
}
