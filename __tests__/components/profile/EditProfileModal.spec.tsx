import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProfileForm } from "@/components/edit-profile-form";
import { useProfile } from "@/lib/hooks/useProfile";
import { useAuth } from "@/context/auth-context";
import { updateProfile } from "@/actions/profile-actions";

// Mock the hooks and actions
jest.mock("@/lib/hooks/useProfile");
jest.mock("@/context/auth-context");
jest.mock("@/actions/profile-actions", () => ({
  updateProfile: jest.fn(),
}));

// Mock image upload utilities
jest.mock("@/lib/image-upload", () => ({
  uploadImage: jest.fn().mockResolvedValue({ success: true, url: "test-url" }),
  deleteImage: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock toast utilities
jest.mock("@/lib/utils/toast-utils", () => ({
  toastUtils: {
    profile: {
      updated: jest.fn(),
      updateFailed: jest.fn(),
    }
  }
}));

// Mock toast hook
jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));
jest.mock("@/components/home-beach-selector", () => ({
  HomeBeachSelector: ({ onValueChange, value, disabled }: any) => (
    <select
      data-testid="home-beach-select"
      value={value || ""}
      onChange={(e) => onValueChange(e.target.value || undefined)}
      disabled={disabled}
    >
      <option value="">Select beach</option>
      <option value="beach-1">Ocean Beach</option>
      <option value="beach-2">Pacific Beach</option>
    </select>
  )
}));

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;

// Mock next/navigation
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe("EditProfileModal", () => {
  const mockMutate = jest.fn();
  const mockUser = { id: "test-user-id", email: "test@example.com" };
  const mockProfile = {
    id: "test-user-id",
    full_name: "Test User",
    bio: "Test bio",
    location: "San Diego",
    home_beach_id: null,
    avatar_url: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      session: null,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn()
    });

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate
    });

    mockUpdateProfile.mockResolvedValue({
      success: true,
      data: mockProfile
    });

  });

  it("renders the edit profile form with initial data", () => {
    render(
      <EditProfileForm 
        initialData={{
          full_name: "Test User",
          bio: "Test bio",
          location: "San Diego"
        }}
      />
    );

    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test bio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("San Diego")).toBeInTheDocument();
    expect(screen.getByTestId("home-beach-select")).toBeInTheDocument();
    expect(screen.getByTestId("save-profile")).toBeInTheDocument();
  });

  it("submits form with updated profile data", async () => {
    const user = userEvent.setup();
    
    render(
      <EditProfileForm 
        initialData={{
          full_name: "Test User",
          bio: "Test bio"
        }}
      />
    );

    // Update the name field
    const nameInput = screen.getByDisplayValue("Test User");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated User");

    // Submit the form
    const saveButton = screen.getByTestId("save-profile");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        full_name: "Updated User",
        bio: "Test bio",
        avatar_url: ""
      });
    });

    expect(mockMutate).toHaveBeenCalled();
  });

  it("defers home beach update until form submission", async () => {
    const user = userEvent.setup();

    render(<EditProfileForm initialData={{}} />);

    // Change home beach selection
    const select = screen.getByTestId("home-beach-select");
    await user.selectOptions(select, "beach-1");

    // Submit the form
    const saveButton = screen.getByTestId("save-profile");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        full_name: "",
        bio: "",
        location: "",
        experience_level: "",
        instagram: "",
        home_beach_id: "beach-1",
        avatar_url: "",
      });
    });
  });

  it("shows loading state during form submission", async () => {
    // Make updateProfile slow to resolve
    mockUpdateProfile.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve({
        success: true,
        data: mockProfile
      }), 100)
    ));

    const user = userEvent.setup();
    
    render(<EditProfileForm initialData={{ full_name: "Test User" }} />);

    const saveButton = screen.getByTestId("save-profile");
    await user.click(saveButton);

    // Should show loading state
    expect(saveButton).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it("handles form validation errors", async () => {
    const user = userEvent.setup();
    
    render(<EditProfileForm initialData={{}} />);

    // Try to submit with empty required field
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, "A"); // Too short
    await user.clear(nameInput);

    const saveButton = screen.getByTestId("save-profile");
    await user.click(saveButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    });

    // Should not call updateProfile
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});
