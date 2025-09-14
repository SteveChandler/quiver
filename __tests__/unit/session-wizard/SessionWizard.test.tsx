import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionWizard } from "@/components/session/wizard/SessionWizard";

// Mock auth to provide a user
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock use-session-form to control wizard form state
jest.mock("@/hooks/use-session-form", () => {
  const formState = {
    selectedBeach: "Test Beach",
    selectedBeachId: "1",
    selectedDate: "2024-01-01",
    selectedTime: "06:00",
    boardId: "",
    notes: "",
    duration: "60m",
    waveQuality: "",
    waterTemp: "",
    crowdLevel: "",
    parkingEase: "",
    overallRating: "",
  };
  return {
    useSessionForm: () => ({
      mode: "plan",
      setMode: jest.fn(),
      loading: false,
      formState,
      updateField: jest.fn(),
      errors: {},
      reset: jest.fn(),
      boards: [],
      beaches: [{ id: "1", name: "Test Beach" }],
      refreshBoards: jest.fn(),
      isPlanning: true,
      setLoading: jest.fn(),
    }),
  };
});

// Mock step components used by AnimatedSessionWizard
jest.mock("@/components/session-forms/LocationStep", () => ({
  LocationStep: () => <div data-testid="location-step">Location Step</div>,
}));

jest.mock("@/components/session-forms/DateTimeSection", () => ({
  DateTimeSection: () => (
    <div data-testid="datetime-step">DateTime Section</div>
  ),
}));

jest.mock("@/components/session-forms/EquipmentStep", () => ({
  EquipmentStep: () => <div data-testid="equipment-step">Equipment Step</div>,
}));

jest.mock("@/components/session-forms/GoalsSection", () => ({
  GoalsSection: () => <div data-testid="goals-step">Goals Section</div>,
}));

jest.mock("@/components/session-forms/ConditionsSection", () => ({
  ConditionsSection: () => (
    <div data-testid="conditions-step">Conditions Section</div>
  ),
}));

jest.mock("@/components/session-forms/PhotoSelectionSection", () => ({
  PhotoSelectionSection: () => (
    <div data-testid="photos-step">Photo Selection Section</div>
  ),
}));

jest.mock("@/components/session-forms/NotesSection", () => ({
  NotesSection: () => <div data-testid="notes-step">Notes Section</div>,
}));

describe("SessionWizard (aligned)", () => {
  it("renders initial step header and progress", () => {
    render(<SessionWizard mode="plan" />);
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });

  it("shows Next and disables Previous on first step", () => {
    render(<SessionWizard mode="plan" />);
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    // Previous button is disabled on first step
    const prev = screen.getByRole("button", { name: /previous/i });
    expect(prev).toBeDisabled();
  });

  it("navigates to next step on Next click when valid", async () => {
    const user = userEvent.setup();
    render(<SessionWizard mode="plan" />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    // Wait for transition to step 2
    await screen.findByText(/Step 2 of 4/i);
    expect(screen.getByText(/When/i)).toBeInTheDocument();
  });
});
