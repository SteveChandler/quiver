import { render, screen, fireEvent } from "@testing-library/react";
import { EditProfileModal } from "@/components/edit-profile-modal";

// Mock profile data
const mockProfile = {
  id: "test-user-id",
  full_name: "Test User",
  avatar_url: "/test-avatar.jpg",
  bio: "Test bio",
  location: "Test location",
  experience_level: "Intermediate",
  favorite_spot: "Test Beach",
  instagram: "@testuser",
  twitter: "@testuser",
  created_at: "2023-01-01T00:00:00.000Z",
  updated_at: "2023-01-01T00:00:00.000Z",
};

// Mock the onProfileUpdated function
const mockOnProfileUpdated = jest.fn();

describe("EditProfileModal Component", () => {
  // Set up common test props
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    profile: mockProfile,
    onProfileUpdated: mockOnProfileUpdated,
  };

  it("renders the modal content when open", () => {
    render(<EditProfileModal {...defaultProps} />);

    // Check if title is rendered
    expect(screen.getByText("Edit Profile")).toBeInTheDocument();

    // Check if simplified content is rendered
    expect(screen.getByText("Simplified content")).toBeInTheDocument();

    // Check if buttons are rendered
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("calls onOpenChange when Cancel button is clicked", () => {
    render(<EditProfileModal {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange when Save button is clicked", () => {
    render(<EditProfileModal {...defaultProps} />);

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<EditProfileModal {...defaultProps} open={false} />);

    // Modal title should not be in the document when closed
    expect(screen.queryByText("Edit Profile")).not.toBeInTheDocument();
  });
});
