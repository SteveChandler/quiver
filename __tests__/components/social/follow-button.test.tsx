import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowButton } from "@/components/social/follow-button";
import { useUserFollow } from "@/hooks/use-user-follow";
import { useAuth } from "@/context/auth-context";

// Mock dependencies
jest.mock("@/hooks/use-user-follow");
jest.mock("@/context/auth-context");

const mockUseUserFollow = useUserFollow as jest.MockedFunction<
  typeof useUserFollow
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

const defaultUseUserFollowReturn = {
  following: false,
  followersCount: 10,
  followingCount: 5,
  isLoading: false,
  toggleFollow: jest.fn(),
  isToggling: false,
};

describe("FollowButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser });
    mockUseUserFollow.mockReturnValue(defaultUseUserFollowReturn);
  });

  describe("Rendering", () => {
    it("should render follow button when not following", () => {
      render(<FollowButton userId="user-2" />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Follow");
      expect(button).not.toHaveClass("hover:bg-destructive");
    });

    it("should render unfollow button when following", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        following: true,
      });

      render(<FollowButton userId="user-2" />);

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Unfollow");
      expect(button).toHaveClass("hover:bg-destructive");
    });

    it("should support custom follow state labels", () => {
      const { rerender } = render(
        <FollowButton
          userId="user-2"
          followingLabel="Following"
          notFollowingLabel="Send Wave"
        />
      );

      let button = screen.getByRole("button");
      expect(button).toHaveTextContent("Send Wave");
      expect(button.getAttribute("aria-label")).toContain("Send Wave");

      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        following: true,
      });

      rerender(
        <FollowButton
          userId="user-2"
          followingLabel="Following"
          notFollowingLabel="Send Wave"
        />
      );

      button = screen.getByRole("button");
      expect(button).toHaveTextContent("Following");
      expect(button.getAttribute("aria-label")).toContain("Following");
    });

    it("should show loading state when toggling", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        isToggling: true,
      });

      render(<FollowButton userId="user-2" />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(screen.getByRole("button")).toContainElement(
        screen.getByText("", { selector: ".animate-spin" })
      );
    });

    it("should show disabled state when loading", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        isLoading: true,
      });

      render(<FollowButton userId="user-2" />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("should not render for unauthenticated users", () => {
      mockUseAuth.mockReturnValue({ user: null });

      render(<FollowButton userId="user-2" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should not render for current user", () => {
      render(<FollowButton userId="user-1" />); // Same as mockUser.id

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("should render small size button", () => {
      render(<FollowButton userId="user-2" size="sm" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-3");
    });

    it("should render large size button", () => {
      render(<FollowButton userId="user-2" size="lg" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-8");
    });
  });

  describe("Show counts functionality", () => {
    it("should display follower and following counts when showCounts is true", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        followersCount: 15,
        followingCount: 8,
      });

      render(<FollowButton userId="user-2" showCounts={true} />);

      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("Followers")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("Following")).toBeInTheDocument();
    });

    it("should not display counts when showCounts is false", () => {
      render(<FollowButton userId="user-2" showCounts={false} />);

      expect(screen.queryByText("Followers")).not.toBeInTheDocument();
      expect(screen.queryByText("Following")).not.toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("should call toggleFollow when button is clicked", async () => {
      const mockToggleFollow = jest.fn();
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        toggleFollow: mockToggleFollow,
      });

      const user = userEvent.setup();
      render(<FollowButton userId="user-2" />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockToggleFollow).toHaveBeenCalledTimes(1);
    });

    it("should not call toggleFollow when button is disabled", async () => {
      const mockToggleFollow = jest.fn();
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        toggleFollow: mockToggleFollow,
        isLoading: true,
      });

      const user = userEvent.setup();
      render(<FollowButton userId="user-2" />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockToggleFollow).not.toHaveBeenCalled();
    });
  });

  describe("Hook integration", () => {
    it("should pass correct parameters to useUserFollow hook", () => {
      render(
        <FollowButton
          userId="user-2"
          initialFollowersCount={20}
          initialFollowingCount={15}
        />
      );

      expect(mockUseUserFollow).toHaveBeenCalledWith(
        "user-2",
        20,
        15,
        undefined
      );
    });

    it("should use default initial counts when not provided", () => {
      render(<FollowButton userId="user-2" />);

      expect(mockUseUserFollow).toHaveBeenCalledWith("user-2", 0, 0, undefined);
    });

    it("should update display when hook state changes", () => {
      const { rerender } = render(
        <FollowButton userId="user-2" showCounts={true} />
      );

      // Initial state
      expect(screen.getByText("10")).toBeInTheDocument(); // followers
      expect(screen.getByText("5")).toBeInTheDocument(); // following

      // Update hook return value
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        followersCount: 11,
        followingCount: 5,
        following: true,
      });

      rerender(<FollowButton userId="user-2" showCounts={true} />);

      expect(screen.getByText("11")).toBeInTheDocument();
      expect(screen.getByText("Unfollow")).toBeInTheDocument();
    });
  });

  describe("Styling and variants", () => {
    it("should apply custom className", () => {
      render(<FollowButton userId="user-2" className="custom-class" />);

      const container = screen.getByRole("button").parentElement;
      expect(container).toHaveClass("custom-class");
    });

    it("should apply correct variant styling", () => {
      render(<FollowButton userId="user-2" variant="secondary" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-secondary");
    });

    it("should show outline variant when following", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        following: true,
      });

      render(<FollowButton userId="user-2" variant="default" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-input");
    });
  });

  describe("Icons", () => {
    it("should show UserPlus icon when not following", () => {
      render(<FollowButton userId="user-2" />);

      // Check for UserPlus icon (testing by className since it's a lucide icon)
      const iconElement = screen
        .getByRole("button")
        .querySelector(".lucide-user-plus");
      expect(iconElement).toBeInTheDocument();
    });

    it("should show UserMinus icon when following", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        following: true,
      });

      render(<FollowButton userId="user-2" />);

      // Check for UserMinus icon
      const iconElement = screen
        .getByRole("button")
        .querySelector(".lucide-user-minus");
      expect(iconElement).toBeInTheDocument();
    });

    it("should show spinner when toggling", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        isToggling: true,
      });

      render(<FollowButton userId="user-2" />);

      const spinner = screen.getByRole("button").querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Responsive behavior", () => {
    it("should hide button text on small screens", () => {
      render(<FollowButton userId="user-2" />);

      const buttonText = screen.getByText("Follow");
      expect(buttonText).toHaveClass("hidden", "sm:inline");
    });
  });

  describe("Error scenarios", () => {
    it("should handle hook errors gracefully", () => {
      mockUseUserFollow.mockReturnValue({
        ...defaultUseUserFollowReturn,
        followersCount: 0,
        followingCount: 0,
        isLoading: false,
      });

      expect(() =>
        render(<FollowButton userId="user-2" showCounts={true} />)
      ).not.toThrow();
      expect(screen.getByText("Followers")).toBeInTheDocument(); // Should show followers section
      expect(screen.getByText("Following")).toBeInTheDocument(); // Should show following section
    });
  });
});
