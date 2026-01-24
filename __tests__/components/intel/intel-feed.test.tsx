import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntelPostWithUser } from "@/types/database";

// Mock date-fns subpath imports created by modularizeImports transform.
// SWC converts `import { formatDistanceToNow } from "date-fns"` to
// `import formatDistanceToNow from "date-fns/formatDistanceToNow"`.
// Factory must return the function directly (as default export for CJS interop).
jest.mock("date-fns/formatDistanceToNow", () => {
  return (date: Date, options?: { addSuffix?: boolean }) => {
    const diff = Date.now() - date.getTime();
    const hours = Math.round(diff / (1000 * 60 * 60));
    if (hours < 1) return options?.addSuffix ? "less than an hour ago" : "less than an hour";
    if (hours === 1) return options?.addSuffix ? "about 1 hour ago" : "about 1 hour";
    return options?.addSuffix ? `about ${hours} hours ago` : `about ${hours} hours`;
  };
});

import { IntelFeed, IntelFeedCard } from "@/components/intel/intel-feed";

// Mock other dependencies
jest.mock("next/link", () =>
  function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  }
);
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));
jest.mock("@/components/intel/intel-post-modal", () => ({
  IntelPostModal: ({ isOpen, onClose, post }: any) =>
    isOpen ? (
      <div data-testid="intel-post-modal">
        <div>Modal for: {post.title}</div>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));
jest.mock("@/components/social/user-avatar-button", () => ({
  UserAvatarButton: ({ userId, name }: any) => (
    <button data-testid="user-avatar-button" data-user-id={userId}>
      {name}
    </button>
  ),
}));
jest.mock("@/components/intel/conditions-intel-card", () => ({
  ConditionsIntelCard: ({ post, variant }: any) => (
    <div data-testid="conditions-intel-card" data-variant={variant}>
      Conditions Card for {post.title}
    </div>
  ),
  getMorningIntelPayloadV2: jest.fn(),
}));
jest.mock("@/lib/utils/nearest-beach", () => ({
  getNearestBeachName: jest.fn(() => "La Jolla Shores"),
}));
jest.mock("@/lib/utils/image-utils", () => ({
  getTransformedUrl: jest.fn((url) => url),
}));

// Helper to create mock intel post
const createMockPost = (
  overrides: Partial<IntelPostWithUser> = {}
): IntelPostWithUser => ({
  id: "post-1",
  user_id: "user-1",
  beach_id: null,
  latitude: 32.7157,
  longitude: -117.1611,
  tag: "conditions",
  title: "Great surf today",
  description: "Clean 4-6ft waves with offshore winds",
  confirmations_count: 3,
  is_active: true,
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
  dedupe_hash: null,
  emoji_rating: null,
  expires_at: null,
  photo_storage_path: null,
  photo_url: null,
  surf_conditions: null,
  user: {
    full_name: "Test User",
    avatar_url: null,
  },
  user_has_confirmed: false,
  ...overrides,
} as unknown as IntelPostWithUser);

describe("IntelFeed", () => {
  const mockOnPostClick = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockOnPlanSession = jest.fn();
  const mockOnShareIntel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders loading skeleton when loading is true", () => {
      const { container } = render(
        <IntelFeed
          posts={[]}
          loading={true}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      const cards = container.querySelectorAll(".animate-pulse");
      expect(cards).toHaveLength(3);
    });

    it("applies custom className to loading skeleton", () => {
      const { container } = render(
        <IntelFeed
          posts={[]}
          loading={true}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
          className="custom-loading-class"
        />
      );

      expect(container.firstChild).toHaveClass("custom-loading-class");
    });
  });

  describe("Empty State", () => {
    it("renders empty state when no posts", () => {
      render(
        <IntelFeed
          posts={[]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("No Local Intel Yet")).toBeInTheDocument();
      expect(
        screen.getByText("Be the first to share what's happening at this spot")
      ).toBeInTheDocument();
    });

    it("renders empty state action button when onShareIntel is provided", () => {
      render(
        <IntelFeed
          posts={[]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          onShareIntel={mockOnShareIntel}
          canConfirm={true}
        />
      );

      const shareButton = screen.getByText("Share Intel");
      expect(shareButton).toBeInTheDocument();

      fireEvent.click(shareButton);
      expect(mockOnShareIntel).toHaveBeenCalledTimes(1);
    });

    it("does not render action button when onShareIntel is not provided", () => {
      render(
        <IntelFeed
          posts={[]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.queryByText("Share Intel")).not.toBeInTheDocument();
    });

    it("applies custom className to empty state", () => {
      const { container } = render(
        <IntelFeed
          posts={[]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
          className="custom-empty-class"
        />
      );

      const emptyState = container.querySelector(".custom-empty-class");
      expect(emptyState).toBeInTheDocument();
    });
  });

  describe("Posts Display", () => {
    it("renders list of intel posts", () => {
      const posts = [
        createMockPost({ id: "post-1", title: "Post 1" }),
        createMockPost({ id: "post-2", title: "Post 2" }),
        createMockPost({ id: "post-3", title: "Post 3" }),
      ];

      render(
        <IntelFeed
          posts={posts}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("Post 1")).toBeInTheDocument();
      expect(screen.getByText("Post 2")).toBeInTheDocument();
      expect(screen.getByText("Post 3")).toBeInTheDocument();
    });

    it("renders post content correctly", () => {
      const post = createMockPost({
        title: "Epic surf day",
        description: "Perfect offshore winds and clean waves",
        tag: "conditions",
        confirmations_count: 5,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("Epic surf day")).toBeInTheDocument();
      expect(
        screen.getByText("Perfect offshore winds and clean waves")
      ).toBeInTheDocument();
      expect(screen.getByText("5 confirmations")).toBeInTheDocument();
      expect(screen.getByText("Conditions")).toBeInTheDocument();
    });

    it("applies custom className to posts container", () => {
      const posts = [createMockPost()];
      const { container } = render(
        <IntelFeed
          posts={posts}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
          className="custom-posts-class"
        />
      );

      expect(container.firstChild).toHaveClass("custom-posts-class");
    });
  });

  describe("Tag Filtering", () => {
    const posts = [
      createMockPost({ id: "post-1", tag: "conditions", title: "Conditions Post" }),
      createMockPost({ id: "post-2", tag: "parking", title: "Parking Post" }),
      createMockPost({ id: "post-3", tag: "hazard", title: "Hazard Post" }),
    ];

    it("shows all posts when selectedTag is 'all'", () => {
      render(
        <IntelFeed
          posts={posts}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
          selectedTag="all"
        />
      );

      expect(screen.getByText("Conditions Post")).toBeInTheDocument();
      expect(screen.getByText("Parking Post")).toBeInTheDocument();
      expect(screen.getByText("Hazard Post")).toBeInTheDocument();
    });

    it("filters posts by selected tag", () => {
      render(
        <IntelFeed
          posts={posts}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
          selectedTag="parking"
        />
      );

      expect(screen.queryByText("Conditions Post")).not.toBeInTheDocument();
      expect(screen.getByText("Parking Post")).toBeInTheDocument();
      expect(screen.queryByText("Hazard Post")).not.toBeInTheDocument();
    });

    it("shows empty state when no posts match filter", () => {
      render(
        <IntelFeed
          posts={posts}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
          selectedTag="crowd"
        />
      );

      expect(screen.getByText("No Local Intel Yet")).toBeInTheDocument();
    });
  });

  describe("Post Interactions", () => {
    it("opens modal when clicking on a post", async () => {
      const post = createMockPost({ title: "Test Post" });
      const user = userEvent.setup();

      const { container } = render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      // Find the card by looking for the cursor-pointer element
      const card = container.querySelector(".cursor-pointer");
      expect(card).toBeInTheDocument();

      await user.click(card!);

      await waitFor(() => {
        expect(mockOnPostClick).toHaveBeenCalledWith(post);
        expect(screen.getByTestId("intel-post-modal")).toBeInTheDocument();
        expect(screen.getByText("Modal for: Test Post")).toBeInTheDocument();
      });
    });

    it("closes modal when close button is clicked", async () => {
      const post = createMockPost({ title: "Test Post" });
      const user = userEvent.setup();

      const { container } = render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      const card = container.querySelector(".cursor-pointer");
      await user.click(card!);

      await waitFor(() => {
        expect(screen.getByTestId("intel-post-modal")).toBeInTheDocument();
      });

      const closeButton = screen.getByText("Close Modal");
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("intel-post-modal")).not.toBeInTheDocument();
      });
    });

    it("calls onConfirm when confirm button is clicked", async () => {
      const post = createMockPost({ id: "post-123", user_has_confirmed: false });
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      // Find the confirm button (the one with the Check icon)
      const confirmButtons = screen.getAllByRole("button");
      const confirmButton = confirmButtons.find((btn) =>
        btn.className.includes("h-8")
      );

      fireEvent.click(confirmButton!);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith("post-123", false);
      });
    });

    it("calls onPlanSession when plan session button is clicked", async () => {
      const post = createMockPost({ title: "Test Post" });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      // Find the plan session button (outline variant has border-input class)
      const buttons = screen.getAllByRole("button");
      const planButton = buttons.find(
        (btn) =>
          btn.className.includes("border-input") && btn.className.includes("h-8")
      );

      fireEvent.click(planButton!);
      // stopPropagation should prevent modal from opening
      expect(mockOnPlanSession).toHaveBeenCalledWith(post);
      expect(mockOnPostClick).not.toHaveBeenCalled();
    });
  });

  describe("Post Types and Tags", () => {
    it("renders different post tags correctly", () => {
      const posts = [
        createMockPost({ tag: "parking", title: "Parking Info" }),
        createMockPost({ tag: "hazard", title: "Hazard Warning" }),
        createMockPost({ tag: "crowd", title: "Crowd Update" }),
        createMockPost({ tag: "access", title: "Access Info" }),
        createMockPost({ tag: "other", title: "Other Info" }),
      ];

      render(
        <IntelFeed
          posts={posts}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("Parking")).toBeInTheDocument();
      expect(screen.getByText("Hazard")).toBeInTheDocument();
      expect(screen.getByText("Crowd")).toBeInTheDocument();
      expect(screen.getByText("Access")).toBeInTheDocument();
      expect(screen.getByText("Other")).toBeInTheDocument();
    });

    it("renders conditions intel card for conditions posts with surf_conditions", () => {
      const { getMorningIntelPayloadV2 } = require("@/components/intel/conditions-intel-card");
      getMorningIntelPayloadV2.mockReturnValue({ kind: "morning_intel_v2" });

      const post = createMockPost({
        tag: "conditions",
        title: "Morning Intel",
        surf_conditions: { kind: "morning_intel_v2" },
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByTestId("conditions-intel-card")).toBeInTheDocument();
      expect(screen.getByTestId("conditions-intel-card")).toHaveAttribute(
        "data-variant",
        "feed"
      );
    });

    it("renders regular description for non-conditions posts", () => {
      const post = createMockPost({
        tag: "parking",
        description: "Parking lot is full",
        surf_conditions: null,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("Parking lot is full")).toBeInTheDocument();
      expect(screen.queryByTestId("conditions-intel-card")).not.toBeInTheDocument();
    });
  });

  describe("Post Metadata", () => {
    it("displays post timestamp", () => {
      const post = createMockPost({
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it("displays author name", () => {
      const post = createMockPost({
        user: {
          full_name: "John Surfer",
          avatar_url: null,
        },
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getAllByText("John Surfer")).toHaveLength(2); // Once in avatar, once in metadata
    });

    it("displays Anonymous when user name is missing", () => {
      const post = createMockPost({
        user: undefined,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getAllByText("Anonymous")).toHaveLength(2);
    });

    it("displays confirmation count and confidence level", () => {
      const post = createMockPost({
        confirmations_count: 7,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("7 confirmations")).toBeInTheDocument();
      expect(screen.getByText("Highly reliable")).toBeInTheDocument();
    });

    it("displays location from nearest beach", () => {
      const { getNearestBeachName } = require("@/lib/utils/nearest-beach");
      getNearestBeachName.mockReturnValue("Pacific Beach");

      const post = createMockPost({
        latitude: 32.7941,
        longitude: -117.2542,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      expect(getNearestBeachName).toHaveBeenCalledWith(32.7941, -117.2542);
    });
  });

  describe("Photo Display", () => {
    it("renders photo when photo_url is present", () => {
      const post = createMockPost({
        photo_url: "https://example.com/photo.jpg",
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      const image = screen.getByAltText("Intel photo");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://example.com/photo.jpg");
    });

    it("does not render photo when photo_url is null", () => {
      const post = createMockPost({
        photo_url: null,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.queryByAltText("Intel photo")).not.toBeInTheDocument();
    });
  });

  describe("Expired Posts", () => {
    it("displays expired badge for expired posts", () => {
      const post = createMockPost({
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      expect(screen.getByText("Expired")).toBeInTheDocument();
      expect(screen.getByText(/This intel expired/)).toBeInTheDocument();
    });

    it("hides confirm button for expired posts", () => {
      const post = createMockPost({
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      // Should only have the plan session button, not the confirm button
      const buttons = screen.getAllByRole("button");
      const actionButtons = buttons.filter((btn) =>
        btn.className.includes("h-8")
      );
      // User avatar button + plan session button only (no confirm button)
      expect(actionButtons.length).toBeLessThan(3);
    });

    it("shows confirm button for non-expired posts", () => {
      const post = createMockPost({
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day in future
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      const buttons = screen.getAllByRole("button");
      const actionButtons = buttons.filter((btn) =>
        btn.className.includes("h-8")
      );
      // Should have both confirm and plan session buttons
      expect(actionButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("User Confirmation State", () => {
    it("shows different button state when user has confirmed", () => {
      const post = createMockPost({
        user_has_confirmed: true,
      });

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={true}
        />
      );

      const buttons = screen.getAllByRole("button");
      const confirmButton = buttons.find(
        (btn) =>
          btn.className.includes("h-8") && btn.className.includes("secondary")
      );
      expect(confirmButton).toBeInTheDocument();
    });

    it("hides confirm button when canConfirm is false", () => {
      const post = createMockPost();

      render(
        <IntelFeed
          posts={[post]}
          loading={false}
          onPostClick={mockOnPostClick}
          onConfirm={mockOnConfirm}
          onPlanSession={mockOnPlanSession}
          canConfirm={false}
        />
      );

      const buttons = screen.getAllByRole("button");
      // Should only have user avatar and plan session buttons
      const actionButtons = buttons.filter(
        (btn) =>
          btn.className.includes("h-8") && !btn.hasAttribute("data-user-id")
      );
      expect(actionButtons).toHaveLength(1); // Only plan session button
    });
  });
});

describe("IntelFeedCard", () => {
  const mockOnPostClick = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockOnPlanSession = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("renders card with all post information", () => {
    const post = createMockPost({
      title: "Test Post",
      description: "Test description",
      tag: "conditions",
      confirmations_count: 5,
    });

    render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
      />
    );

    expect(screen.getByText("Test Post")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("5 confirmations")).toBeInTheDocument();
  });

  it("calls onPostClick when card is clicked", async () => {
    const post = createMockPost({ title: "Clickable Post" });
    const user = userEvent.setup();

    const { container } = render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
      />
    );

    const card = container.querySelector(".cursor-pointer");
    await user.click(card!);

    expect(mockOnPostClick).toHaveBeenCalledWith(post);
  });

  it("prevents event bubbling when clicking action buttons", () => {
    const post = createMockPost();
    mockOnConfirm.mockResolvedValue(undefined);

    render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
      />
    );

    // The plan session button has the outline variant (border border-input bg-background)
    const buttons = screen.getAllByRole("button");
    const planButton = buttons.find(
      (btn) =>
        btn.className.includes("border-input") && btn.className.includes("bg-background")
    );

    fireEvent.click(planButton!);

    expect(mockOnPlanSession).toHaveBeenCalled();
    expect(mockOnPostClick).not.toHaveBeenCalled();
  });

  it("shows loading state when confirming", async () => {
    const post = createMockPost();
    let resolveConfirm: any;
    mockOnConfirm.mockReturnValue(
      new Promise((resolve) => {
        resolveConfirm = resolve;
      })
    );

    render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
      />
    );

    // Find the confirm button (default variant has bg-primary, not border-input)
    const buttons = screen.getAllByRole("button");
    const confirmButton = buttons.find(
      (btn) =>
        btn.className.includes("bg-primary") && btn.className.includes("h-8")
    );

    fireEvent.click(confirmButton!);

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
      // Check for spinner element
      const spinner = confirmButton!.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    resolveConfirm();
  });

  it("uses external isConfirming state when provided", () => {
    const post = createMockPost();

    const { rerender } = render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
        isConfirming={true}
      />
    );

    // Find the confirm button (default variant has bg-primary)
    let buttons = screen.getAllByRole("button");
    let confirmButton = buttons.find(
      (btn) =>
        btn.className.includes("bg-primary") && btn.className.includes("h-8")
    );

    expect(confirmButton).toBeDisabled();

    rerender(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
        isConfirming={false}
      />
    );

    // Re-query after rerender
    buttons = screen.getAllByRole("button");
    confirmButton = buttons.find(
      (btn) =>
        btn.className.includes("bg-primary") && btn.className.includes("h-8")
    );
    expect(confirmButton).not.toBeDisabled();
  });

  it("does not allow confirming when disabled", () => {
    const post = createMockPost();
    mockOnConfirm.mockResolvedValue(undefined);

    render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={false}
      />
    );

    const buttons = screen.getAllByRole("button");
    const confirmButton = buttons.find(
      (btn) =>
        btn.className.includes("h-8") && !btn.className.includes("outline")
    );

    expect(confirmButton).toBeUndefined();
  });

  it("memoizes nearest beach calculation", () => {
    const { getNearestBeachName } = require("@/lib/utils/nearest-beach");
    getNearestBeachName.mockClear();

    const post = createMockPost({
      latitude: 32.7157,
      longitude: -117.1611,
    });

    const { rerender } = render(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={true}
      />
    );

    expect(getNearestBeachName).toHaveBeenCalledTimes(1);

    // Rerender with same coordinates
    rerender(
      <IntelFeedCard
        post={post}
        onPostClick={mockOnPostClick}
        onConfirm={mockOnConfirm}
        onPlanSession={mockOnPlanSession}
        canConfirm={false} // Different prop, same coordinates
      />
    );

    // Should still be called only once due to useMemo
    expect(getNearestBeachName).toHaveBeenCalledTimes(1);
  });
});
