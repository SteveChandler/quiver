"use client";

import { useEffect, useRef, useState } from "react";
import { ZineSurface } from "@/components/zine";
import { useSessionWaves } from "@/hooks/use-session-waves";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";
import type { WavesSummary } from "@/lib/sessions/waves/waves-summary";
import { SessionRideMap } from "./session-ride-map";
import { SpeedTimeline } from "./speed-timeline";

interface SessionWavesSectionProps {
  sessionId: string;
}

function formatSpeed(mps: number): string {
  return `${(mps * 2.23694).toFixed(1)} mph`;
}

async function patchSummary(url: string, body: object): Promise<WavesSummary> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const envelope = await response.json();
  if (envelope?.success !== true || !envelope.data?.summary) {
    throw new Error(envelope?.error || "Invalid waves response");
  }
  return envelope.data.summary as WavesSummary;
}

export function SessionWavesSection({ sessionId }: SessionWavesSectionProps) {
  const { data } = useSessionWaves(sessionId);
  const { track } = useTrackEvent();
  const trackedRef = useRef(false);
  const [local, setLocal] = useState<{ sessionId: string; response: SessionWavesResponse } | null>(null);
  const [draftCount, setDraftCount] = useState<string | null>(null);
  const [savingWaveId, setSavingWaveId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(false);
  const response = local?.sessionId === sessionId ? local.response : data;

  useEffect(() => {
    if (!data || trackedRef.current) return;
    trackedRef.current = true;
    void track("session_waves_viewed", { metadata: { session_id: sessionId } });
  }, [data, sessionId, track]);

  if (!response) return null;

  const { summary, waves } = response;
  const countValue = draftCount ?? (summary.userWaveCount?.toString() ?? "");

  async function toggleWave(waveId: string, excluded: boolean): Promise<void> {
    if (!response) return;
    setSavingWaveId(waveId);
    try {
      const nextSummary = await patchSummary(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/waves/${encodeURIComponent(waveId)}`,
        { excluded: !excluded },
      );
      setLocal({
        sessionId,
        response: {
          ...response,
          summary: nextSummary,
          waves: response.waves.map((wave) => wave.id === waveId ? { ...wave, excluded: !excluded } : wave),
        },
      });
    } catch (error) {
      console.warn("Unable to update session wave:", error);
    } finally {
      setSavingWaveId(null);
    }
  }

  async function saveCount(): Promise<void> {
    if (!response || draftCount === null || savingCount) return;
    const trimmed = draftCount.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 200)) return;
    if (value === summary.userWaveCount) {
      setDraftCount(null);
      return;
    }

    setSavingCount(true);
    try {
      const nextSummary = await patchSummary(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/waves`,
        { userWaveCount: value },
      );
      setLocal({ sessionId, response: { ...response, summary: nextSummary } });
      setDraftCount(null);
    } catch (error) {
      console.warn("Unable to save session wave count:", error);
    } finally {
      setSavingCount(false);
    }
  }

  return (
    <ZineSurface sectionLabel="Session waves" className="my-6" paperClassName="space-y-6 p-5 md:p-7">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink/60">Session waves</p>
        <h2 className="font-heading text-2xl font-bold text-ink">Your rides</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
          <p className="text-sm text-ink/70">Waves</p>
          <p className="font-mono text-2xl font-bold text-ink">{summary.waveCount}</p>
          {summary.userWaveCount !== null && summary.userWaveCount !== summary.detectedWaveCount && (
            <p className="text-sm text-ink/70">You: {summary.userWaveCount} · Quiver found {summary.detectedWaveCount}</p>
          )}
        </div>
        <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
          <p className="text-sm text-ink/70">Longest ride</p>
          <p className="font-mono text-lg font-bold text-ink">
            {summary.longestRideS === null || summary.longestRideM === null
              ? "—"
              : `${Math.round(summary.longestRideS)} s · ${Math.round(summary.longestRideM)} m`}
          </p>
        </div>
        {summary.speedReliable && (
          <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
            <p className="text-sm text-ink/70">Top speed</p>
            <p className="font-mono text-lg font-bold text-ink">{summary.topSpeedMps === null ? "—" : formatSpeed(summary.topSpeedMps)}</p>
          </div>
        )}
      </div>

      {summary.lowCoverage && (
        <p role="status" className="rounded-lg border border-ink/20 bg-white/60 p-3 text-sm text-ink">
          GPS dropped out for much of this surf, so the count may be low.
        </p>
      )}

      {response.track.coordinates.length > 0 && <SessionRideMap track={response.track} waves={waves} />}
      {summary.speedReliable && <SpeedTimeline speedSeries={response.speedSeries} waves={waves} />}

      <div>
        <h3 className="font-heading text-lg font-semibold text-ink">Rides</h3>
        <ol className="mt-3 space-y-2">
          {waves.map((wave) => (
            <li key={wave.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/20 bg-white/60 p-3">
              <div className={wave.excluded ? "text-ink/50" : "text-ink"}>
                <p className="font-semibold">Wave {wave.index} · {new Date(wave.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-sm">
                  {Math.round(wave.durationS)} s · {Math.round(wave.distanceM)} m
                  {summary.speedReliable && wave.maxSpeedMps !== null && ` · ${formatSpeed(wave.maxSpeedMps)}`}
                  {wave.tideFt !== null && ` · ${wave.tideFt.toFixed(1)} ft`}
                </p>
              </div>
              <button
                type="button"
                disabled={savingWaveId !== null}
                onClick={() => void toggleWave(wave.id, wave.excluded)}
                className="rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold text-ink hover:bg-q-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
              >
                {wave.excluded ? "Undo" : "Not a wave"}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`session-wave-count-${sessionId}`} className="font-semibold text-ink">How many did you catch?</label>
        <input
          id={`session-wave-count-${sessionId}`}
          type="number"
          min={0}
          max={200}
          step={1}
          value={countValue}
          disabled={savingCount}
          onChange={(event) => setDraftCount(event.target.value)}
          onBlur={() => void saveCount()}
          className="w-24 rounded-lg border-2 border-ink bg-white px-3 py-2 font-mono text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </div>
    </ZineSurface>
  );
}
