"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Waves } from "lucide-react";

import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { TideStatusStrip } from "@/components/beach-detail/tide-status-strip";
import {
  WaterQualityBadge,
  type WaterQuality,
} from "@/components/beach-detail/water-quality-badge";
import { WaterTempSummaryHero } from "@/components/beach-detail/water-temp-summary-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WindCompass } from "@/components/tools/wind-compass";
import { useAuth } from "@/context/auth-context";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { DynamicTideResult, TideExtreme } from "@/hooks/use-dynamic-tide";
import {
  buildBfrWebEventMetadata,
  type BfrWebEventMetadataMap,
} from "@/lib/analytics/event-taxonomy";
import {
  persistMyCoastViewRecords,
  readLocalBeachFollowState,
  readLocalBeachIntentEvidence,
  readMyCoastViewRecords,
  type LocalBeachIntentEvidence,
  type LocalBeachFollowSnapshot,
  type MyCoastViewRecord,
  type MyCoastViewRecords,
} from "@/lib/beach-follow/local-storage";
import { qualifyBeachIntent, type ExplicitBeachIntent, type IntentSignals } from "@/lib/beach-follow/intent";
import {
  MY_COAST_FOLLOW_LIMIT,
  type MyCoastBatch,
  type MyCoastBeachData,
} from "@/lib/beach-follow/my-coast-loader";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { getWetsuitRecommendation, parseWaterTempF } from "@/lib/utils/wetsuit-utils";
import { FollowTopic, type FollowedBeach } from "@/types/beach-follow";

const FORECAST_STALE_MS = 6 * 60 * 60 * 1000;
const systemNow = () => new Date();

interface MyCoastClientProps {
  initialSnapshot?: LocalBeachFollowSnapshot;
  initialData?: MyCoastBatch;
  explicitChoice?: ExplicitBeachIntent | null;
  intentSignals?: IntentSignals;
  previousViews?: MyCoastViewRecords;
  now?: () => Date;
}

function emptySnapshot(): LocalBeachFollowSnapshot {
  return {
    state: {
      version: 3,
      follows: [],
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: null,
    },
    status: "unavailable",
    persisted: false,
  };
}

function numericValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isForecastStale(updatedAt: string, now: Date): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  return !Number.isFinite(updatedAtMs)
    || now.getTime() - updatedAtMs > FORECAST_STALE_MS;
}

function tideResult(
  beach: MyCoastBeachData,
  now: Date,
): DynamicTideResult | null {
  const forecast = beach.forecast;
  if (!forecast?.tideStatus) return null;
  const normalizedStatus = forecast.tideStatus.toLowerCase();
  const currentDirection = normalizedStatus.includes("rising")
    ? "rising"
    : normalizedStatus.includes("falling")
      ? "falling"
      : normalizedStatus.includes("slack")
        ? "slack"
        : null;
  if (!currentDirection) return null;

  const nextTideAtMs = forecast.nextTideAt
    ? Date.parse(forecast.nextTideAt)
    : Number.NaN;
  const nextTideType: "high" | "low" | null = forecast.nextTideType?.toLowerCase() === "high"
    ? "high"
    : forecast.nextTideType?.toLowerCase() === "low"
      ? "low"
      : null;
  const height = numericValue(forecast.nextTideHeight);
  const nextTide: TideExtreme | null = Number.isFinite(nextTideAtMs)
    && nextTideAtMs > now.getTime()
    && nextTideType
    && height !== null
    ? { time: nextTideAtMs / 1000, height, type: nextTideType }
    : null;
  const minutesUntil = nextTide
    ? Math.max(0, Math.round((nextTideAtMs - now.getTime()) / 60_000))
    : null;

  return {
    nextTide,
    minutesUntil,
    nextHigh: nextTide?.type === "high" ? nextTide : null,
    nextLow: nextTide?.type === "low" ? nextTide : null,
    minutesToHigh: nextTide?.type === "high" ? minutesUntil : null,
    minutesToLow: nextTide?.type === "low" ? minutesUntil : null,
    usingFallback: false,
    currentDirection,
    minutesToDirectionChange: minutesUntil,
  };
}

function toWaterQuality(beach: MyCoastBeachData): WaterQuality | null {
  const waterQuality = beach.waterQuality;
  return waterQuality ? {
    beach_id: waterQuality.beachId,
    status: waterQuality.status,
    latest_enterococcus: waterQuality.latestEnterococcus,
    latest_fecal_coliform: waterQuality.latestFecalColiform,
    latest_sample_date: waterQuality.latestSampleDate,
    exceedance_count_30d: waterQuality.exceedanceCount30d,
    total_samples_30d: waterQuality.totalSamples30d,
    status_reason: waterQuality.statusReason,
    status_changed_at: waterQuality.statusChangedAt,
  } : null;
}

function currentViewRecord(
  beach: MyCoastBeachData,
  recordedAt: string,
): MyCoastViewRecord {
  return {
    recordedAt,
    forecastUpdatedAt: beach.forecast?.updatedAt ?? null,
    waterTempF: parseWaterTempF(beach.forecast?.waterTemp) ?? null,
    tideStatus: beach.forecast?.tideStatus ?? null,
    windSpeedMph: numericValue(beach.forecast?.windSpeed ?? null),
    windDirection: beach.forecast?.windDirection ?? null,
    waveHeightFt: numericValue(beach.forecast?.waveHeight ?? null),
    waterQualityStatus: beach.waterQuality?.status ?? null,
  };
}

function followsGeneralTopic(
  follow: FollowedBeach,
  topic: FollowTopic,
): boolean {
  const hasGeneralTopic = follow.topics.some(
    (followTopic) => followTopic !== FollowTopic.Surf,
  );
  return (
    follow.topics.includes(topic)
    || follow.topics.includes(FollowTopic.General)
    || !hasGeneralTopic
  );
}

function changesSincePriorView(
  beach: MyCoastBeachData,
  follow: FollowedBeach,
  previous: MyCoastViewRecord | undefined,
  surfQualified: boolean,
  now: Date,
): string[] {
  if (!previous) return ["First recorded view — changes will appear next time."];
  const current = currentViewRecord(beach, now.toISOString());
  const wants = (topic: FollowTopic) => followsGeneralTopic(follow, topic);
  const changes: string[] = [];
  const forecastIsComparable = Boolean(
    beach.forecast
    && !isForecastStale(beach.forecast.updatedAt, now)
    && current.forecastUpdatedAt
    && previous.forecastUpdatedAt
    && Date.parse(current.forecastUpdatedAt) > Date.parse(previous.forecastUpdatedAt)
  );

  if (forecastIsComparable && wants(FollowTopic.WaterTemp)) {
    const delta = current.waterTempF !== null && previous.waterTempF !== null
      ? Math.round(current.waterTempF - previous.waterTempF)
      : 0;
    if (delta !== 0) {
      changes.push(`Water temperature is ${Math.abs(delta)}°F ${delta > 0 ? "warmer" : "cooler"}.`);
    }
  }
  if (
    forecastIsComparable
    && wants(FollowTopic.Tide)
    && current.tideStatus
    && previous.tideStatus
    && current.tideStatus !== previous.tideStatus
  ) {
    changes.push(`Forecast tide label changed from ${previous.tideStatus.toLowerCase()} to ${current.tideStatus.toLowerCase()}.`);
  }
  if (forecastIsComparable && wants(FollowTopic.Wind)) {
    const speedChanged = current.windSpeedMph !== null
      && previous.windSpeedMph !== null
      && Math.abs(current.windSpeedMph - previous.windSpeedMph) >= 1;
    const directionChanged = Boolean(
      current.windDirection
      && previous.windDirection
      && current.windDirection !== previous.windDirection
    );
    if (speedChanged || directionChanged) changes.push("Forecast wind reading changed.");
  }
  if (
    forecastIsComparable
    && surfQualified
    && wants(FollowTopic.Surf)
    && current.waveHeightFt !== null
    && previous.waveHeightFt !== null
    && Math.abs(current.waveHeightFt - previous.waveHeightFt) >= 0.5
  ) {
    changes.push("Forecast wave height changed since your last view.");
  }
  if (
    wants(FollowTopic.WaterQuality)
    && current.waterQualityStatus
    && previous.waterQualityStatus
    && current.waterQualityStatus !== previous.waterQualityStatus
  ) {
    changes.push(`Water quality status changed to ${current.waterQualityStatus}.`);
  }

  if (beach.forecast && isForecastStale(beach.forecast.updatedAt, now)) {
    return ["No defensible change yet — the current forecast is stale."];
  }
  return changes.length > 0 ? changes : ["No supported change since your last view."];
}

async function loadMyCoast(beachIds: string[]): Promise<MyCoastBatch> {
  const response = await fetch(
    `/api/my-coast?beachIds=${encodeURIComponent(beachIds.join(","))}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("My Coast is temporarily unavailable");
  const body = await response.json() as { data?: MyCoastBatch };
  if (!body.data) throw new Error("My Coast returned no data");
  return body.data;
}

function myCoastAnalyticsMetadata(
  assignment: NonNullable<LocalBeachFollowSnapshot["state"]["bfrHoldoutAssignment"]>,
  audienceClass: "general_utility" | "surf_qualified" | "existing_web_user",
  qualification: ReturnType<typeof qualifyBeachIntent>,
): BfrWebEventMetadataMap["my_coast_viewed"] {
  const base = {
    audience_class: audienceClass,
    page_type: "my_coast" as const,
    experiment_key: assignment.experimentKey,
    experiment_arm: assignment.arm,
  };
  if (qualification.state === "explicit") {
    return {
      ...base,
      intent_state: "explicit",
      intent_reason: qualification.reason === "explicit_surfing"
        ? "explicit_surfing"
        : "explicit_non_surf",
    };
  }
  if (qualification.state === "inferred") {
    return {
      ...base,
      intent_state: "inferred",
      intent_reason: qualification.reason === "multiple_surf_signals"
        ? "multiple_surf_signals"
        : "high_intent_action",
    };
  }
  return {
    ...base,
    intent_state: "unknown",
    intent_reason: qualification.reason === "insufficient_surf_signals"
      ? "insufficient_surf_signals"
      : qualification.reason === "utility_only"
        ? "utility_only"
        : "no_evidence",
  };
}

export function MyCoastClient({
  initialSnapshot,
  initialData,
  explicitChoice,
  intentSignals,
  previousViews,
  now = systemNow,
}: MyCoastClientProps) {
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const [snapshot, setSnapshot] = useState(
    initialSnapshot ?? emptySnapshot(),
  );
  const [hydrated, setHydrated] = useState(Boolean(initialSnapshot));
  const [data, setData] = useState<MyCoastBatch | null>(initialData ?? null);
  const [loadError, setLoadError] = useState("");
  const [showSync, setShowSync] = useState(false);
  const trackedView = useRef(false);
  const [priorViews, setPriorViews] = useState<MyCoastViewRecords>(
    previousViews ?? {},
  );
  const [storedIntent, setStoredIntent] = useState<LocalBeachIntentEvidence>({
    explicitChoice: null,
    signals: { utilityPageViewCount: 0, surfSpecificSignalCount: 0 },
  });

  useEffect(() => {
    if (!initialSnapshot) setSnapshot(readLocalBeachFollowState());
    if (previousViews === undefined) setPriorViews(readMyCoastViewRecords());
    if (explicitChoice === undefined || intentSignals === undefined) {
      setStoredIntent(readLocalBeachIntentEvidence());
    }
    setHydrated(true);
  }, [explicitChoice, initialSnapshot, intentSignals, previousViews]);

  const followedIds = useMemo(
    () => snapshot.state.follows
      .map((follow) => follow.beachId)
      .slice(0, MY_COAST_FOLLOW_LIMIT),
    [snapshot.state.follows],
  );

  useEffect(() => {
    if (!hydrated || initialData || followedIds.length === 0) return;
    let active = true;
    loadMyCoast(followedIds)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setLoadError("My Coast data is temporarily unavailable.");
      });
    return () => {
      active = false;
    };
  }, [followedIds, hydrated, initialData]);

  const qualification = useMemo(() => qualifyBeachIntent(
    explicitChoice === undefined ? storedIntent.explicitChoice : explicitChoice,
    intentSignals ?? storedIntent.signals,
  ), [explicitChoice, intentSignals, storedIntent]);
  const surfQualified = qualification.intent === "surfing"
    && (qualification.state === "explicit" || qualification.state === "inferred");
  const analyticsMetadata = useMemo<
    BfrWebEventMetadataMap["my_coast_viewed"] | null
  >(() => {
    const assignment = snapshot.state.bfrHoldoutAssignment;
    if (!assignment) return null;
    const audienceClass = surfQualified
      ? "surf_qualified" as const
      : user
        ? "existing_web_user" as const
        : "general_utility" as const;
    return myCoastAnalyticsMetadata(assignment, audienceClass, qualification);
  }, [qualification, snapshot.state.bfrHoldoutAssignment, surfQualified, user]);

  const safelyTrack = useCallback((
    eventType: "my_coast_viewed" | "my_coast_beach_opened",
    beachId?: string,
    topic?: FollowTopic,
  ) => {
    if (!analyticsMetadata) return;
    const metadata = eventType === "my_coast_beach_opened"
      ? buildBfrWebEventMetadata(
          { ...analyticsMetadata, topic: topic ?? FollowTopic.General },
          "my_coast_beach_opened",
        )
      : buildBfrWebEventMetadata(analyticsMetadata, "my_coast_viewed");
    if (!metadata) return;
    try {
      void Promise.resolve(track(eventType, { beachId, metadata, debounceMs: 0 }))
        .catch(() => undefined);
    } catch {
      return;
    }
  }, [analyticsMetadata, track]);

  useEffect(() => {
    if (!hydrated || !analyticsMetadata || trackedView.current) return;
    trackedView.current = true;
    safelyTrack("my_coast_viewed");
  }, [analyticsMetadata, hydrated, safelyTrack]);

  useEffect(() => {
    if (!data) return;
    const recordedAt = now().toISOString();
    const nextRecords = { ...readMyCoastViewRecords() };
    for (const beach of data.beaches) {
      nextRecords[beach.id] = currentViewRecord(beach, recordedAt);
    }
    persistMyCoastViewRecords(nextRecords);
  }, [data, now]);

  if (!hydrated) {
    return <p className="mx-auto max-w-3xl px-4 py-16">Loading My Coast…</p>;
  }

  if (snapshot.state.follows.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#0B3A75]">My Coast</p>
        <h1 className="mt-2 font-heading text-4xl font-black text-[#11100D]">Follow a beach to build your coast.</h1>
        <p className="mt-4 max-w-xl text-[#5F5646]">
          Keep the water, tide, wind, and beach updates you care about in one place. Following works without an account.
        </p>
        <Button asChild className="mt-7 rounded-full bg-[#0B3A75] text-white">
          <Link href="/map">Discover beaches</Link>
        </Button>
      </main>
    );
  }

  const followByBeach = new Map(
    snapshot.state.follows.map((follow) => [follow.beachId, follow]),
  );
  const currentTime = now();
  const surfRows = (data?.beaches ?? [])
    .flatMap((beach) => {
      const waveHeight = numericValue(beach.forecast?.waveHeight ?? null);
      return waveHeight !== null
        && beach.forecast
        && !isForecastStale(beach.forecast.updatedAt, currentTime)
        ? [{ beach, waveHeight }]
        : [];
    })
    .sort((left, right) => right.waveHeight - left.waveHeight);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#0B3A75]">My Coast</p>
        <h1 className="mt-2 font-heading text-4xl font-black text-[#11100D] sm:text-5xl">What changed at your beaches</h1>
        <p className="mt-3 max-w-2xl text-[#5F5646]">
          Current readings and source-backed changes for the coastal topics you follow.
        </p>
        {user ? (
          <p className="mt-4 text-sm text-[#5F5646]">
            Signed in. Local changes stay safe until sync confirms.
          </p>
        ) : (
          <div className="mt-5 rounded-xl border-2 border-[#0B3A75] bg-[#E8EEF7] p-4">
            <p className="font-semibold text-[#11100D]">Saved on this device. Keep using My Coast without signing in.</p>
            <Button className="mt-3 rounded-full" onClick={() => setShowSync(true)} variant="outline">
              Sync beaches, topics, and My Coast across devices
            </Button>
          </div>
        )}
      </header>

      {snapshot.state.follows.length > MY_COAST_FOLLOW_LIMIT && (
        <p className="mt-6 text-sm text-[#5F5646]">
          Showing the first {MY_COAST_FOLLOW_LIMIT} followed beaches for this release.
        </p>
      )}

      {loadError && (
        <Card className="mt-8 border-2 border-[#11100D]">
          <CardContent className="p-5">
            <p>{loadError} Your follows are still saved.</p>
            <Link className="mt-3 inline-block underline" href="/map">Open beach discovery</Link>
          </CardContent>
        </Card>
      )}

      {!data && !loadError && <p className="mt-10">Loading followed-beach updates…</p>}

      {surfQualified && data && (
        <section aria-labelledby="surf-comparison" className="mt-10">
          <h2 id="surf-comparison" className="font-heading text-2xl font-black text-[#11100D]">Surf comparison</h2>
          <p className="mt-1 text-sm text-[#5F5646]">Fresh forecast wave heights only — not a quality or safety ranking.</p>
          {surfRows.length > 0 ? (
            <ol className="mt-4 grid gap-2">
              {surfRows.map(({ beach, waveHeight }) => (
                <li key={beach.id} className="flex items-center gap-2 rounded-lg border border-[#68809F] bg-[#E8EEF7] px-4 py-3">
                  <Waves className="h-4 w-4" aria-hidden="true" />
                  <span className="font-semibold">{beach.name}</span>
                  <span>{waveHeight} ft forecast</span>
                  {beach.forecast?.dataSource && <span className="text-xs text-[#5F5646]">{beach.forecast.dataSource}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3">No fresh surf comparison is available.</p>
          )}
        </section>
      )}

      {data && (
        <section aria-label="Followed beaches" className="mt-10 grid gap-7">
          {data.beaches.map((beach) => {
            const follow = followByBeach.get(beach.id);
            if (!follow) return null;
            const wants = (topic: FollowTopic) => followsGeneralTopic(follow, topic);
            const beachUrl = getBeachUrlSafe(beach) ?? "/map";
            const waterTempF = parseWaterTempF(beach.forecast?.waterTemp);
            const dynamicTide = tideResult(beach, currentTime);
            const windSpeed = numericValue(beach.forecast?.windSpeed ?? null);
            const forecastStale = beach.forecast
              ? isForecastStale(beach.forecast.updatedAt, currentTime)
              : false;
            const changes = changesSincePriorView(
              beach,
              follow,
              priorViews[beach.id],
              surfQualified,
              currentTime,
            );

            return (
              <Card key={beach.id} className="overflow-hidden border-2 border-[#11100D] bg-[#F4EBD8] shadow-[4px_4px_0_#11100D]">
                <CardHeader className="border-b-2 border-[#11100D]">
                  <CardTitle className="font-heading text-2xl font-black text-[#11100D]">{beach.name}</CardTitle>
                  <p className="text-sm text-[#5F5646]">{[beach.city, beach.state].filter(Boolean).join(", ")}</p>
                  {beach.forecast && (
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#5F5646]">
                      {forecastStale ? "Forecast is stale — verify before going" : `Forecast updated ${new Date(beach.forecast.updatedAt).toLocaleString()}`}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="grid gap-5 p-5 sm:p-6">
                  <section aria-label={`Changes at ${beach.name}`}>
                    <h3 className="font-heading text-lg font-black text-[#11100D]">Since your last view</h3>
                    <ul className="mt-2 grid gap-1 text-sm text-[#5F5646]">
                      {changes.map((change) => <li key={change}>{change}</li>)}
                    </ul>
                  </section>

                  {wants(FollowTopic.WaterTemp) && waterTempF !== null && (
                    <WaterTempSummaryHero
                      beachName={beach.name}
                      seasonalTrendsHref={`${beachUrl}/water-temp`}
                      seasonalTrendsLocation={beach.city ?? beach.name}
                      waterTempData={{
                        tempF: Math.round(waterTempF),
                        wetsuitRec: getWetsuitRecommendation(waterTempF).thickness,
                      }}
                    />
                  )}
                  {wants(FollowTopic.Tide) && dynamicTide && (
                    <TideStatusStrip dynamicTide={dynamicTide} />
                  )}
                  {wants(FollowTopic.Wind) && windSpeed !== null && beach.forecast?.windDirectionDeg !== null && beach.forecast?.windDirectionDeg !== undefined && (
                    <div className="max-w-[150px]">
                      <WindCompass
                        offshoreDeg={beach.windOffshoreDeg}
                        size={140}
                        toleranceDeg={beach.windOffshoreToleranceDeg}
                        windCardinal={beach.forecast.windDirection ?? "Unknown"}
                        windDirectionDeg={beach.forecast.windDirectionDeg}
                        windSpeedMph={windSpeed}
                      />
                    </div>
                  )}
                  {beach.unavailableSources.includes("forecast") && (
                    wants(FollowTopic.WaterTemp)
                    || wants(FollowTopic.Tide)
                    || wants(FollowTopic.Wind)
                  ) && (
                    <p>Forecast topics are unavailable right now; this beach and any water-quality report remain available.</p>
                  )}
                  {wants(FollowTopic.WaterQuality) && (
                    beach.unavailableSources.includes("water_quality")
                      ? <p>Water quality is unavailable right now; other beach updates retain their own freshness labels.</p>
                      : beach.waterQuality
                        ? <WaterQualityBadge beachState={beach.state} waterQuality={toWaterQuality(beach)} />
                        : <p>No current water quality report is available.</p>
                  )}

                  <Link
                    aria-label={`Open ${beach.name}`}
                    className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#0B3A75] underline underline-offset-4"
                    href={beachUrl}
                    onClick={() => safelyTrack(
                      "my_coast_beach_opened",
                      beach.id,
                      follow.topics[0],
                    )}
                  >
                    Open {beach.name}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <UnifiedAuthModal
        contextMessage={{
          title: "Sync My Coast",
          description: "Sync beaches, topics, and My Coast across devices.",
        }}
        isOpen={showSync}
        mode="signup"
        onClose={() => setShowSync(false)}
        source="my-coast-sync"
      />
    </main>
  );
}
