import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock dependencies
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const flatten = (children: any): any[] => {
    return React.Children.toArray(children).flatMap((child: any) => {
      if (!React.isValidElement(child)) return [];
      if (child.type && child.type.displayName === "SelectItem") {
        return [child];
      }
      if (child.props && child.props.children) {
        return flatten(child.props.children);
      }
      return [];
    });
  };
  const getText = (nodes: any): string => {
    if (Array.isArray(nodes)) return nodes.map(getText).join("");
    if (typeof nodes === "string" || typeof nodes === "number")
      return String(nodes);
    if (nodes && nodes.props && nodes.props.children)
      return getText(nodes.props.children);
    return "";
  };
  const Select = ({ value, onValueChange, children }: any) => {
    const items = flatten(children);
    return (
      <select
        role="combobox"
        aria-label="select"
        value={value || ""}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="" disabled hidden>
          Select
        </option>
        {items.map((item: any, idx: number) => (
          <option key={idx} value={item.props.value}>
            {getText(item.props.children)}
          </option>
        ))}
      </select>
    );
  };
  const SelectTrigger = ({ children }: any) => <>{children}</>;
  const SelectValue = ({ placeholder }: any) => <>{placeholder || null}</>;
  const SelectContent = ({ children }: any) => <>{children}</>;
  const SelectItem = ({ children }: any) => <>{children}</>;
  SelectItem.displayName = "SelectItem";
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

jest.mock("@/actions/intel-actions", () => ({
  createIntelPost: jest.fn(),
}));

jest.mock("@/lib/image-upload", () => ({
  uploadImage: jest.fn(),
}));

jest.mock("@/lib/constants/intel", () => ({
  INTEL_CONFIG: {
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    ALLOWED_PHOTO_TYPES: ["image/jpeg", "image/png"],
    MAX_PHOTO_SIZE: 5000000,
    PHOTO_UPLOAD_BUCKET: "intel-photos",
  },
  INTEL_UI_TEXT: {
    FORM: {
      TITLE: "Share Local Intel",
      DESCRIPTION: "Help the surf community with local information",
      TAG_LABEL: "Intel Type",
      TAG_PLACEHOLDER: "Select type",
      TITLE_LABEL: "Title",
      TITLE_PLACEHOLDER: "Brief title",
      DESCRIPTION_LABEL: "Description",
      DESCRIPTION_PLACEHOLDER: "Describe the situation",
      PHOTO_LABEL: "Photo (Optional)",
      PHOTO_PLACEHOLDER: "Add a photo",
      LOCATION_PROMPT: "Getting location...",
      CANCEL_BUTTON: "Cancel",
      SUBMIT_BUTTON: "Share Intel",
    },
    VALIDATION: {
      TITLE_REQUIRED: "Title is required",
      TITLE_TOO_LONG: "Title too long",
      DESCRIPTION_REQUIRED: "Description is required",
      DESCRIPTION_TOO_LONG: "Description too long",
      LOCATION_REQUIRED: "Location is required",
      PHOTO_INVALID_TYPE: "Invalid photo type",
      PHOTO_TOO_LARGE: "Photo too large",
    },
    SUCCESS: {
      POST_CREATED: "Intel post created",
    },
    ERROR: {
      POST_FAILED: "Failed to create post",
      PHOTO_UPLOAD_FAILED: "Photo upload failed",
    },
  },
  INTEL_TAGS: {
    parking: { emoji: "🅿️", label: "Parking" },
    hazard: { emoji: "⚠️", label: "Hazard" },
    crowd: { emoji: "👥", label: "Crowd" },
    conditions: { emoji: "🌊", label: "Conditions" },
    access: { emoji: "🚪", label: "Access" },
    other: { emoji: "📝", label: "Other" },
  },
}));

jest.mock("@/components/ui/wave-type-selector", () => ({
  WaveTypeSelector: ({ selectedTypes, onChange }: any) => (
    <div data-testid="wave-type-selector">
      <button onClick={() => onChange([...selectedTypes, "fat"])}>
        Add Fat
      </button>
      <div>Selected: {selectedTypes.join(", ")}</div>
    </div>
  ),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
};
Object.defineProperty(global.navigator, "geolocation", {
  value: mockGeolocation,
});

import { createIntelPost } from "@/actions/intel-actions";
import { uploadImage } from "@/lib/image-upload";
import { toast } from "sonner";
const { IntelPostForm } = require("@/components/intel/intel-post-form");

const mockCreateIntelPost = createIntelPost as any;
const mockUploadImage = uploadImage as any;
const mockToast = toast as any;

const baseIntelPost = {
  id: "intel-post-id",
  user_id: "user-id",
  beach_id: "beach-123",
  lat: 32.7507,
  lon: -117.254,
  tag: "other",
  title: "Mock Intel",
  description: "Mock description",
  photo_url: null,
  confirmations_count: 0,
  is_active: true,
  surf_conditions: null,
  expires_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_has_confirmed: false,
  user: {
    full_name: "Test User",
    avatar_url: null,
  },
};

describe("IntelPostForm", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    initialLocation: { lat: 32.7507, lon: -117.254 },
    beachId: "beach-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIntelPost.mockResolvedValue({
      success: true,
      data: { ...baseIntelPost },
    });
  });

  it("renders basic form elements", () => {
    render(<IntelPostForm {...defaultProps} />);

    expect(screen.getByText("Share Local Intel")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Share Intel")).toBeInTheDocument();
  });

  it("shows surf condition fields when conditions tag is selected", async () => {
    const user = userEvent.setup();
    render(<IntelPostForm {...defaultProps} />);

    // Select conditions tag
    const tagSelect = screen.getByRole("combobox");
    await user.selectOptions(tagSelect, "conditions");

    // Check that surf condition fields appear
    await waitFor(() => {
      expect(screen.getByText("Current Surf Conditions")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("3.5")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("68")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("10")).toBeInTheDocument();
      expect(screen.getByText(/Wind Direction/)).toBeInTheDocument();
      expect(screen.getByText(/Crowd Level/)).toBeInTheDocument();
      expect(screen.getByTestId("wave-type-selector")).toBeInTheDocument();
      expect(
        screen.getByText("Was today's forecast accurate?")
      ).toBeInTheDocument();
    });
  });

  it("hides surf condition fields for non-conditions tags", async () => {
    const user = userEvent.setup();
    render(<IntelPostForm {...defaultProps} />);

    // Select parking tag (not conditions)
    const tagSelect = screen.getByRole("combobox");
    await user.selectOptions(tagSelect, "parking");

    // Check that surf condition fields are not present
    expect(
      screen.queryByText("Current Surf Conditions")
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("3.5")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wave-type-selector")).not.toBeInTheDocument();
  });

  it("submits form with basic data for non-conditions posts", async () => {
    const user = userEvent.setup();
    render(<IntelPostForm {...defaultProps} />);

    // Fill basic form
    await user.type(screen.getByLabelText("Title"), "Great parking spot");
    await user.type(
      screen.getByLabelText("Description"),
      "Free parking available near the beach"
    );

    // Submit form
    await user.click(screen.getByText("Share Intel"));

    await waitFor(() => {
      expect(mockCreateIntelPost).toHaveBeenCalledWith({
        lat: 32.7507,
        lon: -117.254,
        beach_id: "beach-123",
        tag: "other",
        title: "Great parking spot",
        description: "Free parking available near the beach",
        photo_url: undefined,
        photo_storage_path: undefined,
        wave_height: null,
        wind_speed: null,
        wind_direction: null,
        water_temp: null,
        crowd_level: 3,
        wave_types: [],
        forecast_accuracy: null,
      });
    });
  });

  it("submits form with surf condition data for conditions posts", async () => {
    const user = userEvent.setup();
    render(<IntelPostForm {...defaultProps} />);

    // Select conditions tag
    const tagSelect = screen.getByRole("combobox");
    await user.selectOptions(tagSelect, "conditions");

    // Fill basic form
    await user.type(screen.getByLabelText("Title"), "Epic surf conditions");
    await user.type(
      screen.getByLabelText("Description"),
      "Perfect waves this morning"
    );

    // Fill surf condition fields
    await waitFor(() => {
      expect(screen.getByPlaceholderText("3.5")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("3.5"), "4.5");
    await user.type(screen.getByPlaceholderText("68"), "70");
    await user.type(screen.getByPlaceholderText("10"), "8");

    // Select wind direction (second combobox)
    const selects = screen.getAllByRole("combobox");
    const windSelect = selects[1];
    await user.selectOptions(windSelect, "OFFSHORE");

    // Add wave type
    const addFatButton = screen.getByText("Add Fat");
    await user.click(addFatButton);

    // Skip forecast accuracy selection in this test

    // Submit form
    await user.click(screen.getByText("Share Intel"));

    await waitFor(() => {
      expect(mockCreateIntelPost).toHaveBeenCalledWith({
        lat: 32.7507,
        lon: -117.254,
        beach_id: "beach-123",
        tag: "conditions",
        title: "Epic surf conditions",
        description: "Perfect waves this morning",
        photo_url: undefined,
        photo_storage_path: undefined,
        wave_height: 4.5,
        wind_speed: 8,
        wind_direction: "OFFSHORE",
        water_temp: 70,
        crowd_level: 3,
        wave_types: ["fat"],
        forecast_accuracy: null,
      });
    });
  });

  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<IntelPostForm {...defaultProps} />);

    // Try to submit without filling required fields
    await user.click(screen.getByText("Share Intel"));

    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
      expect(screen.getByText("Description is required")).toBeInTheDocument();
    });

    expect(mockCreateIntelPost).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    render(<IntelPostForm {...defaultProps} onClose={mockOnClose} />);

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onSuccess after successful submission", async () => {
    const user = userEvent.setup();
    const mockOnSuccess = jest.fn();
    const createdPost = { ...baseIntelPost, id: "created-post" };
    mockCreateIntelPost.mockResolvedValueOnce({ success: true, data: createdPost });
    render(<IntelPostForm {...defaultProps} onSuccess={mockOnSuccess} />);

    // Fill and submit form
    await user.type(screen.getByLabelText("Title"), "Test post");
    await user.type(screen.getByLabelText("Description"), "Test description");
    await user.click(screen.getByText("Share Intel"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(createdPost);
    });
  });

  it("resets form when modal closes", () => {
    const { rerender } = render(<IntelPostForm {...defaultProps} />);

    // Open form and fill some data
    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Test title" } });

    // Close modal
    rerender(<IntelPostForm {...defaultProps} isOpen={false} />);

    // Reopen modal
    rerender(<IntelPostForm {...defaultProps} isOpen={true} />);

    // Form should be reset
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("handles submission errors gracefully", async () => {
    const user = userEvent.setup();
    mockCreateIntelPost.mockRejectedValueOnce(new Error("Network error"));

    render(<IntelPostForm {...defaultProps} />);

    // Fill and submit form
    await user.type(screen.getByLabelText("Title"), "Test post");
    await user.type(screen.getByLabelText("Description"), "Test description");
    await user.click(screen.getByText("Share Intel"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create post");
    });
  });

  it("shows location status correctly", () => {
    render(<IntelPostForm {...defaultProps} />);

    expect(screen.getByText("Location captured")).toBeInTheDocument();
    expect(screen.getByText("32.7507, -117.2540")).toBeInTheDocument();
  });

  it("disables submit when location is not available", () => {
    render(<IntelPostForm {...defaultProps} initialLocation={undefined} />);

    const submitButton = screen.getByText("Share Intel");
    expect(submitButton).toBeDisabled();
  });
});
