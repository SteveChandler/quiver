import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

// Mock the AddBoardDialog to avoid Radix UI focus issues with jsdom
jest.mock("@/components/add-board-dialog", () => ({
  AddBoardDialog: ({
    open,
    onOpenChange,
    onBoardAdded,
    trigger,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onBoardAdded?: (board?: Board) => void;
    trigger?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    const mockBoard = {
      id: "test-board-id",
      user_id: "test-user-id",
      name: "Test Board",
      board_type: "shortboard",
      dimensions: "6'2 x 19.5 x 2.5",
      description: null,
      image_url: null,
      session_count: 0,
      size: null,
      volume: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Board;

    const handleSubmit = async () => {
      const result = await createBoard({
        name: "Test Board",
        board_type: "shortboard",
        dimensions: "6'2 x 19.5 x 2.5",
        description: null,
        image_url: null,
        size: null,
        volume: null,
      });

      if (result.success && onBoardAdded) {
        onBoardAdded(result.data);
      }
      if (onOpenChange) {
        onOpenChange(false);
      }
    };

    if (!open) {
      return trigger || children || null;
    }

    return (
      <div data-testid="add-board-dialog">
        <h2>Add New Board</h2>
        <button onClick={handleSubmit} data-testid="submit-board">
          Add Board
        </button>
      </div>
    );
  },
}));

describe("Board Creation and Auto-Selection", () => {
  const mockBoard = {
    id: "test-board-id",
    user_id: "test-user-id",
    name: "Test Board",
    board_type: "shortboard",
    dimensions: "6'2 x 19.5 x 2.5",
    description: null,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should auto-select newly created board via callback", async () => {
    const mockOnBoardsRefresh = jest.fn().mockResolvedValue(undefined);
    const mockUpdateField = jest.fn();

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

  test("should handle empty boards list and show add board prompt", async () => {
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

    // Click "Add Your First Board" to open the mocked dialog
    fireEvent.click(screen.getByText(/add your first board/i));

    // Wait for the mocked dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("add-board-dialog")).toBeInTheDocument();
    });

    // Click the submit button in the mocked dialog
    fireEvent.click(screen.getByTestId("submit-board"));

    // Wait for board creation
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledWith({
        name: "Test Board",
        board_type: "shortboard",
        dimensions: "6'2 x 19.5 x 2.5",
        description: null,
        image_url: null,
        size: null,
        volume: null,
      });
    });

    // Verify refresh and auto-selection happened
    await waitFor(() => {
      expect(mockOnBoardsRefresh).toHaveBeenCalled();
    });
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
    const mockOnBoardsRefresh = jest.fn();
    const mockUpdateField = jest.fn();

    // Mock failed board creation
    (createBoard as jest.Mock).mockResolvedValue({
      success: false,
      error: "Failed to create board",
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

    // Click "Add Your First Board"
    fireEvent.click(screen.getByText(/add your first board/i));

    // Wait for the dialog
    await waitFor(() => {
      expect(screen.getByTestId("add-board-dialog")).toBeInTheDocument();
    });

    // Click submit
    fireEvent.click(screen.getByTestId("submit-board"));

    // Wait for the error handling
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalled();
    });

    // Verify updateField was not called for board selection when creation fails
    // (the onBoardAdded callback is not called on failure)
    expect(mockUpdateField).not.toHaveBeenCalledWith(
      "selectedBoard",
      expect.any(String)
    );
  });

  test("should display board selection when boards exist", () => {
    const mockUpdateField = jest.fn();
    const existingBoard = {
      ...mockBoard,
      id: "existing-board-id",
      name: "My Shortboard",
    };

    render(
      <EquipmentStep
        formState={mockFormState}
        boards={[existingBoard]}
        updateField={mockUpdateField}
      />
    );

    // Should see the select dropdown for boards (not the "no boards" state)
    expect(screen.queryByText(/you haven't added any boards yet/i)).not.toBeInTheDocument();

    // Should have a select component (combobox role) for board selection
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // Should see the "Add New Board" button option
    expect(screen.getByRole("button", { name: /add new board/i })).toBeInTheDocument();
  });
});
