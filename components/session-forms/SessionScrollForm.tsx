"use client";

import { useState, useCallback } from "react";
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
import { GoalsSection } from "./GoalsSection";
import { VisibilitySection } from "./VisibilitySection";
import { SessionSlider } from "./SessionSlider";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import { FORECAST_ACCURACY_OPTIONS } from "./shared/constants";
import { SessionCelebration } from "@/components/session/session-celebration";
import { QuickLogView } from "./QuickLogView";
import type { BeachSource } from "@/hooks/use-nearest-beach";

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
  const { formState, updateField, boards, beaches, loadingData, isPlanning, refreshBoards } =
    useSessionForm({ initialMode, initialFormState, quick: quickMode });

  const isLog = !isPlanning;
  const useQuickMode = quickMode && isLog;
  const title = useQuickMode ? "How was it?" : isPlanning ? "Plan Session" : "Log Session";

  const canSave = Boolean(formState.selectedBeachId && formState.selectedDate);

  // Celebration overlay state — only shown for logged sessions
  const [pendingFormState, setPendingFormState] = useState<SessionFormState | null>(null);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    // Only show celebration for log mode; plan mode completes immediately
    if (isLog) {
      setPendingFormState(formState);
    } else {
      onComplete(formState);
    }
  }, [canSave, isLog, formState, onComplete]);

  const handleCelebrationDismiss = useCallback(() => {
    if (pendingFormState) {
      const captured = pendingFormState;
      setPendingFormState(null);
      onComplete(captured);
    }
  }, [pendingFormState, onComplete]);

  return (
    <div className={cn("relative min-h-screen bg-[#252D6B] session-scroll-form", className)}>
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{ backgroundImage: "url('/textures/noise.png')", backgroundRepeat: "repeat" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen max-w-xl mx-auto w-full">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#252D6B] border-b border-[#404C92]">
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="p-1 rounded-full text-[#8B9EC2] hover:text-[#A8B8D0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-base font-bold text-[#F0F0F0]">{title}</h1>

          <Button
            type="button"
            size="sm"
            disabled={!canSave || loadingData}
            onClick={handleSave}
            className="bg-gradient-to-r from-[#F78E42] to-[#D57835] hover:from-[#D57835] hover:to-[#C92F6C] text-white font-semibold px-4 disabled:opacity-40"
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
                detailSections={
                  <>
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
                    {isPlanning ? "Where & when?" : "Where'd you surf?"}
                  </h2>
                  <LocationStep formState={formState} beaches={beaches} mode={initialMode} updateField={updateField} />
                  <DateTimeSection mode={initialMode} formState={formState} updateField={updateField} />
                </section>

                {isLog && (
                  <>
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
                      <SessionSlider label="Wave Quality" labels={["Flat", "Choppy", "Fun", "Good", "Firing"]} colors={["#0D9488", "#F59E0B", "#EA580C"]} value={formState.waveQuality} onChange={(v) => updateField("waveQuality", v)} />
                      <SessionSlider label="Crowd" labels={["Empty", "Chill", "Moderate", "Busy", "Packed"]} colors={["#16A34A", "#FBBF24", "#DC2626"]} value={formState.crowdLevel} onChange={(v) => updateField("crowdLevel", v)} />
                      <div className="space-y-2">
                        <span className="text-sm font-bold text-[#F0F0F0]">Wave Types</span>
                        <WaveTypeSelector selectedTypes={formState.waveTypes} onChange={(types) => updateField("waveTypes", types)} />
                      </div>
                    </section>

                    <hr className="border-[#404C92]" />
                    <section className="space-y-4">
                      <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">Was the forecast accurate?</h2>
                      <div className="grid grid-cols-3 gap-3">
                        {FORECAST_ACCURACY_OPTIONS.map((option) => {
                          const IconComponent = option.icon;
                          const isSelected = formState.forecastAccuracy === option.value;
                          return (
                            <button key={option.value} type="button" onClick={() => updateField("forecastAccuracy", option.value as "accurate" | "somewhat" | "inaccurate")} className={cn("p-4 rounded-lg border-2 transition-all", isSelected ? "border-[#F78E42] bg-[#F78E42]/10" : "border-[#404C92] bg-[#354090] hover:bg-[#404C92]")} aria-label={`${option.label}: ${option.description}`}>
                              <div className="flex flex-col items-center gap-2">
                                <IconComponent className={cn("h-6 w-6", isSelected ? "text-[#F78E42]" : option.color)} />
                                <span className={cn("font-medium", isSelected ? "text-[#F78E42]" : "text-[#F0F0F0]")}>{option.label}</span>
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
                  </>
                )}

                {isPlanning && (
                  <>
                    <hr className="border-[#404C92]" />
                    <section>
                      <GoalsSection mode={initialMode} formState={formState} updateField={updateField} />
                    </section>
                    <hr className="border-[#404C92]" />
                  </>
                )}

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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#252D6B] border-t border-[#404C92] safe-area-bottom">
          <div className="max-w-xl mx-auto">
          <button
            type="button"
            disabled={!canSave || loadingData}
            onClick={handleSave}
            className={cn(
              "w-full py-4 rounded-xl text-white font-bold text-lg transition-all duration-200 disabled:cursor-not-allowed",
              canSave && !loadingData
                ? "bg-gradient-to-r from-[#F78E42] to-[#D57835] active:scale-[0.97] shadow-lg shadow-[#F78E42]/20 hover:shadow-xl hover:shadow-[#F78E42]/30"
                : "bg-[#404C92]/60 opacity-50"
            )}
          >
            {loadingData ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </span>
            ) : useQuickMode ? (
              "Log it"
            ) : (
              `Save ${isPlanning ? "Plan" : "Session"}`
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
