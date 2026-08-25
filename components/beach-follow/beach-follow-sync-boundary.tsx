"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/auth-context";
import { useTrackEvent } from "@/hooks/use-track-event";
import { buildBfrWebEventMetadata } from "@/lib/analytics/event-taxonomy";
import {
  LOCAL_BEACH_FOLLOW_STORAGE_KEY,
  persistLocalBeachFollowState,
  readLocalBeachFollowState,
} from "@/lib/beach-follow/local-storage";
import {
  beachFollowStateRevision,
  syncBeachFollows,
  type BeachFollowSyncPersistence,
} from "@/lib/beach-follow/sync";

interface BeachFollowSyncBoundaryProps {
  persistence?: BeachFollowSyncPersistence;
}

export function BeachFollowSyncBoundary({
  persistence,
}: BeachFollowSyncBoundaryProps) {
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const [message, setMessage] = useState("");
  const inFlightRevision = useRef<string | null>(null);
  const completedRevision = useRef<string | null>(null);

  const safelyTrack = useCallback((eventType: "beach_follow_sync_started" | "beach_follow_sync_completed") => {
    const assignment = readLocalBeachFollowState().state.bfrHoldoutAssignment;
    if (!assignment) return;
    const metadata = buildBfrWebEventMetadata({
      audience_class: "existing_web_user",
      page_type: "my_coast",
      experiment_key: assignment.experimentKey,
      experiment_arm: assignment.arm,
    }, eventType);
    if (!metadata) return;

    try {
      void Promise.resolve(track(eventType, { metadata, debounceMs: 0 }))
        .catch(() => undefined);
    } catch {
      return;
    }
  }, [track]);

  const attemptSync = useCallback(async () => {
    if (!user || !persistence) return;

    const snapshot = readLocalBeachFollowState();
    if (
      snapshot.state.follows.length === 0
      && snapshot.state.tombstones.length === 0
      && snapshot.state.topicTombstones.length === 0
    ) return;
    const revision = beachFollowStateRevision(snapshot.state);
    if (
      revision === inFlightRevision.current
      || revision === completedRevision.current
    ) return;

    inFlightRevision.current = revision;
    safelyTrack("beach_follow_sync_started");
    try {
      const result = await syncBeachFollows(snapshot, persistence, (next) => (
        persistLocalBeachFollowState(
          next.state,
          next.status === "sync_required" ? "sync_required" : "ready",
        )
      ));
      if (result.status === "no_local_changes") return;
      if (result.status === "completed") {
        completedRevision.current = revision;
        setMessage("My Coast is synced across devices.");
        safelyTrack("beach_follow_sync_completed");
        return;
      }

      setMessage("My Coast sync is pending. Your local beaches and topics are safe.");
    } catch {
      setMessage("My Coast sync is pending. Your local beaches and topics are safe.");
    } finally {
      inFlightRevision.current = null;
    }
  }, [persistence, safelyTrack, user]);

  useEffect(() => {
    void attemptSync();
    const retry = (event: StorageEvent | Event) => {
      if (event instanceof StorageEvent && event.key !== LOCAL_BEACH_FOLLOW_STORAGE_KEY) {
        return;
      }
      void attemptSync();
    };
    window.addEventListener("storage", retry);
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("storage", retry);
      window.removeEventListener("online", retry);
    };
  }, [attemptSync]);

  return message ? (
    <p aria-live="polite" className="sr-only" role="status">
      {message}
    </p>
  ) : null;
}
