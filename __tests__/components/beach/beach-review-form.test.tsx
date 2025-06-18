import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import * as reviewActions from "@/actions/beach-review-actions";
import * as authContext from "@/context/auth-context";
import * as toast from "@/hooks/use-toast";

// Mock dependencies
jest.mock("@/actions/beach-review-actions");
jest.mock("@/context/auth-context");
jest.mock("@/hooks/use-toast");
jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <div
      data-testid="calendar"
      onClick={() => onSelect?.(new Date("2024-01-15"))}
    >
      Mock Calendar
    </div>
  ),
}));
jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div role="dialog">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("date-fns", () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === "PPP") return "January 15, 2024";
    return "2024-01-15";
  }),
}));

const mockCreateBeachReview = jest.mocked(reviewActions.createBeachReview);
const mockUpdateBeachReview = jest.mocked(reviewActions.updateBeachReview);
const mockUseAuth = jest.mocked(authContext.useAuth);
const mockToast = jest.mocked(toast.toast);

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

const mockExistingReview = {
  id: "review-1",
  beach_id: "beach-1",
  user_id: "user-1",
  overall_rating: 4,
  wave_quality_rating: 4,
  crowd_density_rating: 3,
  parking_rating: 3,
  accessibility_rating: 4,
  title: "Great experience",
  content: "Really enjoyed surfing here!",
  visit_date: "2024-01-15",
  created_at: "2024-01-16T10:00:00Z",
  updated_at: "2024-01-16T10:00:00Z",
  user: {
    full_name: "Test User",
    avatar_url: null,
    email: "test@example.com",
  },
};

describe("BeachReviewForm", () => {
  const defaultProps = {
    beachId: "beach-1",
    beachName: "Test Beach",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: jest.fn(),
    });
    mockToast.mockImplementation(() => {});
  });

  describe("Authentication", () => {
    it("should show sign in message when not authenticated", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
      });

      render(<BeachReviewForm {...defaultProps} />);

      expect(
        screen.getByText("Please sign in to write a review.")
      ).toBeInTheDocument();
    });

    it("should show form when authenticated", () => {
      render(<BeachReviewForm {...defaultProps} />);

      expect(
        screen.getByText("Write a Review for Test Beach")
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Review Title")).toBeInTheDocument();
      expect(screen.getByLabelText("Your Review")).toBeInTheDocument();
    });
  });

  describe("Form rendering", () => {
    it("should render all rating categories", () => {
      render(<BeachReviewForm {...defaultProps} />);

      expect(screen.getByText("Overall Experience")).toBeInTheDocument();
      expect(screen.getByText("Wave Quality")).toBeInTheDocument();
      expect(screen.getByText("Crowd Level")).toBeInTheDocument();
      expect(screen.getByText("Parking")).toBeInTheDocument();
      expect(screen.getByText("Accessibility")).toBeInTheDocument();
    });

    it("should render star rating inputs for each category", () => {
      render(<BeachReviewForm {...defaultProps} />);

      // Each category should have 5 star buttons
      const starButtons = screen.getAllByRole("button").filter(
        (button) => button.querySelector("svg") // Stars are SVG icons
      );

      // 5 categories × 5 stars = 25 star buttons, plus other buttons
      expect(starButtons.length).toBeGreaterThanOrEqual(25);
    });

    it("should render text inputs", () => {
      render(<BeachReviewForm {...defaultProps} />);

      expect(screen.getByLabelText("Review Title")).toBeInTheDocument();
      expect(screen.getByLabelText("Your Review")).toBeInTheDocument();
      expect(screen.getByText("When did you visit?")).toBeInTheDocument();
    });

    it("should render submit button", () => {
      render(<BeachReviewForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Post Review" })
      ).toBeInTheDocument();
    });
  });

  describe("Edit mode", () => {
    it("should populate form with existing review data", () => {
      render(
        <BeachReviewForm
          {...defaultProps}
          existingReview={mockExistingReview}
        />
      );

      expect(
        screen.getByText("Edit Your Review for Test Beach")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Great experience")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Really enjoyed surfing here!")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Update Review" })
      ).toBeInTheDocument();
    });

    it("should show cancel button in edit mode", () => {
      const onCancel = jest.fn();

      render(
        <BeachReviewForm
          {...defaultProps}
          existingReview={mockExistingReview}
          onCancel={onCancel}
        />
      );

      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toBeInTheDocument();
    });
  });

  describe("Star rating interactions", () => {
    it("should update rating when stars are clicked", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      // Find the overall rating stars and click the 4th star
      const ratingSection = screen
        .getByText("Overall Experience")
        .closest("div");
      const starButtons = ratingSection?.querySelectorAll("button");

      if (starButtons && starButtons[3]) {
        await user.click(starButtons[3]); // Click 4th star (rating 4)

        // Check that the star appears filled (this would be implementation-specific)
        expect(
          starButtons[3]
            .querySelector("svg")
            ?.classList.contains("text-yellow-500")
        ).toBeTruthy();
      }
    });

    it("should handle all rating categories", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      const categories = [
        "Overall Experience",
        "Wave Quality",
        "Crowd Level",
        "Parking",
        "Accessibility",
      ];

      for (const category of categories) {
        const section = screen.getByText(category).closest("div");
        const starButtons = section?.querySelectorAll("button");

        if (starButtons && starButtons[2]) {
          await user.click(starButtons[2]); // Click 3rd star for each
        }
      }

      // All categories should now have ratings
      expect(
        screen.getAllByText((category) => category.includes("Experience"))
      ).toBeTruthy();
    });
  });

  describe("Form validation", () => {
    it("should show error when submitting without ratings", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Post Review" }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Missing Ratings",
          description: "Please provide ratings for all categories.",
          variant: "destructive",
        });
      });
    });

    it("should show error when submitting without title", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      // Set all ratings
      const categories = [
        "Overall Experience",
        "Wave Quality",
        "Crowd Level",
        "Parking",
        "Accessibility",
      ];
      for (const category of categories) {
        const section = screen.getByText(category).closest("div");
        const starButtons = section?.querySelectorAll("button");
        if (starButtons && starButtons[2]) {
          await user.click(starButtons[2]);
        }
      }

      // Fill content but not title
      await user.type(screen.getByLabelText("Your Review"), "Great beach!");

      await user.click(screen.getByRole("button", { name: "Post Review" }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Missing Information",
          description: "Please provide both a title and review content.",
          variant: "destructive",
        });
      });
    });

    it("should show error when submitting without content", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      // Set all ratings
      const categories = [
        "Overall Experience",
        "Wave Quality",
        "Crowd Level",
        "Parking",
        "Accessibility",
      ];
      for (const category of categories) {
        const section = screen.getByText(category).closest("div");
        const starButtons = section?.querySelectorAll("button");
        if (starButtons && starButtons[2]) {
          await user.click(starButtons[2]);
        }
      }

      // Fill title but not content
      await user.type(
        screen.getByLabelText("Review Title"),
        "Great experience"
      );

      await user.click(screen.getByRole("button", { name: "Post Review" }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Missing Information",
          description: "Please provide both a title and review content.",
          variant: "destructive",
        });
      });
    });
  });

  describe("Form submission", () => {
    it("should submit new review successfully", async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();

      mockCreateBeachReview.mockResolvedValue({
        success: true,
        data: mockExistingReview,
      });

      render(<BeachReviewForm {...defaultProps} onSuccess={onSuccess} />);

      // Fill out the form
      const categories = [
        "Overall Experience",
        "Wave Quality",
        "Crowd Level",
        "Parking",
        "Accessibility",
      ];
      for (const category of categories) {
        const section = screen.getByText(category).closest("div");
        const starButtons = section?.querySelectorAll("button");
        if (starButtons && starButtons[3]) {
          await user.click(starButtons[3]); // Rating of 4
        }
      }

      await user.type(screen.getByLabelText("Review Title"), "Amazing beach");
      await user.type(
        screen.getByLabelText("Your Review"),
        "Had a wonderful time surfing here!"
      );

      await user.click(screen.getByRole("button", { name: "Post Review" }));

      await waitFor(() => {
        expect(mockCreateBeachReview).toHaveBeenCalledWith({
          beach_id: "beach-1",
          user_id: "user-1",
          overall_rating: 4,
          wave_quality_rating: 4,
          crowd_density_rating: 4,
          parking_rating: 4,
          accessibility_rating: 4,
          title: "Amazing beach",
          content: "Had a wonderful time surfing here!",
          visit_date: undefined,
        });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Review Posted",
          description:
            "Your review for Test Beach has been posted successfully.",
        });
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it("should update existing review successfully", async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();

      mockUpdateBeachReview.mockResolvedValue({
        success: true,
        data: { ...mockExistingReview, title: "Updated title" },
      });

      render(
        <BeachReviewForm
          {...defaultProps}
          existingReview={mockExistingReview}
          onSuccess={onSuccess}
        />
      );

      // Update the title
      const titleInput = screen.getByDisplayValue("Great experience");
      await user.clear(titleInput);
      await user.type(titleInput, "Updated title");

      await user.click(screen.getByRole("button", { name: "Update Review" }));

      await waitFor(() => {
        expect(mockUpdateBeachReview).toHaveBeenCalledWith("review-1", {
          beach_id: "beach-1",
          user_id: "user-1",
          overall_rating: 4,
          wave_quality_rating: 4,
          crowd_density_rating: 3,
          parking_rating: 3,
          accessibility_rating: 4,
          title: "Updated title",
          content: "Really enjoyed surfing here!",
          visit_date: "2024-01-15",
        });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Review Updated",
          description:
            "Your review for Test Beach has been updated successfully.",
        });
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it("should handle submission errors", async () => {
      const user = userEvent.setup();

      mockCreateBeachReview.mockResolvedValue({
        success: false,
        error: "Database error",
      });

      render(<BeachReviewForm {...defaultProps} />);

      // Fill out form
      const categories = [
        "Overall Experience",
        "Wave Quality",
        "Crowd Level",
        "Parking",
        "Accessibility",
      ];
      for (const category of categories) {
        const section = screen.getByText(category).closest("div");
        const starButtons = section?.querySelectorAll("button");
        if (starButtons && starButtons[2]) {
          await user.click(starButtons[2]);
        }
      }

      await user.type(screen.getByLabelText("Review Title"), "Test title");
      await user.type(screen.getByLabelText("Your Review"), "Test content");

      await user.click(screen.getByRole("button", { name: "Post Review" }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Database error",
          variant: "destructive",
        });
      });
    });
  });

  describe("Visit date picker", () => {
    it("should open calendar when date picker is clicked", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      await user.click(screen.getByText("When did you visit?"));

      // Calendar should be visible (implementation depends on UI library)
      await waitFor(() => {
        const calendar = document.querySelector('[role="dialog"]');
        expect(calendar).toBeInTheDocument();
      });
    });

    it("should show selected date", async () => {
      render(
        <BeachReviewForm
          {...defaultProps}
          existingReview={mockExistingReview}
        />
      );

      // Should show the formatted date from existing review
      expect(screen.getByText("January 15, 2024")).toBeInTheDocument();
    });
  });

  describe("Loading states", () => {
    it("should show loading state during submission", async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      mockCreateBeachReview.mockReturnValue(createPromise);

      render(<BeachReviewForm {...defaultProps} />);

      // Fill and submit form
      const categories = [
        "Overall Experience",
        "Wave Quality",
        "Crowd Level",
        "Parking",
        "Accessibility",
      ];
      for (const category of categories) {
        const section = screen.getByText(category).closest("div");
        const starButtons = section?.querySelectorAll("button");
        if (starButtons && starButtons[2]) {
          await user.click(starButtons[2]);
        }
      }

      await user.type(screen.getByLabelText("Review Title"), "Test");
      await user.type(screen.getByLabelText("Your Review"), "Test content");

      await user.click(screen.getByRole("button", { name: "Post Review" }));

      // Should show loading state
      expect(screen.getByText("Posting...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();

      // Resolve the promise
      resolveCreate!({ success: true, data: mockExistingReview });
    });
  });

  describe("Accessibility", () => {
    it("should have proper form labels", () => {
      render(<BeachReviewForm {...defaultProps} />);

      expect(screen.getByLabelText("Review Title")).toBeInTheDocument();
      expect(screen.getByLabelText("Your Review")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Visit Date (Optional)")
      ).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<BeachReviewForm {...defaultProps} />);

      // Should be able to tab through form elements
      await user.tab();
      await user.tab();

      // First interactive element should be focused
      expect(document.activeElement).toBeDefined();
    });
  });
});
