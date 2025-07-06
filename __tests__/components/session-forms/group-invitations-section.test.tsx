import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupInvitationsSection } from "@/components/session-forms/GroupInvitationsSection";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import {
  mockFriends,
  mockSessionFormState,
  mockAuthContext,
  createMockDataFetcherResponse,
  setupMockFetch,
} from "../../setup/session-planner-test-utils";

// Mock the hooks
jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/context/auth-context");

const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock social actions
jest.mock("@/actions/social-actions", () => ({
  getUserFollowing: jest.fn().mockResolvedValue({
    success: true,
    data: mockFriends.map((friend) => ({ following: friend })),
  }),
}));

// Mock fetch
setupMockFetch();

describe("GroupInvitationsSection", () => {
  const mockUpdateField = jest.fn();

  const defaultProps = {
    formState: mockSessionFormState,
    updateField: mockUpdateField,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext);
    mockUseDataFetcher.mockReturnValue(
      createMockDataFetcherResponse(mockFriends, false)
    );
  });

  describe("Basic rendering", () => {
    it("should render invitation section with title", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.getByText("Invite Friends (Optional)")).toBeInTheDocument();
    });

    it("should show information box about how group sessions work", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.getByText("How group sessions work:")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Friends receive notifications when you save the session/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Perfect for coordinating dawn patrol sessions!/)
      ).toBeInTheDocument();
    });
  });

  describe("Friends list", () => {
    it("should render friends from following list", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.getByText("Your Surf Buddies")).toBeInTheDocument();
      expect(screen.getByText("John Surfer")).toBeInTheDocument();
      expect(screen.getByText("Sarah Wave")).toBeInTheDocument();
    });

    it("should show friend avatars", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      // Check for avatar fallback text content since no actual images are loaded in tests
      expect(screen.getByText("J")).toBeInTheDocument(); // John's avatar
      expect(screen.getByText("S")).toBeInTheDocument(); // Sarah's avatar
    });

    it("should allow selecting friends", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      expect(screen.getByText("Selected Friends (1)")).toBeInTheDocument();
    });

    it("should show selected friends with remove button", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      expect(screen.getByText("Selected Friends (1)")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /remove friend John Surfer/i })
      ).toBeInTheDocument();
    });

    it("should allow removing selected friends", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      // Select friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Remove friend
      const removeButton = screen.getByRole("button", {
        name: /remove friend/i,
      });
      await user.click(removeButton);

      expect(screen.queryByText("Selected Friends")).not.toBeInTheDocument();
    });

    it("should show check mark for selected friends", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      expect(screen.getByTestId("check-circle-icon")).toBeInTheDocument();
    });

    it("should handle empty friends list gracefully", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse([], false)
      );

      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.queryByText("Your Surf Buddies")).not.toBeInTheDocument();
    });

    it("should handle null friends data gracefully", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false)
      );

      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.queryByText("Your Surf Buddies")).not.toBeInTheDocument();
    });
  });

  describe("Email input", () => {
    it("should render email input section", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.getByText("Invite by Email")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "Enter email addresses (separated by commas)"
        )
      ).toBeInTheDocument();
    });

    it("should validate email addresses", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(
        emailInput,
        "valid@example.com, invalid-email, another@example.com"
      );

      await waitFor(() => {
        expect(screen.getByText("valid@example.com")).toBeInTheDocument();
        expect(screen.getByText("another@example.com")).toBeInTheDocument();
        expect(
          screen.getByText(/Invalid emails: invalid-email/)
        ).toBeInTheDocument();
      });
    });

    it("should show valid emails as badges", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, "test@example.com, another@test.com");

      await waitFor(() => {
        expect(screen.getByText("test@example.com")).toBeInTheDocument();
        expect(screen.getByText("another@test.com")).toBeInTheDocument();
      });
    });

    it("should show error for invalid emails", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, "invalid-email, bad-format");

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid emails: invalid-email, bad-format/)
        ).toBeInTheDocument();
      });
    });

    it("should handle comma-separated email input", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(
        emailInput,
        "first@example.com,second@example.com, third@example.com"
      );

      await waitFor(() => {
        expect(screen.getByText("first@example.com")).toBeInTheDocument();
        expect(screen.getByText("second@example.com")).toBeInTheDocument();
        expect(screen.getByText("third@example.com")).toBeInTheDocument();
      });
    });
  });

  describe("Invitation message", () => {
    it("should show invitation message textarea when invitees are selected", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      // Select a friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      expect(
        screen.getByText("Invitation Message (Optional)")
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "Add a personal message to your invitation..."
        )
      ).toBeInTheDocument();
    });

    it("should show invitation message when emails are entered", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, "test@example.com");

      await waitFor(() => {
        expect(
          screen.getByText("Invitation Message (Optional)")
        ).toBeInTheDocument();
      });
    });

    it("should show character count for invitation message", async () => {
      const user = userEvent.setup();
      const propsWithEmptyMessage = {
        ...defaultProps,
        formState: {
          ...defaultProps.formState,
          invitationMessage: "", // Start with empty message
        },
      };
      render(<GroupInvitationsSection {...propsWithEmptyMessage} />);

      // Select a friend first
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      const messageInput = screen.getByPlaceholderText(
        "Add a personal message to your invitation..."
      );
      await user.type(messageInput, "Hello world!");

      expect(screen.getByText("12/200 characters")).toBeInTheDocument();
    });

    it("should enforce character limit", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      // Select a friend first
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      const messageInput = screen.getByPlaceholderText(
        "Add a personal message to your invitation..."
      );
      const longMessage = "a".repeat(250);
      await user.type(messageInput, longMessage);

      expect(messageInput).toHaveAttribute("maxLength", "200");
    });
  });

  describe("Invitation preview", () => {
    it("should show invitation preview when invitees are selected", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      expect(screen.getByText("Invitation Preview")).toBeInTheDocument();
      expect(screen.getByText("Who: 1 people")).toBeInTheDocument();
      expect(screen.getByText("Where: Ocean Beach")).toBeInTheDocument();
      expect(
        screen.getByText("When: 2024-01-17 at 06:00:00")
      ).toBeInTheDocument();
    });

    it("should show invitation message in preview", async () => {
      const user = userEvent.setup();
      const propsWithEmptyMessage = {
        ...defaultProps,
        formState: {
          ...defaultProps.formState,
          invitationMessage: "", // Start with empty message
        },
      };
      render(<GroupInvitationsSection {...propsWithEmptyMessage} />);

      // Select a friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Add message
      const messageInput = screen.getByPlaceholderText(
        "Add a personal message to your invitation..."
      );
      await user.type(messageInput, "Dawn patrol tomorrow!");

      await waitFor(() => {
        expect(
          screen.getByText('Message: "Dawn patrol tomorrow!"')
        ).toBeInTheDocument();
      });
    });

    it("should count both friends and emails in total people", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      // Select a friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Add email
      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, "test@example.com");

      await waitFor(() => {
        expect(screen.getByText("Who: 2 people")).toBeInTheDocument();
      });
    });
  });

  describe("Quick invite templates", () => {
    it("should show quick invite templates when no invitees are selected", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.getByText("Dawn Patrol Template")).toBeInTheDocument();
      expect(screen.getByText("Epic Conditions Template")).toBeInTheDocument();
    });

    it("should apply dawn patrol template", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const dawnPatrolButton = screen.getByText("Dawn Patrol Template");
      await user.click(dawnPatrolButton);

      expect(mockUpdateField).toHaveBeenCalledWith(
        "invitationMessage",
        "Dawn patrol tomorrow! Who's in? 🌅🏄‍♂️"
      );
    });

    it("should apply epic conditions template", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const epicButton = screen.getByText("Epic Conditions Template");
      await user.click(epicButton);

      expect(mockUpdateField).toHaveBeenCalledWith(
        "invitationMessage",
        "Conditions looking epic! Let's get some waves 🤙"
      );
    });

    it("should hide templates when invitees are selected", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      expect(
        screen.queryByText("Dawn Patrol Template")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Epic Conditions Template")
      ).not.toBeInTheDocument();
    });
  });

  describe("Form state updates", () => {
    it("should update invitees when friends are selected", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith(
          "invitees",
          expect.arrayContaining([
            expect.objectContaining({
              userId: "friend-1",
              email: "john@example.com",
              name: "John Surfer",
            }),
          ])
        );
      });
    });

    it("should update invitees when emails are entered", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, "test@example.com");

      await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith(
          "invitees",
          expect.arrayContaining([
            expect.objectContaining({
              email: "test@example.com",
              name: "test",
            }),
          ])
        );
      });
    });

    it("should update invitation message", async () => {
      const user = userEvent.setup();
      const propsWithEmptyMessage = {
        ...defaultProps,
        formState: {
          ...defaultProps.formState,
          invitationMessage: "", // Start with empty message
        },
      };
      render(<GroupInvitationsSection {...propsWithEmptyMessage} />);

      // Select a friend first to show message input
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      const messageInput = screen.getByPlaceholderText(
        "Add a personal message to your invitation..."
      );
      await user.clear(messageInput); // Clear any existing content
      await user.type(messageInput, "Hey there!");

      await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith(
          "invitationMessage",
          "Hey there!"
        );
      });
    });

    it("should combine friends and emails in invitees array", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      // Select friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Add email
      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, "extra@example.com");

      await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith(
          "invitees",
          expect.arrayContaining([
            expect.objectContaining({
              userId: "friend-1",
              email: "john@example.com",
              name: "John Surfer",
            }),
            expect.objectContaining({
              email: "extra@example.com",
              name: "extra",
            }),
          ])
        );
      });
    });
  });

  describe("Authentication handling", () => {
    it("should not fetch friends when user is not authenticated", () => {
      mockUseAuth.mockReturnValue({
        ...mockAuthContext,
        user: null,
      });

      render(<GroupInvitationsSection {...defaultProps} />);

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: false,
      });
    });

    it("should fetch friends when user is authenticated", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: true,
      });
    });
  });

  describe("Error handling", () => {
    it("should handle fetch errors gracefully", () => {
      const error = new Error("Failed to fetch friends");
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false, error)
      );

      render(<GroupInvitationsSection {...defaultProps} />);

      // Should not show friends section but should still allow email input
      expect(screen.queryByText("Your Surf Buddies")).not.toBeInTheDocument();
      expect(screen.getByText("Invite by Email")).toBeInTheDocument();
    });

    it("should handle loading state", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(<GroupInvitationsSection {...defaultProps} />);

      // Should still render the component but without friends data
      expect(screen.getByText("Invite Friends (Optional)")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper labels for form inputs", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      // Check that email input has proper labeling
      expect(screen.getByLabelText("Invite by Email")).toBeInTheDocument();
    });

    it("should have proper button roles", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const friendButtons = screen.getAllByRole("button");
      expect(friendButtons.length).toBeGreaterThan(0);

      // Each friend button should be clickable
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);
      expect(johnButton).toHaveAttribute("aria-pressed"); // or similar accessibility indicator
    });

    it("should have descriptive placeholders", () => {
      render(<GroupInvitationsSection {...defaultProps} />);

      expect(
        screen.getByPlaceholderText(
          "Enter email addresses (separated by commas)"
        )
      ).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle friends with missing avatar URLs", () => {
      const friendsWithMissingAvatars = [
        { ...mockFriends[0], avatar_url: null },
        { ...mockFriends[1], avatar_url: undefined },
      ];

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(friendsWithMissingAvatars, false)
      );

      render(<GroupInvitationsSection {...defaultProps} />);

      expect(screen.getByText("John Surfer")).toBeInTheDocument();
      expect(screen.getByText("Sarah Wave")).toBeInTheDocument();
    });

    it("should handle friends with missing names", () => {
      const friendsWithMissingNames = [
        { ...mockFriends[0], full_name: null },
        { ...mockFriends[1], full_name: "" },
      ];

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(friendsWithMissingNames, false)
      );

      render(<GroupInvitationsSection {...defaultProps} />);

      // Should fallback to email
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("sarah@example.com")).toBeInTheDocument();
    });

    it("should handle malformed email input gracefully", async () => {
      const user = userEvent.setup();
      render(<GroupInvitationsSection {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(
        "Enter email addresses (separated by commas)"
      );
      await user.type(emailInput, ",,, @@@, ");

      // Should not crash and should handle empty/invalid entries
      expect(screen.queryByText("Invalid emails")).not.toBeInTheDocument();
    });
  });
});
