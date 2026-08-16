"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SessionFormMode,
  SessionFormState,
  useSessionForm,
} from "@/hooks/use-session-form";
import { LocationStep } from "./LocationStep";
import { DateTimeSection } from "./DateTimeSection";
import { EquipmentStep } from "./EquipmentStep";
import { ConditionsSection } from "./ConditionsSection";
import { PhotoSelectionSection } from "./PhotoSelectionSection";
import { NotesSection } from "./NotesSection";
import { VisibilitySection } from "./VisibilitySection";
import { SessionSlider } from "./SessionSlider";
import {
  SessionFitPicker,
  type SessionFitSelection,
} from "./SessionFitPicker";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import {
  FORECAST_ACCURACY_OPTIONS,
  RECOMMENDATION_CALL_ACCURACY_OPTIONS,
} from "./shared/constants";
import { SessionCelebration } from "@/components/session/session-celebration";
import { QuickLogView } from "./QuickLogView";
import type { BeachSource } from "@/hooks/use-nearest-beach";
import { useTrackEvent } from "@/hooks/use-track-event";
import { useSessionConditionsPrefill } from "@/hooks/use-session-conditions-prefill";
import {
  buildSessionLogEventMetadata,
  createSessionLogFlowId,
} from "@/lib/analytics/session-log-funnel";

type SessionLogStep =
  | "none"
  | "beach_select"
  | "rating"
  | "photo"
  | "details"
  | "review";
const STEP_ORDER: SessionLogStep[] = [
  "none",
  "beach_select",
  "rating",
  "photo",
  "details",
  "review",
];
function promoteStep(
  current: SessionLogStep,
  next: SessionLogStep
): SessionLogStep {
  return STEP_ORDER.indexOf(next) > STEP_ORDER.indexOf(current) ? next : current;
}

function parseOverallRating(rating: string): number | undefined {
  const parsed = parseInt(rating, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface SessionScrollFormProps {
  initialMode: SessionFormMode;
  onComplete: (formState: SessionFormState) => void;
  onCancel: () => void;
  initialFormState?: Partial<SessionFormState>;
  className?: string;
  /** Total logged sessions for this user — shown in the celebration overlay. */
  sessionNumber?: number;
  /** XP earned from this session — shown in the celebration overlay when > 0. */
  xpEarned?: number;
  /** Enable 2-tap quick-log mode (beach + rating, expandable details). Log mode only. */
  quickMode?: boolean;
  /** Auto-detected beach from useNearestBeach (quick mode only) */
  detectedBeach?: { id: string; name: string } | null;
  detectedSource?: BeachSource;
  detectedConfidence?: "high" | "low" | null;
}

export function SessionScrollForm({
  initialMode,
  onComplete,
  onCancel,
  initialFormState,
  className,
  sessionNumber,
  xpEarned,
  quickMode = false,
  detectedBeach,
  detectedSource,
  detectedConfidence,
}: SessionScrollFormProps) {
  const { formState, updateField, boards, beaches, loadingData, refreshBoards } =
    useSessionForm({ initialMode, initialFormState, quick: quickMode });

  const isLog = true;
  const useQuickMode = quickMode;
  const title = useQuickMode ? "How was it?" : "Log Session";
  const isRecommendationLog = Boolean(formState.recommendationId);

  // Prefill wave/wind/tide from forecast at the form level so it runs even when
  // the conditions UI is collapsed behind QuickLog's details accordion.
  useSessionConditionsPrefill(initialMode, formState, updateField);

  // Logged sessions require a rating — that's the only signal the preference
  // learner reads. Conditions are prefilled and editable but not required.
  const canSave = Boolean(
    formState.selectedBeachId &&
      formState.selectedDate &&
      formState.overallRating
  );

  // ── Session log funnel instrumentation (log mode only) ──
  const { track: trackEvent } = useTrackEvent();
  const openedAtRef = useRef<number>(Date.now());
  const hasTrackedOpenRef = useRef(false);
  const hasTrackedStartRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const hasTrackedAbandonRef = useRef(false);
  const fallbackFlowIdRef = useRef(createSessionLogFlowId());
  const flowId = formState.sessionLogFlowId ?? fallbackFlowIdRef.current;
  const flowIdRef = useRef(flowId);
  const maxStepReachedRef = useRef<SessionLogStep>("none");
  const trackedBeachIdRef = useRef<string | null>(null);
  const lastPhotoCountRef = useRef<number>(0);
  const ratingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedRatingRef = useRef<string>("");

  // Mirror refs for unmount cleanup (empty-deps effect can't close over fresh state)
  const trackRef = useRef(trackEvent);
  const isLogRef = useRef(isLog);
  const currentBeachIdRef = useRef<string | undefined>(formState.selectedBeachId);

  // Mark this mount as "form opened" for log mode. Single-fire.
  useEffect(() => {
    if (!isLog || hasTrackedOpenRef.current) return;
    hasTrackedOpenRef.current = true;
    openedAtRef.current = Date.now();
  }, [isLog]);

  // session_log_beach_selected: fire once when the first non-empty beach id
  // appears (covers both prefilled/auto-detected beaches and user picks).
  // Also fires session_log_start as the funnel bookend (parallel to the
  // existing GA emission in LocationStep — Supabase needs its own anchor for
  // funnel queries against user_events).
  useEffect(() => {
    if (!isLog) return;
    const beachId = formState.selectedBeachId;
    if (!beachId) return;
    if (trackedBeachIdRef.current === beachId) return;
    trackedBeachIdRef.current = beachId;
    maxStepReachedRef.current = promoteStep(
      maxStepReachedRef.current,
      "beach_select"
    );
    if (!hasTrackedStartRef.current) {
      hasTrackedStartRef.current = true;
      trackEvent("session_log_start", {
        beachId,
        metadata: buildSessionLogEventMetadata(flowId, {
          beach_id: beachId,
          event_id: `session-log:${flowId}:start:web:v1`,
        }),
      });
    }
    trackEvent("session_log_beach_selected", {
      beachId,
      metadata: buildSessionLogEventMetadata(flowId, {
        beach_id: beachId,
        event_id: `session-log:${flowId}:beach:${beachId}:web:v1`,
      }),
    });
  }, [flowId, isLog, formState.selectedBeachId, trackEvent]);

  // session_log_rating_set: fire on overallRating change with 500ms debounce.
  // Only the primary rating — wave quality / crowd sliders are excluded by design.
  useEffect(() => {
    if (!isLog) return;
    const rating = formState.overallRating;
    if (!rating) return;
    if (rating === lastTrackedRatingRef.current) return;

    if (ratingDebounceRef.current) clearTimeout(ratingDebounceRef.current);
    ratingDebounceRef.current = setTimeout(() => {
      const ratingNum = parseInt(rating, 10);
      if (!Number.isFinite(ratingNum)) return;
      lastTrackedRatingRef.current = rating;
      maxStepReachedRef.current = promoteStep(
        maxStepReachedRef.current,
        "rating"
      );
      trackEvent("session_log_rating_set", {
        beachId: formState.selectedBeachId,
        metadata: buildSessionLogEventMetadata(flowId, {
          rating: ratingNum,
          beach_id: formState.selectedBeachId,
        }),
      });
    }, 500);

    return () => {
      if (ratingDebounceRef.current) clearTimeout(ratingDebounceRef.current);
    };
  }, [flowId, isLog, formState.overallRating, formState.selectedBeachId, trackEvent]);

  // session_log_photo_added: fire when photo count increases (never on remove).
  // Batch adds (multi-select / drag-drop of N files) fire a single event with
  // the final count — one event per add action, not per file.
  useEffect(() => {
    if (!isLog) return;
    const count = formState.photos.length;
    if (count > lastPhotoCountRef.current) {
      lastPhotoCountRef.current = count;
      maxStepReachedRef.current = promoteStep(
        maxStepReachedRef.current,
        "photo"
      );
      trackEvent("session_log_photo_added", {
        beachId: formState.selectedBeachId,
        metadata: buildSessionLogEventMetadata(flowId, {
          photo_count: count,
          beach_id: formState.selectedBeachId,
        }),
        // Disable debounce so rapid successive adds each land
        debounceMs: 0,
      });
    } else if (count < lastPhotoCountRef.current) {
      // Keep counter in sync on removal (but do not fire)
      lastPhotoCountRef.current = count;
    }
  }, [flowId, isLog, formState.photos, formState.selectedBeachId, trackEvent]);

  // Sync mirror refs every render so the unmount cleanup reads fresh values.
  useEffect(() => {
    trackRef.current = trackEvent;
    isLogRef.current = isLog;
    currentBeachIdRef.current = formState.selectedBeachId;
    flowIdRef.current = flowId;
  }, [flowId, formState.selectedBeachId, isLog, trackEvent]);

  // Unmount cleanup: fire session_log_abandon if the form was opened in log
  // mode and the user neither submitted nor already cancelled via button.
  useEffect(() => {
    return () => {
      if (
        !isLogRef.current ||
        !hasTrackedOpenRef.current ||
        hasSubmittedRef.current ||
        hasTrackedAbandonRef.current
      ) {
        return;
      }
      hasTrackedAbandonRef.current = true;
      trackRef.current("session_log_abandon", {
        beachId: currentBeachIdRef.current,
        metadata: buildSessionLogEventMetadata(flowIdRef.current, {
          beach_id: currentBeachIdRef.current,
          abandon_via: "unmount",
          duration_ms: Date.now() - openedAtRef.current,
          max_step_reached:
            maxStepReachedRef.current === "none"
              ? undefined
              : maxStepReachedRef.current,
        }),
      });
    };
    // Empty deps intentional: cleanup must run only on real unmount. All values
    // read in the cleanup come from refs that are synced in a separate effect.
  }, []);

  // Celebration overlay state — only shown for logged sessions
  const [pendingFormState, setPendingFormState] = useState<SessionFormState | null>(null);

  const handleCancel = useCallback(() => {
    if (
      isLog &&
      hasTrackedOpenRef.current &&
      !hasSubmittedRef.current &&
      !hasTrackedAbandonRef.current
    ) {
      hasTrackedAbandonRef.current = true;
      trackEvent("session_log_abandon", {
        beachId: formState.selectedBeachId,
        metadata: buildSessionLogEventMetadata(flowId, {
          beach_id: formState.selectedBeachId,
          abandon_via: "cancel_button",
          duration_ms: Date.now() - openedAtRef.current,
          max_step_reached:
            maxStepReachedRef.current === "none"
              ? undefined
              : maxStepReachedRef.current,
        }),
      });
    }
    onCancel();
  }, [flowId, isLog, formState.selectedBeachId, trackEvent, onCancel]);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    maxStepReachedRef.current = promoteStep(
      maxStepReachedRef.current,
      "review"
    );
    setPendingFormState(formState);
  }, [canSave, formState]);

  const handleSessionFitSelection = useCallback(
    (selection: SessionFitSelection) => {
      const rating = parseOverallRating(formState.overallRating);
      if (selection.kind === "board_fit") {
        trackEvent("session_board_fit_feedback_selected", {
          beachId: formState.selectedBeachId,
          metadata: buildSessionLogEventMetadata(flowId, {
            beach_id: formState.selectedBeachId,
            rating,
            board_fit: selection.value,
            source: "session_fit_picker",
          }),
          debounceMs: 0,
        });
        return;
      }

      trackEvent("session_decomposition_selected", {
        beachId: formState.selectedBeachId,
        metadata: buildSessionLogEventMetadata(flowId, {
          beach_id: formState.selectedBeachId,
          rating,
          tag: selection.tag,
          ...(selection.tag === "skill_fit"
            ? { skill_fit: selection.value }
            : {}),
        }),
        debounceMs: 0,
      });
    },
    [flowId, formState.overallRating, formState.selectedBeachId, trackEvent]
  );

  const handleCelebrationDismiss = useCallback(() => {
    if (pendingFormState) {
      const captured = pendingFormState;
      setPendingFormState(null);
      // Mark as submitted so unmount cleanup does not fire abandon when the
      // parent navigates away after the server action succeeds.
      hasSubmittedRef.current = true;
      onComplete({ ...captured, sessionLogFlowId: flowId });
    }
  }, [flowId, onComplete, pendingFormState]);

  const sessionFitPicker = (
    <SessionFitPicker
      rating={formState.overallRating}
      value={formState.sessionDecomposition}
      onChange={(next) => updateField("sessionDecomposition", next)}
      onSelection={handleSessionFitSelection}
    />
  );

  return (
    <div className={cn("relative min-h-screen bg-q-twilight session-scroll-form", className)}>
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{ backgroundImage: "url('/textures/noise.png')", backgroundRepeat: "repeat" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen max-w-xl mx-auto w-full">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-q-twilight border-b border-[#404C92]">
          <button
            type="button"
            aria-label="Cancel"
            onClick={handleCancel}
            className="p-1 rounded-full text-[#8B9EC2] hover:text-[#A8B8D0] transition-colors focus-ring"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-base font-bold text-[#F0F0F0]">{title}</h1>

          <Button
            type="button"
            size="sm"
            disabled={!canSave || loadingData}
            onClick={handleSave}
            className="bg-gradient-to-r from-q-orange to-[#D57835] hover:from-[#D57835] hover:to-[#C92F6C] text-white font-semibold px-4 disabled:opacity-40"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-6 pb-32">
            {useQuickMode ? (
              /* ── Quick-Log Mode ── */
              <QuickLogView
                formState={formState}
                updateField={updateField}
                beaches={beaches}
                detectedBeach={detectedBeach ?? null}
                detectedSource={detectedSource ?? null}
                detectedConfidence={detectedConfidence ?? null}
                sessionLogFlowId={flowId}
                sessionFitPicker={sessionFitPicker}
                detailSections={
                  <>
                    {/* Conditions */}
                    <section className="space-y-3">
                      <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">Conditions</h2>
                      <ConditionsSection mode={initialMode} formState={formState} updateField={updateField} />
                    </section>

                    <hr className="border-[#404C92]" />

                    {/* Wave quality + crowd sliders */}
                    <section className="space-y-6">
                      <SessionSlider
                        label="Wave Quality"
                        labels={["Flat", "Choppy", "Fun", "Good", "Firing"]}
                        colors={["#0D9488", "#F59E0B", "#EA580C"]}
                        value={formState.waveQuality}
                        onChange={(v) => updateField("waveQuality", v)}
                      />
                      <SessionSlider
                        label="Crowd"
                        labels={["Empty", "Chill", "Moderate", "Busy", "Packed"]}
                        colors={["#16A34A", "#FBBF24", "#DC2626"]}
                        value={formState.crowdLevel}
                        onChange={(v) => updateField("crowdLevel", v)}
                      />
                      <div className="space-y-2">
                        <span className="text-sm font-bold text-[#F0F0F0]">Wave Types</span>
                        <WaveTypeSelector selectedTypes={formState.waveCharacteristics} onChange={(types) => updateField("waveCharacteristics", types)} />
                      </div>
                    </section>

                    <hr className="border-[#404C92]" />

                    {/* Photos */}
                    <section className="space-y-3">
                      <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">Photos</h2>
                      <PhotoSelectionSection
                        mode={initialMode}
                        selectedFiles={formState.photos}
                        onFilesChange={(files) => updateField("photos", files)}
                      />
                    </section>

                    <hr className="border-[#404C92]" />

                    {/* Equipment */}
                    <section className="space-y-3">
                      <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">Board</h2>
                      <EquipmentStep formState={formState} boards={boards} updateField={updateField} onBoardsRefresh={refreshBoards} />
                    </section>

                    <hr className="border-[#404C92]" />

                    {/* Notes */}
                    <section className="space-y-3">
                      <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">Notes</h2>
                      <NotesSection mode={initialMode} formState={formState} updateField={updateField} />
                    </section>

                    <hr className="border-[#404C92]" />

                    {/* Visibility */}
                    <section className="space-y-3">
                      <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">Visibility</h2>
                      <VisibilitySection
                        isPublic={formState.isPublic}
                        isMuted={formState.isMuted}
                        onPublicChange={(v) => updateField("isPublic", v)}
                        onMutedChange={(v) => updateField("isMuted", v)}
                      />
                    </section>
                  </>
                }
              />
            ) : (
              /* ── Standard Full Mode ── */
                  <>
                {/* Section 1: Location + Date/Time */}
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">
                    Where&apos;d you surf?
                  </h2>
                  <LocationStep
                    formState={formState}
                    beaches={beaches}
                    mode={initialMode}
                    sessionLogFlowId={flowId}
                    updateField={updateField}
                  />
                  <DateTimeSection mode={initialMode} formState={formState} updateField={updateField} />
                </section>

                <hr className="border-[#404C92]" />
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">What&apos;d you ride?</h2>
                  <EquipmentStep formState={formState} boards={boards} updateField={updateField} onBoardsRefresh={refreshBoards} />
                </section>

                <hr className="border-[#404C92]" />
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">What was it like out there?</h2>
                  <ConditionsSection mode={initialMode} formState={formState} updateField={updateField} />
                </section>

                <hr className="border-[#404C92]" />
                <section className="space-y-6">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">How were the waves?</h2>
                  <SessionSlider label="Overall" labels={["Rough", "Meh", "Fun", "Great", "Epic"]} colors={["#9CA3AF", "#F59E0B", "#EA580C"]} value={formState.overallRating} onChange={(v) => updateField("overallRating", v)} hero />
                  {sessionFitPicker}
                  <SessionSlider label="Wave Quality" labels={["Flat", "Choppy", "Fun", "Good", "Firing"]} colors={["#0D9488", "#F59E0B", "#EA580C"]} value={formState.waveQuality} onChange={(v) => updateField("waveQuality", v)} />
                  <SessionSlider label="Crowd" labels={["Empty", "Chill", "Moderate", "Busy", "Packed"]} colors={["#16A34A", "#FBBF24", "#DC2626"]} value={formState.crowdLevel} onChange={(v) => updateField("crowdLevel", v)} />
                  <div className="space-y-2">
                    <span className="text-sm font-bold text-[#F0F0F0]">Wave Types</span>
                    <WaveTypeSelector selectedTypes={formState.waveCharacteristics} onChange={(types) => updateField("waveCharacteristics", types)} />
                  </div>
                </section>

                <hr className="border-[#404C92]" />
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">
                    {isRecommendationLog ? "Was this call right?" : "Was the forecast accurate?"}
                  </h2>
                  <div className={cn("grid gap-3", isRecommendationLog ? "grid-cols-2" : "grid-cols-3")}>
                    {(isRecommendationLog
                      ? RECOMMENDATION_CALL_ACCURACY_OPTIONS
                      : FORECAST_ACCURACY_OPTIONS
                    ).map((option) => {
                      const IconComponent = "icon" in option ? option.icon : null;
                      const iconColor = "color" in option ? option.color : "text-[#9AABC6]";
                      const isSelected = isRecommendationLog
                        ? formState.recommendationCallAccuracy === option.value
                        : formState.forecastAccuracy === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (isRecommendationLog) {
                              updateField(
                                "recommendationCallAccuracy",
                                option.value as "right" | "partly" | "wrong" | "not_sure"
                              );
                              return;
                            }

                            updateField(
                              "forecastAccuracy",
                              option.value as "accurate" | "somewhat" | "inaccurate"
                            );
                          }}
                          className={cn(
                            "p-4 rounded-lg border-2 transition-colors",
                            isSelected
                              ? "border-q-orange bg-q-orange/10"
                              : "border-[#404C92] bg-[#354090] hover:bg-[#404C92]"
                          ) + " focus-ring"}
                          aria-label={`${option.label}: ${option.description}`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            {IconComponent && (
                              <IconComponent className={cn("h-6 w-6", isSelected ? "text-q-orange" : iconColor)} />
                            )}
                            <span className={cn("font-medium", isSelected ? "text-q-orange" : "text-[#F0F0F0]")}>{option.label}</span>
                            <span className="text-xs text-[#9AABC6] text-center">{option.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <hr className="border-[#404C92]" />
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">Photos</h2>
                  <PhotoSelectionSection mode={initialMode} selectedFiles={formState.photos} onFilesChange={(files) => updateField("photos", files)} />
                </section>

                <hr className="border-[#404C92]" />

                {/* Notes (both modes) */}
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">Notes</h2>
                  <NotesSection mode={initialMode} formState={formState} updateField={updateField} />
                </section>

                <hr className="border-[#404C92]" />

                {/* Visibility (both modes) */}
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">Visibility</h2>
                  <VisibilitySection
                    isPublic={formState.isPublic}
                    isMuted={formState.isMuted}
                    onPublicChange={(v) => updateField("isPublic", v)}
                    onMutedChange={(v) => updateField("isMuted", v)}
                  />
                </section>
              </>
            )}
          </div>
        </main>

        {/* Sticky bottom save button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-q-twilight border-t border-[#404C92] safe-area-bottom">
          <div className="max-w-xl mx-auto">
          <button
            type="button"
            disabled={!canSave || loadingData}
            onClick={handleSave}
            className={cn(
              "w-full py-4 rounded-xl text-white font-bold text-lg transition-[background-color,background-image,box-shadow,transform,opacity] duration-200 disabled:cursor-not-allowed",
              canSave && !loadingData
                ? "bg-gradient-to-r from-q-orange to-[#D57835] active:scale-[0.97] shadow-lg shadow-q-orange/20 hover:shadow-xl hover:shadow-q-orange/30"
                : "bg-[#404C92]/60 opacity-50"
            ) + " focus-ring"}
          >
            {loadingData ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </span>
            ) : useQuickMode ? (
              "Log it"
            ) : (
              "Save Session"
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Session celebration overlay — log mode only, shown after successful save */}
      {pendingFormState && (
        <SessionCelebration
          sessionNumber={sessionNumber ?? 1}
          beachName={pendingFormState.selectedBeach || "your spot"}
          waveHeight={pendingFormState.waveHeight}
          rating={pendingFormState.overallRating ? Number(pendingFormState.overallRating) : undefined}
          xpEarned={xpEarned}
          onDismiss={handleCelebrationDismiss}
        />
      )}
    </div>
  );
}
