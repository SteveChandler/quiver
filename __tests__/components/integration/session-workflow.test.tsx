import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionForm } from "@/components/session-forms/SessionForm";
import { SessionAnnotationModal } from "@/components/journal/session-annotation-modal";
import {
  renderWithProviders,
  mockSession,
  mockBeach,
  createMockSupabaseClient,
} from "@/__tests__/setup/test-utils";

// Mock the required modules
jest.mock("@/lib/supabase/client");

jest.mock("@/actions/session-actions", () => ({
  createSession: jest.fn(),
  updateSession: jest.fn(),
  convertPlannedToCompleted: jest.fn(),
}));

jest.mock("@/actions/session-media-actions", () => ({
  uploadSessionPhotosAction: jest.fn(),
  getSessionPhotosAction: jest.fn(),
  deleteSessionPhotoAction: jest.fn(),
  updatePhotoCaptionAction: jest.fn(),
}));

jest.mock("@/actions/beach-actions", () => ({
  getBeachById: jest.fn(),
  getBeaches: jest.fn(),
}));

jest.mock("@/hooks/use-session-form", () => ({
  useSessionForm: jest.fn(),
}));

jest.mock("@/hooks/use-beach-search", () => ({
  useBeachSearch: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/lib/constants/session-form-constants", () => ({
  getFormText: jest.fn(() => ({
    location: "Where will you surf?",
    dateTime: "When will you surf?",
    equipment: "Which board will you use?",
    goals: "What are your goals?",
    notes: "Notes & Invite Friends",
    submitButton: "Plan Session",
    successMessage: "Session planned successfully!",
    finishMessage: "You can now finish by going to your profile.",
  })),
  getModeStyles: jest.fn(() => ({
    headerBg: "bg-blue-50",
    headerText: "text-blue-800",
    headerBorder: "border-blue-200",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
  })),
  DURATION_OPTIONS: [
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
  ],
  SKILL_GOALS: ["Pop-ups", "Cutbacks", "Reading Waves"],
  RATING_DESCRIPTIONS: {
    waveQuality: {
      1: "Poor - Blown out/Flat",
      3: "Average - Decent waves",
      5: "Excellent - Epic session",
    },
    crowdLevel: {
      1: "Empty - Solo session",
      3: "Moderate - Some crowd",
      5: "Packed - Very crowded",
    },
  },
}));

// Mock Next.js components
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: "/",
  }),
  usePathname: () => "/",
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    toString: jest.fn(),
  }),
}));

describe("Session Workflow Integration Tests", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    full_name: "Test User",
  };

  // Setup Supabase mock
  beforeAll(() => {
    const {
      createMockSupabaseClient,
    } = require("@/__tests__/setup/test-utils");
    require("@/lib/supabase/client").supabase = createMockSupabaseClient();
  });

  const mockBeachWithDetails = {
    ...mockBeach,
    forecasts: [
      {
        id: "forecast-1",
        beach_id: mockBeach.id,
        forecast_date: "2024-01-01",
        forecast_time: "06:00",
        wave_height: "3-4 ft",
        water_temp: "65°F",
        wind_speed: "10 mph",
        wind_direction: "SW",
        tide: "High",
        weather_condition: "Sunny",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
  };

  const mockSessionWithDetails = {
    ...mockSession,
    beach: mockBeachWithDetails,
    board: {
      id: "board-1",
      name: "Test Board",
      length: "9'0\"",
      width: '22.5"',
      thickness: '2.75"',
      volume: "55L",
      type: "longboard",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful session creation
    const {
      createSession,
      updateSession,
      convertPlannedToCompleted,
    } = require("@/actions/session-actions");
    createSession.mockResolvedValue({
      success: true,
      data: { id: "new-session-id" },
    });
    updateSession.mockResolvedValue({ success: true });
    convertPlannedToCompleted.mockResolvedValue({ success: true });

    // Mock successful photo upload
    const {
      uploadSessionPhotosAction,
      getSessionPhotosAction,
    } = require("@/actions/session-media-actions");
    uploadSessionPhotosAction.mockResolvedValue({
      success: true,
      data: { uploaded: 2, failed: 0 },
    });
    getSessionPhotosAction.mockResolvedValue({
      success: true,
      data: [
        {
          id: "photo-1",
          session_id: "new-session-id",
          user_id: mockUser.id,
          public_url: "https://example.com/photo1.jpg",
          storage_path: "sessions/photo1.jpg",
          caption: "Great waves!",
          file_size: 1024000,
          created_at: "2024-01-01T10:00:00Z",
        },
      ],
    });

    // Mock beach search
    const { getBeachById, getBeaches } = require("@/actions/beach-actions");
    getBeachById.mockResolvedValue({
      success: true,
      data: mockBeachWithDetails,
    });
    getBeaches.mockResolvedValue({
      success: true,
      data: [mockBeachWithDetails],
    });

    // Mock form hooks
    const { useSessionForm } = require("@/hooks/use-session-form");
    useSessionForm.mockReturnValue({
      formState: {
        beach: mockBeachWithDetails,
        arrivalDate: "2024-01-01",
        arrivalTime: "10:00",
        duration: 120,
        notes: "",
        isPublic: true,
        rating: 0,
        waveHeight: null,
        waterTemp: null,
        crowdLevel: null,
        parkingEase: null,
        windConditions: null,
        selectedBoard: null,
        invitees: [],
        selectedPhotos: [],
      },
      updateField: jest.fn(),
      setFormState: jest.fn(),
      resetForm: jest.fn(),
    });

    // Mock beach search hook
    const { useBeachSearch } = require("@/hooks/use-beach-search");
    useBeachSearch.mockReturnValue({
      beaches: [mockBeachWithDetails],
      loading: false,
      error: null,
      searchBeaches: jest.fn(),
      selectBeach: jest.fn(),
      clearSearch: jest.fn(),
    });

    // Mock data fetcher
    const { useDataFetcher } = require("@/hooks/use-data-fetcher");
    useDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe("Complete Session Planning to Completion Workflow", () => {
    it("should handle complete session workflow from planning to completion with photos", async () => {
      const user = userEvent.setup();

      // Step 1: Render session form in planning mode
      const { rerender } = renderWithProviders(
        <SessionForm initialMode="plan" />,
        { user: mockUser }
      );

      // Step 2: Fill out session planning form
      await waitFor(() => {
        expect(screen.getByText(/plan your session/i)).toBeInTheDocument();
      });

      // Select beach
      const beachSelect = screen.getByRole("combobox", { name: /beach/i });
      await user.click(beachSelect);
      await user.type(beachSelect, "Ocean Beach");

      // Select date and time
      const dateInput = screen.getByLabelText(/date/i);
      await user.clear(dateInput);
      await user.type(dateInput, "2024-01-01");

      const timeInput = screen.getByLabelText(/time/i);
      await user.clear(timeInput);
      await user.type(timeInput, "10:00");

      // Add notes
      const notesInput = screen.getByRole("textbox", { name: /notes/i });
      await user.type(notesInput, "Planning to catch some morning waves");

      // Step 3: Save planned session
      const saveButton = screen.getByRole("button", { name: /save plan/i });
      await user.click(saveButton);

      await waitFor(() => {
        const { createSession } = require("@/actions/session-actions");
        expect(createSession).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "planned",
            beach_id: mockBeachWithDetails.id,
            user_id: mockUser.id,
            notes: "Planning to catch some morning waves",
          })
        );
      });

      // Step 4: Convert to completed session (session form conversion)
      rerender(<SessionForm initialMode="log" />);

      await waitFor(() => {
        expect(screen.getByText(/log your session/i)).toBeInTheDocument();
      });

      // Add session details
      const ratingStars = screen.getAllByRole("button", { name: /star/i });
      await user.click(ratingStars[3]); // 4 stars

      const waveHeightInput = screen.getByLabelText(/wave height/i);
      await user.type(waveHeightInput, "4");

      const waterTempInput = screen.getByLabelText(/water temperature/i);
      await user.type(waterTempInput, "65");

      // Add photos (mock file upload)
      const photoUpload = screen.getByLabelText(/photos/i);
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      await user.upload(photoUpload, mockFile);

      // Step 5: Complete session
      const completeButton = screen.getByRole("button", {
        name: /complete session/i,
      });
      await user.click(completeButton);

      await waitFor(() => {
        const {
          convertPlannedToCompleted,
        } = require("@/actions/session-actions");
        expect(convertPlannedToCompleted).toHaveBeenCalled();
      });

      // Step 6: Open session annotation modal
      const annotateButton = screen.getByRole("button", { name: /annotate/i });
      await user.click(annotateButton);

      // Step 7: Test annotation modal functionality
      await waitFor(() => {
        expect(
          screen.getByText(/session details & annotations/i)
        ).toBeInTheDocument();
      });

      // Add session notes
      const sessionNotesInput = screen.getByRole("textbox", {
        name: /session notes/i,
      });
      await user.type(
        sessionNotesInput,
        "Amazing session! The waves were perfect and the water was warm."
      );

      // Update rating
      const modalRatingStars = screen.getAllByRole("button", { name: /star/i });
      await user.click(modalRatingStars[4]); // 5 stars

      // Toggle privacy
      const privacyToggle = screen.getByRole("switch", { name: /privacy/i });
      await user.click(privacyToggle);

      // Step 8: Upload additional photos in modal
      const addPhotoButton = screen.getByRole("button", { name: /add photo/i });
      await user.click(addPhotoButton);

      await waitFor(() => {
        expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
      });

      // Step 9: Save annotation changes
      const saveChangesButton = screen.getByRole("button", {
        name: /save changes/i,
      });
      await user.click(saveChangesButton);

      await waitFor(() => {
        const { updateSession } = require("@/actions/session-actions");
        expect(updateSession).toHaveBeenCalledWith(
          "new-session-id",
          mockUser.id,
          expect.objectContaining({
            notes:
              "Amazing session! The waves were perfect and the water was warm.",
            rating: 5,
            is_public: false,
          })
        );
      });

      // Verify success messages
      const { toast } = require("sonner");
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Session completed")
      );
    });

    it("should handle session conversion from planned to completed", async () => {
      const user = userEvent.setup();

      // Mock existing planned session
      const plannedSession = {
        ...mockSessionWithDetails,
        status: "planned",
        rating: null,
        wave_height: null,
        water_temp: null,
      };

      renderWithProviders(
        <SessionForm initialMode="convert" plannedSession={plannedSession} />,
        { user: mockUser }
      );

      await waitFor(() => {
        expect(screen.getByText(/complete your session/i)).toBeInTheDocument();
      });

      // Fill out completion details
      const ratingStars = screen.getAllByRole("button", { name: /star/i });
      await user.click(ratingStars[3]); // 4 stars

      const durationInput = screen.getByLabelText(/duration/i);
      await user.clear(durationInput);
      await user.type(durationInput, "90");

      const notesInput = screen.getByRole("textbox", { name: /notes/i });
      await user.type(notesInput, "Shorter session but great waves!");

      // Complete the session
      const completeButton = screen.getByRole("button", {
        name: /complete session/i,
      });
      await user.click(completeButton);

      await waitFor(() => {
        const {
          convertPlannedToCompleted,
        } = require("@/actions/session-actions");
        expect(convertPlannedToCompleted).toHaveBeenCalledWith(
          plannedSession.id,
          mockUser.id,
          expect.objectContaining({
            rating: 4,
            duration_minutes: 90,
            notes: "Shorter session but great waves!",
          })
        );
      });
    });

    it("should handle error states gracefully", async () => {
      const user = userEvent.setup();

      // Mock session creation failure
      const { createSession } = require("@/actions/session-actions");
      createSession.mockResolvedValue({
        success: false,
        error: "Failed to create session",
      });

      renderWithProviders(<SessionForm initialMode="plan" />, {
        user: mockUser,
      });

      // Fill out form
      const beachSelect = screen.getByRole("combobox", { name: /beach/i });
      await user.click(beachSelect);
      await user.type(beachSelect, "Ocean Beach");

      const dateInput = screen.getByLabelText(/date/i);
      await user.type(dateInput, "2024-01-01");

      // Try to save
      const saveButton = screen.getByRole("button", { name: /save plan/i });
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        const { toast } = require("sonner");
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to create session")
        );
      });
    });
  });

  describe("Session Annotation Modal Integration", () => {
    it("should handle photo upload and gallery interactions", async () => {
      const user = userEvent.setup();

      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      renderWithProviders(
        <SessionAnnotationModal
          session={mockSessionWithDetails}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
        { user: mockUser }
      );

      await waitFor(() => {
        expect(
          screen.getByText(/session details & annotations/i)
        ).toBeInTheDocument();
      });

      // Test photo upload
      const addPhotoButton = screen.getByRole("button", { name: /add photo/i });
      await user.click(addPhotoButton);

      await waitFor(() => {
        expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
      });

      // Test that Add Photo button is available and click it
      expect(addPhotoButton).toBeInTheDocument();
      await user.click(addPhotoButton);

      // The SessionAnnotationModal just shows the UI, actual upload functionality
      // would be tested in the component-specific tests

      // Test photo gallery interactions
      await waitFor(() => {
        expect(screen.getByText(/great waves!/i)).toBeInTheDocument();
      });

      // Test photo caption editing
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Test that the edit functionality is available - for this integration test
      // we'll just verify the edit button works, detailed caption editing would be
      // tested in the component-specific tests
      expect(editButton).toBeInTheDocument();

      const saveCaptionButton = screen.getByRole("button", {
        name: /save caption/i,
      });
      await user.click(saveCaptionButton);

      await waitFor(() => {
        const {
          updatePhotoCaptionAction,
        } = require("@/actions/session-media-actions");
        expect(updatePhotoCaptionAction).toHaveBeenCalledWith(
          "photo-1",
          "Updated caption"
        );
      });
    });

    it("should validate form inputs and show appropriate feedback", async () => {
      const user = userEvent.setup();

      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      renderWithProviders(
        <SessionAnnotationModal
          session={mockSessionWithDetails}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
        { user: mockUser }
      );

      // Test that session details are displayed
      expect(screen.getByText("Test Beach")).toBeInTheDocument();
      expect(screen.getByText("Monday, January 1, 2024")).toBeInTheDocument();

      // Test notes input
      const notesInput = screen.getByRole("textbox");
      await user.type(notesInput, "This session was absolutely incredible!");

      // Test privacy toggle
      const privacyToggle = screen.getByRole("switch", {
        name: /public session/i,
      });
      await user.click(privacyToggle);

      // Save changes
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        const { updateSession } = require("@/actions/session-actions");
        expect(updateSession).toHaveBeenCalledWith(
          mockSessionWithDetails.id,
          mockUser.id,
          expect.objectContaining({
            notes: "This session was absolutely incredible!",
            rating: 5,
            is_public: false,
          })
        );
      });

      expect(mockOnSave).toHaveBeenCalled();
    });
  });
});
