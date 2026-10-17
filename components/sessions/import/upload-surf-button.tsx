"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImportBeachPicker } from "./import-beach-picker";
import { useSessionImport } from "@/hooks/use-session-import";

type UploadSurfButtonProps = { enabled: boolean };

function doneCopy(attached: boolean, waveCount: number, beachName?: string, arrivalTime?: string): string {
  const waves = `${waveCount} ${waveCount === 1 ? "wave" : "waves"}`;
  if (attached && beachName && arrivalTime) {
    const date = new Date(arrivalTime);
    if (!Number.isNaN(date.getTime())) {
      const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `Added ${waves} to your ${label} session at ${beachName}`;
    }
  }
  if (attached) return `Added ${waves} to your session${beachName ? ` at ${beachName}` : ""}`;
  if (beachName) return `New session at ${beachName}: ${waves}`;
  return `Imported ${waves}`;
}

export function UploadSurfButton({ enabled }: UploadSurfButtonProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const navigatedSessionRef = useRef<string | null>(null);
  const router = useRouter();
  const { start, state, chooseBeach } = useSessionImport();

  useEffect(() => {
    if (state.phase !== "done" || !state.sessionId) return;
    if (navigatedSessionRef.current === state.sessionId) return;
    navigatedSessionRef.current = state.sessionId;
    toast.success(doneCopy(Boolean(state.attached), state.waveCount ?? 0, state.beachName, state.arrivalTime));
    router.push(`/sessions/${encodeURIComponent(state.sessionId)}`);
  }, [router, state]);

  if (!enabled) return null;

  const busy = state.phase === "uploading" || state.phase === "processing";
  return (
    <div className="fixed bottom-44 right-4 z-50 md:bottom-28 md:right-8">
      {open ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] space-y-3 border-2 border-[#11100D] bg-[#FBF6E8] p-4 text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.35)]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em]">Import a surf</p>
          <p className="text-sm leading-relaxed text-[#11100D]/75">
            From Garmin Connect on the web: open the activity, then the gear menu › Export File.
          </p>
          <label htmlFor="surf-file" className="block text-sm font-semibold">Surf file</label>
          <input
            id="surf-file"
            type="file"
            accept=".fit,.gpx,.zip"
            disabled={busy}
            className="block w-full text-sm file:mr-3 file:border-2 file:border-[#11100D] file:bg-[#F4EBD8] file:px-3 file:py-2 file:font-semibold"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void start(file);
              event.currentTarget.value = "";
            }}
          />
          {busy ? <p role="status" className="text-sm">{state.phase === "uploading" ? "Uploading your surf..." : "Reading your surf..."}</p> : null}
          {state.phase === "needs_beach" ? (
            <ImportBeachPicker candidates={state.candidates ?? []} onChoose={chooseBeach} />
          ) : null}
          {state.error ? (
            <div role="alert" className="text-sm text-[#B91C1C]">
              <p>{state.error}</p>
              {state.duplicateSessionId ? (
                <Link className="font-semibold underline" href={`/sessions/${encodeURIComponent(state.duplicateSessionId)}`}>
                  Open the existing session
                </Link>
              ) : null}
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
      ) : null}
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full border-2 border-[#11100D] bg-[#F4EBD8] px-5 font-heading font-bold text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.35)] hover:bg-[#F0E5CC]"
      >
        <Upload className="mr-2 h-4 w-4" aria-hidden />
        Upload a surf (FIT or GPX)
      </Button>
    </div>
  );
}
