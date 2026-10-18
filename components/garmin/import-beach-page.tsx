"use client";

import { useCallback, useState, type ReactElement } from "react";
import Link from "next/link";
import { ZineSurface } from "@/components/zine";
import { ImportBeachPicker } from "@/components/sessions/import/import-beach-picker";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { ImportBeach } from "@/lib/sessions/imports/resolve-import-beach";
import { importErrorCopy } from "./import-error-copy";

type SessionImport = {
  id: string;
  status: "uploaded" | "needs_beach" | "completed" | "failed";
  origin: "file" | "garmin_watch";
  startedAt: string | null;
  candidates: ImportBeach[];
  sessionId: string | null;
  reason?: string | null;
};

interface ImportBeachPageProps { importId: string }

export function ImportBeachPage({ importId }: ImportBeachPageProps): ReactElement {
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async (): Promise<SessionImport> => {
    const response = await fetch(`/api/v1/session-imports/${encodeURIComponent(importId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result?.success !== true || !result.data) throw new Error("Invalid import response");
    const imported = result.data as SessionImport;
    if (imported.status !== "failed" || imported.reason) return imported;
    try {
      const devicesResponse = await fetch("/api/v1/watch/devices", { cache: "no-store" });
      if (!devicesResponse.ok) return imported;
      const devices = await devicesResponse.json();
      const problems = devices?.success === true && Array.isArray(devices.data?.problems)
        ? devices.data.problems as Array<{ importId: string; reason: string | null }>
        : [];
      const reason = problems.find((problem) => problem.importId === importId)?.reason;
      return { ...imported, reason: reason ?? null };
    } catch {
      return imported;
    }
  }, [importId]);
  const { data, loading, error, refetch } = useDataFetcher(load);

  async function chooseBeach(beachId: string): Promise<void> {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/v1/session-imports/${encodeURIComponent(importId)}/beach`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beachId }), cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (response.status === 409) {
        if (result?.error === "duplicate" && typeof result.details?.sessionId === "string" && result.details.sessionId) {
          setCompletedSessionId(result.details.sessionId);
          return;
        }
        await refetch();
        return;
      }
      if (response.status === 422) {
        await refetch();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (result?.success !== true) throw new Error("Invalid beach response");
      if (result.data?.status === "completed" && typeof result.data.sessionId === "string") {
        setCompletedSessionId(result.data.sessionId);
      } else {
        await refetch();
      }
    } catch {
      setSaveError("Couldn't save this beach. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const sessionId = completedSessionId ?? data?.sessionId;
  const startedAt = data?.startedAt ? new Date(data.startedAt) : null;
  const dateLabel = startedAt && !Number.isNaN(startedAt.getTime())
    ? startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "recent";

  return (
    <ZineSurface sectionLabel="Surf import" paperClassName="space-y-5 p-5 md:p-7">
      {loading && !data && <p role="status" className="text-ink">Loading your surf…</p>}
      {error && !data && <p role="alert" className="text-ink">Couldn&apos;t load this surf. Try again later.</p>}
      {sessionId && <div className="space-y-3"><h1 className="font-heading text-2xl font-bold text-ink">Your surf is ready</h1><Link href={`/sessions/${encodeURIComponent(sessionId)}`} className="font-semibold text-ink underline">View session</Link></div>}
      {data?.status === "needs_beach" && !sessionId && <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-ink">Pick the beach for your {dateLabel} surf</h1>
        <ImportBeachPicker candidates={data.candidates} onChoose={chooseBeach} />
        {saving && <p role="status" className="text-sm text-ink">Saving beach…</p>}
        {saveError && <p role="alert" className="text-sm text-ink">{saveError}</p>}
      </div>}
      {data?.status === "failed" && !sessionId && <p role="alert" className="text-ink">{importErrorCopy(data.reason)}</p>}
      {data?.status === "uploaded" && <p role="status" className="text-ink">This surf is still being processed.</p>}
    </ZineSurface>
  );
}
