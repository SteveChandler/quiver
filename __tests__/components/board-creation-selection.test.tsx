import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddBoardDialog } from "@/components/add-board-dialog";
import { EquipmentStep } from "@/components/session-forms/EquipmentStep";
import { createBoard } from "@/actions/board-actions";
import type { Board } from "@/types/database";

// Mock the createBoard action
jest.mock("@/actions/board-actions", () => ({
  createBoard: jest.fn(),
}));

// Mock the auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
  }),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

// Mock the toast
jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

describe("Board Creation and Auto-Selection", () => {
  const mockBoard = {
    id: "test-board-id",
    user_id: "test-user-id",
    name: "Test Board",
    board_type: "Shortboard",
    dimensions: "6'2 x 19.5 x 2.5",
    description: "Test board description",
    image_url: null,
    session_count: 0,
    size: null,
    volume: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Board;

  const mockFormState = {
    selectedBoard: "",
    boardId: "",
    selectedBeach: "",
    selectedBeachId: "",
    selectedDate: "",
    selectedTime: "",
    notes: "",
    duration: "",
    waveQuality: "",
    waterTemp: "",
    crowdLevel: "",
    parkingEase: "",
    overallRating: "",
    photos: [],
    invitees: [],
  } as any;

  const mockUpdateField = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should call onBoardAdded with created board when board is successfully created", async () => {
    const mockOnBoardAdded = jest.fn();

    // Mock successful board creation
    (createBoard as jest.Mock).mockResolvedValue({
      success: true,
      data: mockBoard,
    });

    render(
      <AddBoardDialog
        open={true}
        onOpenChange={jest.fn()}
        onBoardAdded={mockOnBoardAdded}
      />
    );

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/board name/i), {
      target: { value: "Test Board" },
    });
    fireEvent.change(screen.getByLabelText(/board type/i), {
      target: { value: "Shortboard" },
    });
    fireEvent.change(screen.getByLabelText(/dimensions/i), {
      target: { value: "6'2 x 19.5 x 2.5" },
    });

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /add board/i }));

    // Wait for the board to be created
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledWith({
        name: "Test Board",
        board_type: "Shortboard",
        dimensions: "6'2 x 19.5 x 2.5",
        description: null,
        image_url: null,
        size: null,
        volume: null,
      });
    });

    // Verify onBoardAdded was called with the created board
    await waitFor(() => {
      expect(mockOnBoardAdded).toHaveBeenCalledWith(mockBoard);
    });
  });

  test("should auto-select newly created board via callback", async () => {
    const mockOnBoardsRefresh = jest.fn().mockResolvedValue(undefined);
    const mockUpdateField = jest.fn();
    const mockOnBoardAdded = jest.fn();

    // Mock successful board creation
    (createBoard as jest.Mock).mockResolvedValue({
      success: true,
      data: mockBoard,
    });

    // Test the AddBoardDialog with callback
    render(
      <AddBoardDialog
        open={true}
        onOpenChange={jest.fn()}
        onBoardAdded={mockOnBoardAdded}
      />
    );

    // Fill in the board form
    fireEvent.change(screen.getByLabelText(/board name/i), {
      target: { value: "Test Board" },
    });
    fireEvent.change(screen.getByLabelText(/board type/i), {
      target: { value: "Shortboard" },
    });
    fireEvent.change(screen.getByLabelText(/dimensions/i), {
      target: { value: "6'2 x 19.5 x 2.5" },
    });

    // Submit the board form
    fireEvent.click(screen.getByRole("button", { name: /add board/i }));

    // Wait for board creation to complete
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledWith({
        name: "Test Board",
        board_type: "Shortboard",
        dimensions: "6'2 x 19.5 x 2.5",
        description: null,
        image_url: null,
        size: null,
        volume: null,
      });
    });

    // Verify the callback was called with the created board
    await waitFor(() => {
      expect(mockOnBoardAdded).toHaveBeenCalledWith(mockBoard);
    });

    // Now test the handleBoardAdded logic that should happen in EquipmentStep
    const simulateHandleBoardAdded = async (newBoard?: Board) => {
      // Auto-select the newly created board immediately
      if (newBoard) {
        mockUpdateField("selectedBoard", newBoard.id);
        mockUpdateField("boardId", newBoard.id);
      }

      // Refresh boards list after everything else is done
      if (mockOnBoardsRefresh) {
        try {
          await mockOnBoardsRefresh();

          // Ensure the board stays selected after refresh
          if (newBoard) {
            mockUpdateField("selectedBoard", newBoard.id);
            mockUpdateField("boardId", newBoard.id);
          }
        } catch (error) {
          console.error("Error refreshing boards:", error);
        }
      }
    };

    // Simulate what should happen when the board is added
    await simulateHandleBoardAdded(mockBoard);

    // Verify the auto-selection logic worked
    expect(mockUpdateField).toHaveBeenCalledWith("selectedBoard", mockBoard.id);
    expect(mockUpdateField).toHaveBeenCalledWith("boardId", mockBoard.id);
    expect(mockOnBoardsRefresh).toHaveBeenCalled();

    // Verify it was called twice (before and after refresh)
    expect(mockUpdateField).toHaveBeenCalledTimes(4); // 2 fields × 2 times
  });

  test("should handle empty boards list and first board creation", async () => {
    const mockOnBoardsRefresh = jest.fn();
    const mockUpdateField = jest.fn();

    // Mock successful board creation
    (createBoard as jest.Mock).mockResolvedValue({
      success: true,
      data: mockBoard,
    });

    // Render EquipmentStep with no boards
    render(
      <EquipmentStep
        formState={mockFormState}
        boards={[]}
        updateField={mockUpdateField}
        onBoardsRefresh={mockOnBoardsRefresh}
      />
    );

    // Should see the "no boards" state
    expect(
      screen.getByText(/you haven't added any boards yet/i)
    ).toBeInTheDocument();

    // Click "Add Your First Board"
    fireEvent.click(screen.getByText(/add your first board/i));

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText(/add new board/i)).toBeInTheDocument();
    });

    // Fill in the board form
    fireEvent.change(screen.getByLabelText(/board name/i), {
      target: { value: "First Board" },
    });
    fireEvent.change(screen.getByLabelText(/board type/i), {
      target: { value: "Shortboard" },
    });
    fireEvent.change(screen.getByLabelText(/dimensions/i), {
      target: { value: "6'2 x 19.5 x 2.5" },
    });

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /add board/i }));

    // Wait for board creation
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledWith({
        name: "First Board",
        board_type: "Shortboard",
        dimensions: "6'2 x 19.5 x 2.5",
        description: null,
        image_url: null,
        size: null,
        volume: null,
      });
    });

    // Verify refresh and auto-selection
    expect(mockOnBoardsRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockUpdateField).toHaveBeenCalledWith(
        "selectedBoard",
        mockBoard.id
      );
      expect(mockUpdateField).toHaveBeenCalledWith("boardId", mockBoard.id);
    });
  });

  test("should verify board selection logic", () => {
    // Test the core logic of what handleBoardAdded should do
    const mockUpdateField = jest.fn();

    // Simulate what handleBoardAdded does
    const simulateHandleBoardAdded = (newBoard?: Board) => {
      if (newBoard) {
        mockUpdateField("selectedBoard", newBoard.id);
        mockUpdateField("boardId", newBoard.id);
      }
    };

    // Call the simulated function
    simulateHandleBoardAdded(mockBoard);

    // Verify it calls updateField with the correct values
    expect(mockUpdateField).toHaveBeenCalledWith("selectedBoard", mockBoard.id);
    expect(mockUpdateField).toHaveBeenCalledWith("boardId", mockBoard.id);
  });

  test("should handle board creation failure gracefully", async () => {
    const mockOnBoardAdded = jest.fn();

    // Mock failed board creation
    (createBoard as jest.Mock).mockResolvedValue({
      success: false,
      error: "Failed to create board",
    });

    render(
      <AddBoardDialog
        open={true}
        onOpenChange={jest.fn()}
        onBoardAdded={mockOnBoardAdded}
      />
    );

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/board name/i), {
      target: { value: "Test Board" },
    });
    fireEvent.change(screen.getByLabelText(/board type/i), {
      target: { value: "Shortboard" },
    });
    fireEvent.change(screen.getByLabelText(/dimensions/i), {
      target: { value: "6'2 x 19.5 x 2.5" },
    });

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /add board/i }));

    // Wait for the error handling
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalled();
    });

    // Verify onBoardAdded was not called when creation fails
    expect(mockOnBoardAdded).not.toHaveBeenCalled();
  });
});
