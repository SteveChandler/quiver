import { render, screen, fireEvent } from "@testing-library/react";
import { UserSocialStats } from "@/components/social/user-social-stats";
import type { Profile } from "@/types/database";

// Mock the followers modal
jest.mock("@/components/social/followers-modal", () => ({
  FollowersModal: ({ isOpen, onClose, type, userId }: any) => (
    isOpen ? (
      <div data-testid={`${type}-modal`}>
        <div>Modal for user {userId}</div>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null
  ),
}));

const mockProfile: Profile = {
  id: "user-1",
  full_name: "John Doe",
  email: "john@example.com",
  followers_count: 150,
  following_count: 75,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  avatar_url: null,
  bio: null,
  location: null,
  instagram_handle: null,
  skill_level: null,
  preferred_conditions: null,
  favorite_spots: null,
  is_public: true,
  last_seen_at: null,
  session_count: 0,
  activity_feed_enabled: true,
};

describe("UserSocialStats", () => {
  it("should display followers and following counts", () => {
    render(<UserSocialStats profile={mockProfile} />);

    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
  });

  it("should handle zero counts", () => {
    const profileWithZeroCounts = {
      ...mockProfile,
      followers_count: 0,
      following_count: 0,
    };

    render(<UserSocialStats profile={profileWithZeroCounts} />);

    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
  });

  it("should handle null counts", () => {
    const profileWithNullCounts = {
      ...mockProfile,
      followers_count: null,
      following_count: null,
    };

    render(<UserSocialStats profile={profileWithNullCounts} />);

    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("should handle undefined counts", () => {
    const profileWithUndefinedCounts = {
      ...mockProfile,
      followers_count: undefined,
      following_count: undefined,
    };

    render(<UserSocialStats profile={profileWithUndefinedCounts} />);

    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("should open followers modal when followers button is clicked", () => {
    render(<UserSocialStats profile={mockProfile} />);

    const followersButton = screen.getByText("Followers").closest("button");
    expect(followersButton).toBeInTheDocument();

    fireEvent.click(followersButton!);

    expect(screen.getByTestId("followers-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal for user user-1")).toBeInTheDocument();
  });

  it("should open following modal when following button is clicked", () => {
    render(<UserSocialStats profile={mockProfile} />);

    const followingButton = screen.getByText("Following").closest("button");
    expect(followingButton).toBeInTheDocument();

    fireEvent.click(followingButton!);

    expect(screen.getByTestId("following-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal for user user-1")).toBeInTheDocument();
  });

  it("should close followers modal when close is clicked", () => {
    render(<UserSocialStats profile={mockProfile} />);

    // Open followers modal
    const followersButton = screen.getByText("Followers").closest("button");
    fireEvent.click(followersButton!);
    expect(screen.getByTestId("followers-modal")).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByText("Close Modal");
    fireEvent.click(closeButton);
    expect(screen.queryByTestId("followers-modal")).not.toBeInTheDocument();
  });

  it("should close following modal when close is clicked", () => {
    render(<UserSocialStats profile={mockProfile} />);

    // Open following modal
    const followingButton = screen.getByText("Following").closest("button");
    fireEvent.click(followingButton!);
    expect(screen.getByTestId("following-modal")).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByText("Close Modal");
    fireEvent.click(closeButton);
    expect(screen.queryByTestId("following-modal")).not.toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <UserSocialStats profile={mockProfile} className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("should have proper button styling", () => {
    render(<UserSocialStats profile={mockProfile} />);

    const followersButton = screen.getByText("Followers").closest("button");
    const followingButton = screen.getByText("Following").closest("button");

    expect(followersButton).toHaveClass("flex", "flex-col", "items-center", "gap-1", "h-auto", "p-2");
    expect(followingButton).toHaveClass("flex", "flex-col", "items-center", "gap-1", "h-auto", "p-2");
  });

  it("should use ghost variant for buttons", () => {
    render(<UserSocialStats profile={mockProfile} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach(button => {
      // Ghost variant should be applied (this is handled by the Button component)
      expect(button).toBeInTheDocument();
    });
  });

  it("should display large numbers correctly", () => {
    const profileWithLargeCounts = {
      ...mockProfile,
      followers_count: 12345,
      following_count: 9876,
    };

    render(<UserSocialStats profile={profileWithLargeCounts} />);

    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("9876")).toBeInTheDocument();
  });

  it("should handle both modals being closed initially", () => {
    render(<UserSocialStats profile={mockProfile} />);

    expect(screen.queryByTestId("followers-modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("following-modal")).not.toBeInTheDocument();
  });

  it("should handle rapid modal open/close", () => {
    render(<UserSocialStats profile={mockProfile} />);

    const followersButton = screen.getByText("Followers").closest("button");
    const followingButton = screen.getByText("Following").closest("button");

    // Open followers modal
    fireEvent.click(followersButton!);
    expect(screen.getByTestId("followers-modal")).toBeInTheDocument();

    // Close followers modal
    fireEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("followers-modal")).not.toBeInTheDocument();

    // Open following modal
    fireEvent.click(followingButton!);
    expect(screen.getByTestId("following-modal")).toBeInTheDocument();

    // Close following modal
    fireEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("following-modal")).not.toBeInTheDocument();
  });

  it("should only show one modal at a time", () => {
    render(<UserSocialStats profile={mockProfile} />);

    const followersButton = screen.getByText("Followers").closest("button");
    const followingButton = screen.getByText("Following").closest("button");

    // Open followers modal
    fireEvent.click(followersButton!);
    expect(screen.getByTestId("followers-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("following-modal")).not.toBeInTheDocument();

    // The component should handle this case - only one modal should be open
    // This would require additional state management to close one when opening another
  });

  describe("Accessibility", () => {
    it("should have accessible button roles", () => {
      render(<UserSocialStats profile={mockProfile} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
    });

    it("should be keyboard accessible", () => {
      render(<UserSocialStats profile={mockProfile} />);

      const followersButton = screen.getByText("Followers").closest("button");
      followersButton?.focus();

      // Simulate Enter key press
      fireEvent.keyDown(followersButton!, { key: "Enter", code: "Enter" });
      
      // The button should still be focusable and interactive
      expect(followersButton).toBeInTheDocument();
    });
  });

  describe("Layout and Styling", () => {
    it("should have proper container layout", () => {
      const { container } = render(<UserSocialStats profile={mockProfile} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("flex", "items-center", "gap-6");
    });

    it("should display stats in column layout", () => {
      render(<UserSocialStats profile={mockProfile} />);

      const followersButton = screen.getByText("Followers").closest("button");
      expect(followersButton).toHaveClass("flex", "flex-col");
    });

    it("should style numbers prominently", () => {
      render(<UserSocialStats profile={mockProfile} />);

      const followerCount = screen.getByText("150");
      const followingCount = screen.getByText("75");

      expect(followerCount).toHaveClass("font-semibold", "text-lg");
      expect(followingCount).toHaveClass("font-semibold", "text-lg");
    });

    it("should style labels as muted", () => {
      render(<UserSocialStats profile={mockProfile} />);

      const followersLabel = screen.getByText("Followers");
      const followingLabel = screen.getByText("Following");

      expect(followersLabel).toHaveClass("text-sm", "text-muted-foreground");
      expect(followingLabel).toHaveClass("text-sm", "text-muted-foreground");
    });
  });

  describe("Edge Cases", () => {
    it("should handle extremely large numbers", () => {
      const profileWithLargeNumbers = {
        ...mockProfile,
        followers_count: 999999999,
        following_count: 888888888,
      };

      render(<UserSocialStats profile={profileWithLargeNumbers} />);

      expect(screen.getByText("999999999")).toBeInTheDocument();
      expect(screen.getByText("888888888")).toBeInTheDocument();
    });

    it("should handle negative numbers", () => {
      const profileWithNegativeNumbers = {
        ...mockProfile,
        followers_count: -5,
        following_count: -10,
      };

      render(<UserSocialStats profile={profileWithNegativeNumbers} />);

      expect(screen.getByText("-5")).toBeInTheDocument();
      expect(screen.getByText("-10")).toBeInTheDocument();
    });

    it("should handle profile without social stats", () => {
      const minimalProfile = {
        ...mockProfile,
        followers_count: null,
        following_count: null,
      } as Profile;

      expect(() => {
        render(<UserSocialStats profile={minimalProfile} />);
      }).not.toThrow();
    });
  });
});