import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FollowButton } from "@/components/social/follow-button";

// Mock the auth context
const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
  })),
}));

// Mock the useUserFollow hook
const mockUseUserFollow = {
  following: false,
  followersCount: 10,
  followingCount: 5,
  isLoading: false,
  toggleFollow: jest.fn(),
  isToggling: false,
};

jest.mock("@/hooks/use-user-follow", () => ({
  useUserFollow: jest.fn(() => mockUseUserFollow),
}));

describe("FollowButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render follow button when not following", () => {
    render(<FollowButton userId="user-2" />);

    expect(screen.getByText("Follow")).toBeInTheDocument();
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("should render unfollow button when following", () => {
    const { useUserFollow } = require("@/hooks/use-user-follow");
    useUserFollow.mockReturnValue({
      ...mockUseUserFollow,
      following: true,
    });

    render(<FollowButton userId="user-2" />);

    expect(screen.getByText("Unfollow")).toBeInTheDocument();
  });

  it("should show counts when showCounts is true", () => {
    render(<FollowButton userId="user-2" showCounts={true} />);

    expect(screen.getByText("10")).toBeInTheDocument(); // followers
    expect(screen.getByText("5")).toBeInTheDocument(); // following
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
  });

  it("should not render for current user", () => {
    const { container } = render(<FollowButton userId="user-1" />);

    expect(container.firstChild).toBeNull();
  });

  it("should not render for unauthenticated users", () => {
    const { useAuth } = require("@/context/auth-context");
    useAuth.mockReturnValue({ user: null });

    const { container } = render(<FollowButton userId="user-2" />);

    expect(container.firstChild).toBeNull();

    // Reset mock
    useAuth.mockReturnValue({ user: mockUser });
  });

  it("should call toggleFollow when clicked", async () => {
    const mockToggleFollow = jest.fn();
    const { useUserFollow } = require("@/hooks/use-user-follow");
    useUserFollow.mockReturnValue({
      ...mockUseUserFollow,
      toggleFollow: mockToggleFollow,
    });

    render(<FollowButton userId="user-2" />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockToggleFollow).toHaveBeenCalled();
  });

  it("should be disabled when loading", () => {
    const { useUserFollow } = require("@/hooks/use-user-follow");
    useUserFollow.mockReturnValue({
      ...mockUseUserFollow,
      isLoading: true,
    });

    render(<FollowButton userId="user-2" />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should be disabled when toggling", () => {
    const { useUserFollow } = require("@/hooks/use-user-follow");
    useUserFollow.mockReturnValue({
      ...mockUseUserFollow,
      isToggling: true,
    });

    render(<FollowButton userId="user-2" />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should show loading spinner when toggling", () => {
    const { useUserFollow } = require("@/hooks/use-user-follow");
    useUserFollow.mockReturnValue({
      ...mockUseUserFollow,
      isToggling: true,
    });

    render(<FollowButton userId="user-2" />);

    // Check for loading spinner by class name
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should apply correct variant and size", () => {
    render(<FollowButton userId="user-2" variant="outline" size="sm" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("h-8"); // sm size class
  });

  it("should apply custom className", () => {
    render(<FollowButton userId="user-2" className="custom-class" />);

    const container = screen.getByRole("button").parentElement;
    expect(container).toHaveClass("custom-class");
  });
});
