/**
 * @jest-environment jsdom
 *
 * Unit tests for the session log funnel telemetry added in commit eb675fd
 * ("feat(sessions): session log funnel + Supabase bookends").
 *
 * Strategy: mock useSessionForm entirely via a controllable ref so tests can
 * mutate formState between renders, and stub every child component so we
 * don't pull in forecast / photo / celebration infrastructure. All we care
 * about is what the telemetry effects in SessionScrollForm.tsx emit.
 */

import React from "react";
import { render, act, fireEvent, screen } from "@testing-library/react";
import type {
  SessionFormMode,
  SessionFormState,
} from "@/hooks/use-session-form";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

// Controllable useSessionForm mock. Tests mutate `currentFormState` and then
// trigger a rerender so the hook returns the updated state.
const defaultFormState: SessionFormState = {
  selectedBeach: "",
  selectedBeachId: "",
  selectedDate: "2026-04-06",
  selectedTime: "06:00",
  selectedBoard: "",
  boardId: undefined,
  duration: "60m",
  waveQuality: "",
  waterTemp: "",
  crowdLevel: "",
  parkingEase: "",
  overallRating: "",
  notes: "",
  photos: [],
  waveTypes: [],
  isPublic: true,
  isMuted: false,
  invitees: [],
  selectedGoals: [],
  skillRatings: {},
};

let currentFormState: SessionFormState = { ...defaultFormState };
let currentIsPlanning = false;

jest.mock("@/hooks/use-session-form", () => ({
  useSessionForm: ({ initialMode }: { initialMode: SessionFormMode }) => ({
    mode: initialMode,
    setMode: jest.fn(),
    step: 1,
    setStep: jest.fn(),
    nextStep: jest.fn(),
    prevStep: jest.fn(),
    loading: false,
    setLoading: jest.fn(),
    boards: [],
    beaches: [],
    loadingData: false,
    formState: currentFormState,
    updateField: jest.fn(),
    resetForm: jest.fn(),
    refreshBoards: jest.fn(),
    isPlanning: currentIsPlanning,
  }),
}));

// Stub every child component — the telemetry logic lives entirely in
// SessionScrollForm's own effects, so the children are irrelevant.
jest.mock("@/components/session-forms/LocationStep", () => ({
  LocationStep: () => <div data-testid="stub-location" />,
}));
jest.mock("@/components/session-forms/DateTimeSection", () => ({
  DateTimeSection: () => <div data-testid="stub-datetime" />,
}));
jest.mock("@/components/session-forms/EquipmentStep", () => ({
  EquipmentStep: () => <div data-testid="stub-equipment" />,
}));
jest.mock("@/components/session-forms/ConditionsSection", () => ({
  ConditionsSection: () => <div data-testid="stub-conditions" />,
}));
jest.mock("@/components/session-forms/PhotoSelectionSection", () => ({
  PhotoSelectionSection: () => <div data-testid="stub-photo" />,
}));
jest.mock("@/components/session-forms/NotesSection", () => ({
  NotesSection: () => <div data-testid="stub-notes" />,
}));
jest.mock("@/components/session-forms/GoalsSection", () => ({
  GoalsSection: () => <div data-testid="stub-goals" />,
}));
jest.mock("@/components/session-forms/VisibilitySection", () => ({
  VisibilitySection: () => <div data-testid="stub-visibility" />,
}));
jest.mock("@/components/session-forms/SessionSlider", () => ({
  SessionSlider: () => <div data-testid="stub-slider" />,
}));
jest.mock("@/components/session-forms/QuickLogView", () => ({
  QuickLogView: () => <div data-testid="stub-quicklog" />,
}));
jest.mock("@/components/ui/wave-type-selector", () => ({
  WaveTypeSelector: () => <div data-testid="stub-wavetypes" />,
}));
jest.mock("@/components/session/session-celebration", () => ({
  SessionCelebration: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="stub-celebration">
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
}));

// Auth context is imported indirectly via use-session-form, but since we
// mocked the hook, we don't need it. Still, stub it defensively.
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

// Import AFTER mocks so the component picks them up.
import { SessionScrollForm } from "@/components/session-forms/SessionScrollForm";

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetFormState(overrides: Partial<SessionFormState> = {}) {
  currentFormState = { ...defaultFormState, ...overrides };
}

function getEvents(eventType: string) {
  return mockTrack.mock.calls.filter((call) => call[0] === eventType);
}

type TestProps = React.ComponentProps<typeof SessionScrollForm>;

function renderForm(props: Partial<TestProps> = {}) {
  const defaults: TestProps = {
    initialMode: "log",
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  };
  return render(<SessionScrollForm {...defaults} {...props} />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SessionScrollForm telemetry", () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetFormState();
    currentIsPlanning = false;
    // Deterministic Date.now so duration_ms assertions are stable.
    let current = 1_000_000;
    nowSpy = jest.spyOn(Date, "now").mockImplementation(() => {
      const value = current;
      current += 1_000;
      return value;
    });
  });

  afterEach(() => {
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  describe("session_log_start", () => {
    it("fires exactly once per log-mode mount when prefilled with a beach", () => {
      resetFormState({
        selectedBeachId: "beach-abc",
        selectedBeach: "Ocean Beach",
      });

      const { rerender } = renderForm();

      const startEvents = getEvents("session_log_start");
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0][1]).toEqual({
        beachId: "beach-abc",
        metadata: { beach_id: "beach-abc" },
      });

      // Re-render with the same state — start must not fire a second time.
      rerender(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getEvents("session_log_start")).toHaveLength(1);
    });

    it("does NOT fire in plan mode", () => {
      currentIsPlanning = true;
      resetFormState({
        selectedBeachId: "beach-abc",
        selectedBeach: "Ocean Beach",
      });

      renderForm({ initialMode: "plan" });

      expect(getEvents("session_log_start")).toHaveLength(0);
      expect(getEvents("session_log_beach_selected")).toHaveLength(0);
    });
  });

  describe("session_log_beach_selected", () => {
    it("fires when a beach is first selected and again when beach changes", () => {
      // Start with no beach.
      resetFormState();
      const { rerender } = renderForm();

      expect(getEvents("session_log_beach_selected")).toHaveLength(0);

      // User picks first beach.
      act(() => {
        resetFormState({ selectedBeachId: "beach-1" });
      });
      rerender(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      let beachEvents = getEvents("session_log_beach_selected");
      expect(beachEvents).toHaveLength(1);
      expect(beachEvents[0][1]).toEqual({
        beachId: "beach-1",
        metadata: { beach_id: "beach-1" },
      });

      // Re-render with same beach — should NOT re-fire.
      rerender(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      expect(getEvents("session_log_beach_selected")).toHaveLength(1);

      // User switches to a different beach.
      act(() => {
        resetFormState({ selectedBeachId: "beach-2" });
      });
      rerender(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      beachEvents = getEvents("session_log_beach_selected");
      expect(beachEvents).toHaveLength(2);
      expect(beachEvents[1][1]).toEqual({
        beachId: "beach-2",
        metadata: { beach_id: "beach-2" },
      });
    });
  });

  describe("session_log_abandon", () => {
    it("fires on unmount with abandon_via: 'unmount' and duration_ms >= 0", () => {
      resetFormState({ selectedBeachId: "beach-xyz" });
      const { unmount } = renderForm();

      expect(getEvents("session_log_abandon")).toHaveLength(0);

      unmount();

      const abandonEvents = getEvents("session_log_abandon");
      expect(abandonEvents).toHaveLength(1);
      const [eventType, payload] = abandonEvents[0];
      expect(eventType).toBe("session_log_abandon");
      expect(payload.beachId).toBe("beach-xyz");
      expect(payload.metadata.abandon_via).toBe("unmount");
      expect(typeof payload.metadata.duration_ms).toBe("number");
      expect(payload.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("does NOT fire abandon if the form was opened in plan mode", () => {
      currentIsPlanning = true;
      resetFormState({ selectedBeachId: "beach-xyz" });
      const { unmount } = renderForm({ initialMode: "plan" });

      unmount();

      expect(getEvents("session_log_abandon")).toHaveLength(0);
    });

    it("carries max_step_reached reflecting the deepest step (beach_select)", () => {
      // Mount with no beach so hasTrackedOpenRef flips but maxStepReached stays "none".
      resetFormState();
      const { rerender, unmount } = renderForm();

      // Select a beach — promotes max_step_reached to "beach_select".
      act(() => {
        resetFormState({ selectedBeachId: "beach-1" });
      });
      rerender(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      unmount();

      const abandonEvents = getEvents("session_log_abandon");
      expect(abandonEvents).toHaveLength(1);
      expect(abandonEvents[0][1].metadata.max_step_reached).toBe("beach_select");
    });

    it("carries max_step_reached = 'rating' after a rating is set", () => {
      resetFormState({ selectedBeachId: "beach-1" });
      const { rerender, unmount } = renderForm();

      act(() => {
        resetFormState({ selectedBeachId: "beach-1", overallRating: "4" });
      });
      rerender(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Let the 500ms debounce fire so the rating effect runs.
      act(() => {
        jest.advanceTimersByTime(600);
      });

      unmount();

      const abandonEvents = getEvents("session_log_abandon");
      expect(abandonEvents).toHaveLength(1);
      expect(abandonEvents[0][1].metadata.max_step_reached).toBe("rating");
    });

    it("does NOT fire twice if cancel button was clicked before unmount", () => {
      const onCancel = jest.fn();
      resetFormState({ selectedBeachId: "beach-1" });
      const { unmount } = renderForm({ onCancel });

      // Click the cancel button in the sticky header.
      const cancelBtn = screen.getByLabelText("Cancel");
      fireEvent.click(cancelBtn);

      // First abandon event fires from handleCancel with abandon_via: 'cancel_button'.
      let abandonEvents = getEvents("session_log_abandon");
      expect(abandonEvents).toHaveLength(1);
      expect(abandonEvents[0][1].metadata.abandon_via).toBe("cancel_button");
      expect(onCancel).toHaveBeenCalledTimes(1);

      // Unmount after cancel — should NOT fire a second abandon.
      unmount();

      abandonEvents = getEvents("session_log_abandon");
      expect(abandonEvents).toHaveLength(1);
    });

    it("does NOT fire abandon when hasSubmittedRef is set via celebration dismiss", () => {
      const onComplete = jest.fn();
      // canSave requires selectedBeachId + selectedDate; both present.
      resetFormState({
        selectedBeachId: "beach-1",
        selectedDate: "2026-04-06",
      });
      const { unmount } = renderForm({ onComplete });

      // Click the header Save button to open the celebration overlay.
      // There are two save affordances (header + sticky bottom) — pick the first.
      const saveBtns = screen.getAllByRole("button", { name: /save/i });
      fireEvent.click(saveBtns[0]);

      // The celebration stub exposes a dismiss button which triggers
      // handleCelebrationDismiss → sets hasSubmittedRef.current = true.
      const dismissBtn = screen.getByText("dismiss");
      fireEvent.click(dismissBtn);

      expect(onComplete).toHaveBeenCalledTimes(1);

      unmount();

      expect(getEvents("session_log_abandon")).toHaveLength(0);
    });
  });
});
