"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Heart, RefreshCw } from "lucide-react";

import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { useTrackEvent } from "@/hooks/use-track-event";
import {
  buildBfrWebEventMetadata,
  type BfrPageType,
} from "@/lib/analytics/event-taxonomy";
import {
  addLocalBeachFollow,
  ensureLocalBfrAssignment,
  persistLocalBeachIntentChoice,
  readLocalBeachFollowState,
  removeLocalBeachFollow,
  type LocalBeachFollowSnapshot,
  updateLocalBeachFollowTopics,
} from "@/lib/beach-follow/local-storage";
import {
  type ExplicitBeachIntent,
  qualifyBeachIntent,
} from "@/lib/beach-follow/intent";
import { getVisitorId } from "@/lib/utils/visitor-id";
import {
  type BfrHoldoutAssignmentRecord,
  FollowTopic,
} from "@/types/beach-follow";

const TOPIC_OPTIONS: ReadonlyArray<{ topic: FollowTopic; label: string }> = [
  { topic: FollowTopic.WaterTemp, label: "Water temperature" },
  { topic: FollowTopic.Tide, label: "Tides" },
  { topic: FollowTopic.WaterQuality, label: "Water quality" },
  { topic: FollowTopic.Wind, label: "Wind" },
  { topic: FollowTopic.General, label: "General beach updates" },
  { topic: FollowTopic.Surf, label: "Surf" },
];

const INTENT_OPTIONS: ReadonlyArray<{
  intent: ExplicitBeachIntent;
  label: string;
}> = [
  { intent: "surfing", label: "Surfing" },
  { intent: "swimming", label: "Swimming" },
  { intent: "beach_days", label: "Beach days" },
  { intent: "fishing", label: "Fishing" },
  { intent: "diving_paddling", label: "Diving or paddling" },
  { intent: "other", label: "Something else" },
];

interface BeachFollowControlProps {
  beachId: string;
  beachName: string;
  defaultTopic: FollowTopic;
  pageType: BfrPageType;
  assignment?: BfrHoldoutAssignmentRecord;
}

function ephemeralSubjectId(): string {
  const visitorId = getVisitorId();
  if (visitorId) return visitorId;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ephemeral-${crypto.randomUUID()}`;
  }
  return `ephemeral-${Date.now()}`;
}

export function BeachFollowControl({
  beachId,
  beachName,
  defaultTopic,
  pageType,
  assignment: assignmentProp,
}: BeachFollowControlProps) {
  const { track } = useTrackEvent();
  const [snapshot, setSnapshot] = useState<LocalBeachFollowSnapshot>(() => ({
    state: {
      version: 3,
      follows: [],
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: assignmentProp ?? null,
    },
    status: "unavailable",
    persisted: false,
  }));
  const [assignment, setAssignment] = useState<
    BfrHoldoutAssignmentRecord | undefined
  >(assignmentProp);
  const [selectedTopics, setSelectedTopics] = useState<FollowTopic[]>([
    defaultTopic,
  ]);
  const [showIntentPrompt, setShowIntentPrompt] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const followedBeach = useMemo(
    () => snapshot.state.follows.find((follow) => follow.beachId === beachId),
    [beachId, snapshot.state.follows],
  );
  const isFollowing = Boolean(followedBeach);

  const hydrate = useCallback(() => {
    const loaded = readLocalBeachFollowState();
    const assigned = assignmentProp
      ? { ...loaded, assignment: assignmentProp }
      : ensureLocalBfrAssignment(
          loaded,
          ephemeralSubjectId(),
          new Date().toISOString(),
        );
    setSnapshot(assigned);
    setAssignment(assigned.assignment);
    const existing = assigned.state.follows.find(
      (follow) => follow.beachId === beachId,
    );
    setSelectedTopics(existing?.topics ?? [defaultTopic]);
  }, [assignmentProp, beachId, defaultTopic]);

  useEffect(() => {
    hydrate();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "quiver_beach_follow_state") {
        hydrate();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hydrate]);

  const analyticsBase = useMemo(() => {
    if (!assignment) return null;
    return {
      audience_class: "general_utility" as const,
      page_type: pageType,
      experiment_key: assignment.experimentKey,
      experiment_arm: assignment.arm,
    };
  }, [assignment, pageType]);

  const safelyTrack = useCallback(
    (eventType: Parameters<typeof track>[0], options: Parameters<typeof track>[1]) => {
      try {
        void Promise.resolve(track(eventType, options)).catch(() => undefined);
      } catch {
        return;
      }
    },
    [track],
  );

  const handleFollowToggle = useCallback(() => {
    const now = new Date().toISOString();
    if (isFollowing) {
      const next = removeLocalBeachFollow(snapshot, beachId, now);
      setSnapshot(next);
      setSelectedTopics([defaultTopic]);
      setShowIntentPrompt(false);
      toast({ title: `${beachName} unfollowed` });
      return;
    }

    const next = addLocalBeachFollow(
      snapshot,
      beachId,
      selectedTopics,
      now,
    );
    setSnapshot(next);
    setShowIntentPrompt(next.state.follows.some((follow) => follow.beachId === beachId));

    if (next.status === "sync_required") return;
    toast({
      title: next.persisted ? "Saved on this device" : "Saved for this visit",
      description: `Following ${beachName}`,
    });

    if (!analyticsBase) return;
    for (const topic of selectedTopics) {
      const metadata = buildBfrWebEventMetadata(
        { ...analyticsBase, topic },
        "beach_follow_saved_local",
      );
      if (!metadata) continue;
      safelyTrack("beach_follow_saved_local", {
        beachId,
        metadata,
        debounceMs: 0,
      });
    }
  }, [
    analyticsBase,
    beachId,
    beachName,
    defaultTopic,
    isFollowing,
    safelyTrack,
    selectedTopics,
    snapshot,
  ]);

  const handleTopicChange = useCallback(
    (topic: FollowTopic, checked: boolean) => {
      const nextTopics = checked
        ? [...new Set([...selectedTopics, topic])]
        : selectedTopics.filter((selected) => selected !== topic);
      if (nextTopics.length === 0) return;
      setSelectedTopics(nextTopics);
      if (!isFollowing) return;

      const next = updateLocalBeachFollowTopics(
        snapshot,
        beachId,
        nextTopics,
        new Date().toISOString(),
      );
      setSnapshot(next);
      if (!analyticsBase) return;
      const metadata = buildBfrWebEventMetadata(
        { ...analyticsBase, topic },
        "follow_topic_changed",
      );
      if (!metadata) return;
      safelyTrack("follow_topic_changed", {
        beachId,
        metadata,
        debounceMs: 0,
      });
    },
    [analyticsBase, beachId, isFollowing, safelyTrack, selectedTopics, snapshot],
  );

  const handleIntent = useCallback(
    (choice: ExplicitBeachIntent | null) => {
      setShowIntentPrompt(false);
      if (!choice) return;
      persistLocalBeachIntentChoice(choice);
      if (!analyticsBase) return;
      const qualification = qualifyBeachIntent(choice, {
        utilityPageViewCount: 1,
        surfSpecificSignalCount: 0,
      });
      const metadata = buildBfrWebEventMetadata(
        {
          ...analyticsBase,
          intent_state: "explicit",
          intent_reason:
            qualification.reason === "explicit_surfing"
              ? "explicit_surfing"
              : "explicit_non_surf",
        },
        "visitor_intent_selected",
      );
      if (!metadata) return;
      safelyTrack("visitor_intent_selected", {
        beachId,
        metadata,
        debounceMs: 0,
      });
      if (qualification.reason !== "explicit_surfing") return;

      const qualifiedMetadata = buildBfrWebEventMetadata(
        {
          ...analyticsBase,
          audience_class: "surf_qualified",
          intent_state: "explicit",
          intent_reason: "explicit_surfing",
        },
        "surf_intent_qualified",
      );
      if (!qualifiedMetadata) return;
      safelyTrack("surf_intent_qualified", {
        beachId,
        metadata: qualifiedMetadata,
        debounceMs: 0,
      });
    },
    [analyticsBase, beachId, safelyTrack],
  );

  return (
    <section
      aria-label={`Follow ${beachName}`}
      className="motion-reduce:transition-none rounded-[20px_8px_22px_10px] border-2 border-[#11100D] bg-[#172A49] p-5 text-[#F6EFE3] shadow-[3px_4px_0_rgba(17,16,13,0.2)] transition-shadow sm:p-6"
      data-testid="beach-follow-control"
    >
      <div className="flex items-start gap-3">
        <Heart className="mt-0.5 h-5 w-5 text-[#F78E42]" aria-hidden="true" />
        <div>
          <h2 className="font-heading text-xl font-bold">Follow {beachName}</h2>
          <p className="mt-1 text-sm text-[#BBC7D8]">
            Save this beach on this device. No account required.
          </p>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-[0.12em]">
          What do you care about?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TOPIC_OPTIONS.map(({ topic, label }) => (
            <label
              key={topic}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#68809F] bg-[#223B60] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#F78E42]"
            >
              <Checkbox
                aria-label={label}
                checked={selectedTopics.includes(topic)}
                onCheckedChange={(checked) => handleTopicChange(topic, checked === true)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          aria-label={isFollowing ? `Unfollow ${beachName}` : `Follow ${beachName}`}
          aria-pressed={isFollowing}
          className="rounded-full bg-[#F6EFE3] px-6 font-semibold text-[#11100D] hover:bg-white"
          onClick={handleFollowToggle}
        >
          {isFollowing && <Check aria-hidden="true" />}
          {isFollowing ? "Following" : "Follow this beach"}
        </Button>
        {isFollowing && (
          <Button
            className="rounded-full border-[#91A5BF] text-[#F6EFE3] hover:bg-[#223B60]"
            onClick={() => setShowSyncModal(true)}
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Sync across devices
          </Button>
        )}
      </div>

      <p className="mt-3 min-h-5 text-sm text-[#BBC7D8]" aria-live="polite">
        {snapshot.status === "sync_required"
          ? "Sync to keep going. Your existing beach list is safe."
          : isFollowing
            ? snapshot.persisted
              ? "Saved on this device"
              : "Saved for this visit"
            : ""}
      </p>

      {showIntentPrompt && (
        <div className="mt-5 border-t border-[#68809F] pt-4">
          <h3 className="font-heading text-base font-bold">
            What brings you to the beach?
          </h3>
          <p className="mt-1 text-sm text-[#BBC7D8]">Optional — this only changes what you see.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTENT_OPTIONS.map(({ intent, label }) => (
              <Button
                key={intent}
                className="border-[#91A5BF] text-[#F6EFE3] hover:bg-[#223B60]"
                onClick={() => handleIntent(intent)}
                size="sm"
                variant="outline"
              >
                {label}
              </Button>
            ))}
            <Button onClick={() => handleIntent(null)} size="sm" variant="ghost">
              Not sure yet
            </Button>
          </div>
        </div>
      )}

      <UnifiedAuthModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        mode="signup"
        source="beach-follow-sync"
        contextMessage={{
          title: "Sync beach follows",
          description: "Sync beaches, topics, and My Coast across devices.",
        }}
      />
    </section>
  );
}
