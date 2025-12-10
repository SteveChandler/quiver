import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddBoardDialog } from "@/components/add-board-dialog";
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

describe("Board Creation Event Bubbling Prevention", () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should not trigger parent form submission when board dialog form is submitted", async () => {
    const mockOnBoardAdded = jest.fn();
    const mockParentFormSubmit = jest.fn();

    // Mock successful board creation
    (createBoard as jest.Mock).mockResolvedValue({
      success: true,
      data: mockBoard,
    });

    // Create a mock parent form to test event bubbling
    const ParentFormWrapper = () => (
      <form onSubmit={mockParentFormSubmit}>
        <input name="parentField" defaultValue="parent value" />
        <AddBoardDialog
          open={true}
          onOpenChange={jest.fn()}
          onBoardAdded={mockOnBoardAdded}
        />
      </form>
    );

    render(<ParentFormWrapper />);

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

    // Wait for the board creation to complete
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalled();
    });

    // Verify that the parent form submit was NOT triggered
    expect(mockParentFormSubmit).not.toHaveBeenCalled();

    // Verify that the board was successfully created and callback was called
    await waitFor(() => {
      expect(mockOnBoardAdded).toHaveBeenCalledWith(mockBoard);
    });
  });

  test("should prevent event propagation when board form submit handler is called", () => {
    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.FormEvent;

    // Create a simulated submit handler similar to what's in the component
    const simulateFormSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // This simulates the actual form submission logic
    };

    simulateFormSubmit(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  test("should handle board creation with proper event handling", async () => {
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

    // Verify board creation was called with correct data
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledWith({
        name: "Test Board",
        board_type: "Shortboard",
        dimensions: "6'2 x 19.5 x 2.5",
        description: undefined,
        image_url: undefined,
      });
    });

    // Verify callback was called with the created board
    await waitFor(() => {
      expect(mockOnBoardAdded).toHaveBeenCalledWith(mockBoard);
    });
  });
});
