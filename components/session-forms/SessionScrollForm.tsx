"use client";

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

interface SessionScrollFormProps {
  initialMode: SessionFormMode;
  onComplete: (formState: SessionFormState) => void;
  onCancel: () => void;
  initialFormState?: Partial<SessionFormState>;
  className?: string;
}

export function SessionScrollForm({
  initialMode,
  onComplete,
  onCancel,
  initialFormState,
  className,
}: SessionScrollFormProps) {
  const { formState, updateField, boards, beaches, loadingData, isPlanning, refreshBoards } =
    useSessionForm({ initialMode, initialFormState });

  const isLog = !isPlanning;
  const title = isPlanning ? "Plan Session" : "Log Session";

  const canSave = Boolean(formState.selectedBeachId && formState.selectedDate);

  function handleSave() {
    if (!canSave) return;
    onComplete(formState);
  }

  return (
    <div className={cn("relative min-h-screen bg-[#FAFAF5]", className)}>
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: "url('/textures/noise.png')", backgroundRepeat: "repeat" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#FAFAF5] border-b border-gray-100">
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="text-base font-bold text-[#1A1A1A]">{title}</h1>

          <Button
            type="button"
            size="sm"
            disabled={!canSave || loadingData}
            onClick={handleSave}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold px-4 disabled:opacity-40"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-6 pb-32">
            {/* Section 1: Location + Date/Time */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                {isPlanning ? "Where & when?" : "Where'd you surf?"}
              </h2>
              <LocationStep
                formState={formState}
                beaches={beaches}
                mode={initialMode}
                updateField={updateField}
              />
              <DateTimeSection
                mode={initialMode}
                formState={formState}
                updateField={updateField}
              />
            </section>

            {isLog && (
              <>
                <hr className="border-gray-100" />

                {/* Section 2: Equipment */}
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                    What&apos;d you ride?
                  </h2>
                  <EquipmentStep
                    formState={formState}
                    boards={boards}
                    updateField={updateField}
                    onBoardsRefresh={refreshBoards}
                  />
                </section>

                <hr className="border-gray-100" />

                {/* Section 3: Conditions (objective inputs) */}
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                    What was it like out there?
                  </h2>
                  <ConditionsSection
                    mode={initialMode}
                    formState={formState}
                    updateField={updateField}
                  />
                </section>

                <hr className="border-gray-100" />

                {/* Section 4: Subjective sliders + Wave types */}
                <section className="space-y-6">
                  <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                    How were the waves?
                  </h2>

                  <SessionSlider
                    label="Overall"
                    labels={["Rough", "Meh", "Fun", "Great", "Epic"]}
                    colors={["#9CA3AF", "#F59E0B", "#EA580C"]}
                    value={formState.overallRating}
                    onChange={(v) => updateField("overallRating", v)}
                    hero
                  />

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
                    <span className="text-sm font-bold text-[#1A1A1A]">
                      Wave Types
                    </span>
                    <WaveTypeSelector
                      selectedTypes={formState.waveTypes}
                      onChange={(types) => updateField("waveTypes", types)}
                    />
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* Section 5: Forecast accuracy */}
                <section className="space-y-3">
                  <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                    Was the forecast right?
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Did the forecast match actual conditions?
                  </p>
                  <select
                    aria-label="Forecast accuracy"
                    value={formState.forecastAccuracy ?? ""}
                    onChange={(e) =>
                      updateField(
                        "forecastAccuracy",
                        e.target.value as SessionFormState["forecastAccuracy"]
                      )
                    }
                    className="w-full h-12 rounded-lg border border-gray-200 bg-white px-3 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select accuracy...</option>
                    {FORECAST_ACCURACY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.description}
                      </option>
                    ))}
                  </select>
                </section>

                <hr className="border-gray-100" />

                {/* Section 6: Photos */}
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                    Photos
                  </h2>
                  <PhotoSelectionSection
                    mode={initialMode}
                    selectedFiles={formState.photos}
                    onFilesChange={(files) => updateField("photos", files)}
                  />
                </section>

                <hr className="border-gray-100" />
              </>
            )}

            {isPlanning && (
              <>
                <hr className="border-gray-100" />

                {/* Plan mode section 2: Goals */}
                <section>
                  <GoalsSection
                    mode={initialMode}
                    formState={formState}
                    updateField={updateField}
                  />
                </section>

                <hr className="border-gray-100" />
              </>
            )}

            {/* Notes (both modes) */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                Notes
              </h2>
              <NotesSection
                mode={initialMode}
                formState={formState}
                updateField={updateField}
              />
            </section>

            <hr className="border-gray-100" />

            {/* Visibility (both modes) */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
                Visibility
              </h2>
              <VisibilitySection
                isPublic={formState.isPublic}
                isMuted={formState.isMuted}
                onPublicChange={(v) => updateField("isPublic", v)}
                onMutedChange={(v) => updateField("isMuted", v)}
              />
            </section>
          </div>
        </main>

        {/* Sticky bottom save button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#FAFAF5] border-t border-gray-100 safe-area-bottom">
          <button
            type="button"
            disabled={!canSave || loadingData}
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loadingData ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </span>
            ) : (
              `Save ${isPlanning ? "Plan" : "Session"}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
