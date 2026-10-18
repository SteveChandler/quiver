"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ZineSurface } from "@/components/zine";
import { useSessionWaves } from "@/hooks/use-session-waves";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";
import { COUNT_MIN_CONFIDENCE } from "@/lib/sessions/wave-detection/constants";
import type { WavesSummary } from "@/lib/sessions/waves/waves-summary";
import { SpeedTimeline } from "./speed-timeline";

const SessionRideMap = dynamic(
  () => import("./session-ride-map").then((module) => ({ default: module.SessionRideMap })),
  { ssr: false },
);

interface SessionWavesSectionProps {
  sessionId: string;
  onRecordedWith?: (recordedWith: string | null) => void;
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

export function SessionWavesSection({ sessionId, onRecordedWith }: SessionWavesSectionProps) {
  const { data } = useSessionWaves(sessionId);
  const { track } = useTrackEvent();
  const trackedRef = useRef(false);
  const [local, setLocal] = useState<{ sessionId: string; response: SessionWavesResponse } | null>(null);
  const [draftCount, setDraftCount] = useState<string | null>(null);
  const [savingWaveId, setSavingWaveId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const response = local?.sessionId === sessionId ? local.response : data;

  const waveOrdinals = useMemo(() => {
    const ordinals = new Map<string, number>();
    for (const wave of response?.waves ?? []) {
      if (wave.counted && !wave.excluded) ordinals.set(wave.id, ordinals.size + 1);
    }
    return ordinals;
  }, [response?.waves]);

  useEffect(() => {
    if (!data || trackedRef.current) return;
    trackedRef.current = true;
    void track("session_waves_viewed", { metadata: { session_id: sessionId } });
  }, [data, sessionId, track]);

  useEffect(() => {
    if (!response) return;
    onRecordedWith?.(response.summary.recordedWith ?? null);
  }, [response, onRecordedWith]);

  if (!response) return null;

  const { summary, waves } = response;
  const countValue = draftCount ?? (summary.userWaveCount?.toString() ?? "");
  const paddleDistanceMi = summary.paddleDistanceM == null ? null : summary.paddleDistanceM / 1609.344;

  async function toggleWave(waveId: string, excluded: boolean): Promise<void> {
    if (!response) return;
    setSaveError(null);
    setSavingWaveId(waveId);
    try {
      const nextSummary = await patchSummary(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/waves/${encodeURIComponent(waveId)}`,
        { excluded: !excluded },
      );
      setLocal((previous) => {
        const latest = previous?.sessionId === sessionId ? previous.response : response;
        return {
          sessionId,
          response: {
            ...latest,
            summary: nextSummary,
            waves: latest.waves.map((wave) => wave.id === waveId ? { ...wave, excluded: !excluded, counted: excluded && wave.confidence >= COUNT_MIN_CONFIDENCE } : wave),
          },
        };
      });
    } catch (error) {
      console.warn("Unable to update session wave:", error);
      setSaveError("Couldn't save. Try again.");
    } finally {
      setSavingWaveId(null);
    }
  }

  async function saveCount(): Promise<void> {
    if (!response || draftCount === null || savingCount) return;
    const trimmed = draftCount.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 200)) {
      setDraftCount(null);
      setSaveError("Enter a whole number from 0 to 200.");
      return;
    }
    setSaveError(null);
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
      setLocal((previous) => ({
        sessionId,
        response: {
          ...(previous?.sessionId === sessionId ? previous.response : response),
          summary: nextSummary,
        },
      }));
      setDraftCount(null);
    } catch (error) {
      console.warn("Unable to save session wave count:", error);
      setDraftCount(null);
      setSaveError("Couldn't save. Try again.");
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
        {paddleDistanceMi != null && paddleDistanceMi >= 0.1 && (
          <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
            <p className="text-sm text-ink/70">Paddling</p>
            <p className="font-mono text-lg font-bold text-ink">About {paddleDistanceMi.toFixed(1)} mi paddled</p>
          </div>
        )}
        {summary.heartRateAvg != null && summary.heartRateMax != null && (
          <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
            <p className="text-sm text-ink/70">Heart rate</p>
            <p className="font-mono text-lg font-bold text-ink">♥ avg {summary.heartRateAvg} · max {summary.heartRateMax}</p>
          </div>
        )}
        {summary.setIntervalMin != null && (
          <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
            <p className="text-sm text-ink/70">Set rhythm</p>
            <p className="font-mono text-lg font-bold text-ink">Sets about every {summary.setIntervalMin} min</p>
          </div>
        )}
        {summary.recordedWith != null && (
          <div className="rounded-lg border border-ink/20 bg-white/60 p-4">
            <p className="text-sm text-ink/70">Recorded with</p>
            <p className="font-mono text-lg font-bold text-ink">{summary.recordedWith}</p>
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
              <div className={wave.counted ? "text-ink" : "text-ink/60"}>
                <p className="font-semibold">{wave.counted ? `Wave ${waveOrdinals.get(wave.id)}` : wave.excluded && wave.confidence >= COUNT_MIN_CONFIDENCE ? "Excluded wave" : "Maybe a wave"} · {new Date(wave.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-sm">
                  {Math.round(wave.durationS)} s · {Math.round(wave.distanceM)} m
                  {summary.speedReliable && wave.maxSpeedMps !== null && ` · ${formatSpeed(wave.maxSpeedMps)}`}
                  {wave.tideFt !== null && ` · ${wave.tideFt.toFixed(1)} ft`}
                </p>
              </div>
              {(wave.counted || (wave.excluded && wave.confidence >= COUNT_MIN_CONFIDENCE)) && <button
                type="button"
                disabled={savingWaveId !== null}
                onClick={() => void toggleWave(wave.id, wave.excluded)}
                className="rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold text-ink hover:bg-q-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
              >
                {wave.excluded ? "Undo" : "Not a wave"}
              </button>}
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
          onChange={(event) => {
            setDraftCount(event.target.value);
            setSaveError(null);
          }}
          onBlur={() => void saveCount()}
          className="w-24 rounded-lg border-2 border-ink bg-white px-3 py-2 font-mono text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </div>
      <p aria-live="polite" className="text-sm text-ink">{saveError}</p>
    </ZineSurface>
  );
}
