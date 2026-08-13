/**
 * @jest-environment jsdom
 *
 * Verifies the rating-required gate on Save in log mode. Plan mode does not
 * require a rating. Conditions (wave/wind/tide) are pre-filled but never
 * required.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type {
  SessionFormMode,
  SessionFormState,
} from "@/hooks/use-session-form";

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
  waveCharacteristics: [],
  isPublic: true,
  isMuted: false,
  selectedGoals: [],
  skillRatings: {},
  sessionDecomposition: null,
};

let currentFormState: SessionFormState = { ...defaultFormState };

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
  }),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

jest.mock("@/hooks/use-session-conditions-prefill", () => ({
  useSessionConditionsPrefill: jest.fn(),
}));

// Stub child components — we only care about the Save button's disabled state.
jest.mock("@/components/session-forms/LocationStep", () => ({
  LocationStep: () => <div />,
}));
jest.mock("@/components/session-forms/DateTimeSection", () => ({
  DateTimeSection: () => <div />,
}));
jest.mock("@/components/session-forms/EquipmentStep", () => ({
  EquipmentStep: () => <div />,
}));
jest.mock("@/components/session-forms/ConditionsSection", () => ({
  ConditionsSection: () => <div data-testid="stub-conditions" />,
}));
jest.mock("@/components/session-forms/PhotoSelectionSection", () => ({
  PhotoSelectionSection: () => <div />,
}));
jest.mock("@/components/session-forms/NotesSection", () => ({
  NotesSection: () => <div />,
}));
jest.mock("@/components/session-forms/VisibilitySection", () => ({
  VisibilitySection: () => <div />,
}));
jest.mock("@/components/session-forms/SessionSlider", () => ({
  SessionSlider: () => <div />,
}));
jest.mock("@/components/session-forms/QuickLogView", () => ({
  QuickLogView: ({ detailSections }: { detailSections: React.ReactNode }) => (
    <div data-testid="stub-quicklog">{detailSections}</div>
  ),
}));
jest.mock("@/components/ui/wave-type-selector", () => ({
  WaveTypeSelector: () => <div data-testid="stub-wavetypes" />,
}));
jest.mock("@/components/session/session-celebration", () => ({
  SessionCelebration: () => <div />,
}));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

import { SessionScrollForm } from "@/components/session-forms/SessionScrollForm";

function resetFormState(overrides: Partial<SessionFormState> = {}) {
  currentFormState = { ...defaultFormState, ...overrides };
}

function getSaveButton(container: HTMLElement): HTMLButtonElement {
  // Header button is the first button with "Save" text. We intentionally pick
  // the header one because it has the `Save` accessible name.
  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  );
  const saveButton = buttons.find((b) => b.textContent?.trim() === "Save");
  if (!saveButton) {
    throw new Error("Save button not found");
  }
  return saveButton;
}

describe("SessionScrollForm canSave gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFormState();
  });

  describe("log mode", () => {
    it("disables Save when rating is missing", () => {
      resetFormState({
        selectedBeachId: "beach-abc",
        selectedBeach: "Ocean Beach",
        overallRating: "",
      });

      const { container } = render(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getSaveButton(container).disabled).toBe(true);
    });

    it("enables Save once rating is set", () => {
      resetFormState({
        selectedBeachId: "beach-abc",
        selectedBeach: "Ocean Beach",
        overallRating: "4",
      });

      const { container } = render(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getSaveButton(container).disabled).toBe(false);
    });

    it("stays disabled when only conditions are set but rating is missing", () => {
      resetFormState({
        selectedBeachId: "beach-abc",
        selectedBeach: "Ocean Beach",
        overallRating: "",
        waveHeight: 3,
        tideStatus: "rising",
      });

      const { container } = render(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(getSaveButton(container).disabled).toBe(true);
    });

    it("includes conditions and wave type controls in quick-log details", () => {
      resetFormState({
        selectedBeachId: "beach-abc",
        selectedBeach: "Ocean Beach",
        overallRating: "4",
      });

      render(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
          quickMode
        />
      );

      expect(screen.getByTestId("stub-quicklog")).toBeInTheDocument();
      expect(screen.getByTestId("stub-conditions")).toBeInTheDocument();
      expect(screen.getByTestId("stub-wavetypes")).toBeInTheDocument();
    });

    it("renders the migrated zine palette utilities", () => {
      render(
        <SessionScrollForm
          initialMode="log"
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const form = document.querySelector(".session-scroll-form");
      expect(form).toHaveClass("bg-q-twilight");
      expect(form?.className).not.toContain("#252D6B");

      const saveButton = getSaveButton(document.body);
      expect(saveButton).toHaveClass("from-q-orange");
      expect(saveButton.className).not.toContain("#F78E42");
    });
  });

});
