import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Integration test demonstrating the current follower count sync issue
// This shows the behavior we need to fix on the discover page

describe("Follower Count Synchronization Current Behavior", () => {
  describe("Component state isolation demonstration", () => {
    it("should demonstrate the disconnect between parent and child component state", async () => {
      // Simulate the current discover page behavior where:
      // - Parent component displays follower count from search API
      // - FollowButton manages its own internal state
      // - No communication between them (this is the bug)

      const SimulateDiscoverPageBehavior = () => {
        // This represents the search result data from the API
        const [searchUserData] = React.useState({
          id: "user-2",
          full_name: "Luna",
          followers_count: 0, // From search API
        });

        // This represents a FollowButton with its own internal state
        const [buttonInternalCount, setButtonInternalCount] = React.useState(0);
        const [following, setFollowing] = React.useState(false);

        const handleFollowClick = () => {
          const newFollowing = !following;
          const newCount = newFollowing
            ? buttonInternalCount + 1
            : buttonInternalCount - 1;

          setFollowing(newFollowing);
          setButtonInternalCount(newCount);
          // Bug: No communication back to parent about count change
        };

        return (
          <div>
            {/* This represents the search result display */}
            <div data-testid="search-result-display">
              <h3>{searchUserData.full_name}</h3>
              <p data-testid="search-follower-count">
                {searchUserData.followers_count} followers
              </p>
            </div>

            {/* This represents the FollowButton's internal state */}
            <div data-testid="follow-button-section">
              <button onClick={handleFollowClick} data-testid="follow-button">
                {following ? "Unfollow" : "Follow"}
              </button>
              <span data-testid="button-internal-count">
                Button knows: {buttonInternalCount}
              </span>
            </div>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<SimulateDiscoverPageBehavior />);

      // Initial state - both show 0
      expect(screen.getByTestId("search-follower-count")).toHaveTextContent(
        "0 followers"
      );
      expect(screen.getByTestId("button-internal-count")).toHaveTextContent(
        "Button knows: 0"
      );

      // Click follow button
      const followButton = screen.getByTestId("follow-button");
      await user.click(followButton);

      // Demonstrate the bug: search result count doesn't update, but button count does
      expect(screen.getByTestId("search-follower-count")).toHaveTextContent(
        "0 followers"
      ); // Bug: doesn't update
      expect(screen.getByTestId("button-internal-count")).toHaveTextContent(
        "Button knows: 1"
      ); // Button updates

      // This demonstrates why navigating to profile page shows correct count
      // (profile page fetches fresh data, not using stale search results)
    });

    it("should show how profile page would display correct count", () => {
      // Simulate profile page behavior (fetches fresh data)
      const SimulateProfilePageBehavior = () => {
        // Profile page fetches fresh data from database
        const [profileData] = React.useState({
          id: "user-2",
          full_name: "Luna",
          followers_count: 1, // Fresh from database after follow action
        });

        return (
          <div data-testid="profile-page">
            <h1>{profileData.full_name}</h1>
            <div data-testid="profile-stats">
              <span data-testid="profile-follower-count">
                {profileData.followers_count} Followers
              </span>
            </div>
          </div>
        );
      };

      render(<SimulateProfilePageBehavior />);

      // Profile page shows correct count because it fetches fresh data
      expect(screen.getByTestId("profile-follower-count")).toHaveTextContent(
        "1 Followers"
      );
    });
  });

  describe("Real-world scenario simulation", () => {
    it("should simulate the exact Luna scenario described by user", () => {
      // This test simulates the exact flow:
      // 1. Search Luna on discover page -> shows 0 followers
      // 2. Follow Luna -> page count stays 0, button knows it's 1
      // 3. Navigate to Luna's profile -> shows 1 follower (fresh data)

      const AppSimulation = () => {
        const [currentPage, setCurrentPage] = React.useState<
          "discover" | "profile"
        >("discover");
        const [searchResults] = React.useState([
          { id: "luna", full_name: "Luna", followers_count: 0 },
        ]);
        const [profileData] = React.useState({
          id: "luna",
          full_name: "Luna",
          followers_count: 1, // Profile has fresh data
        });

        // Simulate FollowButton internal state
        const [buttonState, setButtonState] = React.useState({
          following: false,
          internalCount: 0,
        });

        const handleFollow = () => {
          setButtonState((prev) => ({
            following: !prev.following,
            internalCount: prev.following
              ? prev.internalCount - 1
              : prev.internalCount + 1,
          }));
        };

        return (
          <div>
            <nav>
              <button onClick={() => setCurrentPage("discover")}>
                Discover
              </button>
              <button onClick={() => setCurrentPage("profile")}>Profile</button>
            </nav>

            {currentPage === "discover" && (
              <div data-testid="discover-page">
                <h1>Discover Page</h1>
                {searchResults.map((user) => (
                  <div key={user.id}>
                    <h3>{user.full_name}</h3>
                    <p data-testid={`discover-count-${user.id}`}>
                      {user.followers_count} followers {/* Stale from search */}
                    </p>
                    <button onClick={handleFollow}>
                      {buttonState.following ? "Unfollow" : "Follow"}
                    </button>
                    <span data-testid={`button-count-${user.id}`}>
                      Button: {buttonState.internalCount}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {currentPage === "profile" && (
              <div data-testid="profile-page">
                <h1>Profile Page</h1>
                <p data-testid={`profile-count-${profileData.id}`}>
                  {profileData.followers_count} Followers {/* Fresh from DB */}
                </p>
              </div>
            )}
          </div>
        );
      };

      const user = userEvent.setup();
      render(<AppSimulation />);

      // Start on discover page
      expect(screen.getByTestId("discover-page")).toBeInTheDocument();
      expect(screen.getByTestId("discover-count-luna")).toHaveTextContent(
        "0 followers"
      );

      // Follow Luna
      const followButton = screen.getByRole("button", { name: /follow/i });
      fireEvent.click(followButton);

      // Bug: discover page count stays 0, button count goes to 1
      expect(screen.getByTestId("discover-count-luna")).toHaveTextContent(
        "0 followers"
      );
      expect(screen.getByTestId("button-count-luna")).toHaveTextContent(
        "Button: 1"
      );

      // Navigate to profile page
      const profileButton = screen.getByRole("button", { name: /profile/i });
      fireEvent.click(profileButton);

      // Profile page shows correct count (fresh data)
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
      expect(screen.getByTestId("profile-count-luna")).toHaveTextContent(
        "1 Followers"
      );
    });
  });
});
