import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// Load form component dynamically after mocks are applied
const loadForm = () => require("@/components/edit-profile-form").EditProfileForm;
import { useProfile } from "@/lib/hooks/useProfile";
import { } from "@/context/auth-context";
import { } from "@/actions/profile-actions"; // ensure module path is resolvable for jest.mock

// Mock the hooks and actions
jest.mock("@/lib/hooks/useProfile");
// Force authenticated user for this suite
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    isLoading: false,
    isAuthenticated: true,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  })),
}));
// Use global mock from jest.setup.js and control its return dynamically via require
// Explicitly mock profile actions; we will access the mock via require() to get the jest.fn
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
const mockUseAuth = require("@/context/auth-context").useAuth as jest.Mock;
let mockUpdateProfile: jest.Mock;

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
    // Pull the mocked function reference each test run
    mockUpdateProfile = (require("@/actions/profile-actions").updateProfile as jest.Mock).mockResolvedValue({
      success: true,
      data: mockProfile,
    });
    // Ensure authenticated user for this suite
    mockUseAuth.mockReturnValue({
      user: mockUser,
      session: null,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate
    });

    // default resolve set in beforeEach

  });

  it("renders the edit profile form with initial data", () => {
    const EditProfileForm = loadForm();
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

  it("submits form with updated profile data and omits empty avatar_url", async () => {
    const user = userEvent.setup();
    
    const EditProfileForm = loadForm();
    const { container } = render(
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
    const formEl = container.querySelector("form")!;
    fireEvent.submit(formEl);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });

    const payload = (mockUpdateProfile.mock.calls[0] || [])[0] as any;
    expect(payload.full_name).toBe("Updated User");
    expect(payload.avatar_url).toBeUndefined();

    expect(mockMutate).toHaveBeenCalled();
  });

  it("updates UI selection immediately and defers save until form submission", async () => {
    const user = userEvent.setup();

    const EditProfileForm = loadForm();
    const { container } = render(<EditProfileForm initialData={{ full_name: "Test User" }} />);

    // Change home beach selection
    const select = screen.getByTestId("home-beach-select");
    await user.selectOptions(select, "beach-1");

    // UI should reflect selection immediately
    expect((select as HTMLSelectElement).value).toBe("beach-1");

    // No save until submit
    expect(mockUpdateProfile).not.toHaveBeenCalled();

    // Submit the form (valid name present, so it should submit)
    const formEl2 = container.querySelector("form")!;
    fireEvent.submit(formEl2);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });

    const payload = (mockUpdateProfile.mock.calls[0] || [])[0] as any;
    expect(payload.home_beach_id).toBe("beach-1");
    expect(payload.avatar_url).toBeUndefined();
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
    
    const EditProfileForm = loadForm();
    const { container } = render(<EditProfileForm initialData={{ full_name: "Test User" }} />);

    const formEl3 = container.querySelector("form")!;
    fireEvent.submit(formEl3);

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

  it("includes avatar_url when a real URL is present and not a placeholder", async () => {
    const user = userEvent.setup();

    const EditProfileForm = loadForm();
    const { container } = render(
      <EditProfileForm
        initialData={{ full_name: "Test User", avatar_url: "https://example.com/avatar.png" }}
      />
    );
    const formEl4 = container.querySelector("form")!;
    fireEvent.submit(formEl4);

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    const payload = (mockUpdateProfile.mock.calls[0] || [])[0] as any;
    expect(payload.avatar_url).toBe("https://example.com/avatar.png");
  });

  it("omits avatar_url when placeholder is set", async () => {
    const user = userEvent.setup();

    const EditProfileForm = loadForm();
    const { container: container5 } = render(
      <EditProfileForm
        initialData={{ full_name: "Test User", avatar_url: "/placeholder.svg?height=96&width=96" }}
      />
    );
    const formEl5 = container5.querySelector("form")!;
    fireEvent.submit(formEl5);

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    const payload = (mockUpdateProfile.mock.calls[0] || [])[0] as any;
    expect(payload.avatar_url).toBeUndefined();
  });
});
