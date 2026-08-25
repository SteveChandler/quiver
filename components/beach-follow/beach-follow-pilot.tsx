"use client";

import { useEffect, useRef, useState } from "react";

import { useTrackEvent } from "@/hooks/use-track-event";
import {
  buildBfrWebEventMetadata,
  type BfrPageType,
} from "@/lib/analytics/event-taxonomy";
import {
  ensureLocalBfrAssignment,
  readLocalBeachFollowState,
} from "@/lib/beach-follow/local-storage";
import { getVisitorId } from "@/lib/utils/visitor-id";
import {
  type BfrHoldoutAssignmentRecord,
  FollowTopic,
} from "@/types/beach-follow";
import { BeachFollowControl } from "./beach-follow-control";

interface BeachFollowPilotProps {
  beachId?: string | null;
  beachName?: string | null;
  defaultTopic: FollowTopic;
  pageType: BfrPageType;
}

function assignmentSubject(): string {
  const visitorId = getVisitorId();
  if (visitorId) return visitorId;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ephemeral-${crypto.randomUUID()}`;
  }
  return `ephemeral-${Date.now()}`;
}

export function BeachFollowPilot({
  beachId,
  beachName,
  defaultTopic,
  pageType,
}: BeachFollowPilotProps) {
  const { track } = useTrackEvent();
  const rootRef = useRef<HTMLDivElement>(null);
  const exposureTracked = useRef(false);
  const [assignment, setAssignment] = useState<BfrHoldoutAssignmentRecord | null>(null);

  useEffect(() => {
    if (!beachId || !beachName) return;
    const assigned = ensureLocalBfrAssignment(
      readLocalBeachFollowState(),
      assignmentSubject(),
      new Date().toISOString(),
    );
    setAssignment(assigned.assignment);
  }, [beachId, beachName]);

  useEffect(() => {
    const root = rootRef.current;
    if (
      !root
      || !assignment
      || assignment.arm !== "treatment"
      || !beachId
      || typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const isViewable = entries.some(
        (entry) => entry.isIntersecting && entry.intersectionRatio > 0,
      );
      if (!isViewable || exposureTracked.current) return;
      exposureTracked.current = true;
      const metadata = buildBfrWebEventMetadata(
        {
          audience_class: "general_utility",
          page_type: pageType,
          experiment_key: assignment.experimentKey,
          experiment_arm: assignment.arm,
          topic: defaultTopic,
        },
        "beach_follow_started",
      );
      if (!metadata) return;
      try {
        void Promise.resolve(track("beach_follow_started", {
          beachId,
          metadata,
          debounceMs: 0,
        })).catch(() => undefined);
      } catch {
        return;
      }
      observer.disconnect();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [assignment, beachId, defaultTopic, pageType, track]);

  if (!beachId || !beachName || !assignment) return null;
  if (assignment.arm === "holdout") {
    return <div data-testid="beach-follow-holdout" hidden />;
  }

  return (
    <div ref={rootRef} data-testid="beach-follow-pilot">
      <BeachFollowControl
        assignment={assignment}
        beachId={beachId}
        beachName={beachName}
        defaultTopic={defaultTopic}
        pageType={pageType}
      />
    </div>
  );
}
