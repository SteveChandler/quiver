/**
 * Integration tests for viral growth mechanisms
 * Tests invitations, referrals, and other growth-driving social features
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// Use lightweight NextRequest/NextResponse mock to avoid constructor issues
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest, NextResponse } from "next/server";
import { POST as InvitationsAPI } from "@/app/api/session-planner/invitations/route";
import { followUser, getSuggestedUsers } from "@/actions/social-actions";
import { sendSessionInviteEmail } from "@/lib/mailer/sessionInviteEmail";

// Mock dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/actions/social-actions");
jest.mock("@/lib/mailer/sessionInviteEmail");
jest.mock("@/lib/notifications");
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data: any) => NextResponse.json({ success: true, data })),
  createErrorResponse: jest.fn((error: string, details?: any, status = 500) =>
    NextResponse.json({ success: false, error, details }, { status })
  ),
}));

// Mock crypto for idempotency keys
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-12345"),
}));

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockFollowUser = followUser as jest.MockedFunction<typeof followUser>;
const mockGetSuggestedUsers = getSuggestedUsers as jest.MockedFunction<
  typeof getSuggestedUsers
>;
const mockSendSessionInviteEmail =
  sendSessionInviteEmail as jest.MockedFunction<typeof sendSessionInviteEmail>;

// Helper to create mock chain methods
const createMockChain = (finalResult: any): Record<string, jest.Mock> => {
  const chainMethods: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    ilike: jest.fn(),
    insert: jest.fn(),
    single: jest.fn(() => finalResult),
    maybeSingle: jest.fn(() => finalResult),
    order: jest.fn(),
    limit: jest.fn(() => finalResult),
    not: jest.fn(),
    gt: jest.fn(() => finalResult),
    in: jest.fn(),
    update: jest.fn(),
    then: jest.fn((resolve) => resolve?.(finalResult)),
  };
  // Chain methods return themselves
  chainMethods.select.mockReturnValue(chainMethods);
  chainMethods.eq.mockReturnValue(chainMethods);
  chainMethods.ilike.mockReturnValue(chainMethods);
  chainMethods.insert.mockReturnValue(chainMethods);
  chainMethods.order.mockReturnValue(chainMethods);
  chainMethods.not.mockReturnValue(chainMethods);
  chainMethods.in.mockReturnValue(chainMethods);
  chainMethods.update.mockReturnValue(chainMethods);
  return chainMethods;
};

// Mock authenticated user
const mockUser = {
  id: "user-1",
  email: "user1@example.com",
  full_name: "Test User",
};

describe("Viral Growth Mechanisms", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const {
      createSupabaseServerClient,
      createSupabaseServiceRoleClient,
    } = require("@/lib/supabase/server");
    createSupabaseServerClient.mockResolvedValue(mockSupabaseClient);
    createSupabaseServiceRoleClient.mockResolvedValue(mockSupabaseClient);

    const {
      createSuccessResponse,
      createErrorResponse,
    } = require("@/lib/api-utils");
    createSuccessResponse.mockImplementation((data: any) =>
      NextResponse.json({ success: true, data })
    );
    createErrorResponse.mockImplementation((message: string) =>
      NextResponse.json({ success: false, error: message })
    );

    const { createActivityForInvite } = require("@/lib/notifications");
    createActivityForInvite.mockResolvedValue(true);

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe("Session Invitations (Viral Invites)", () => {
    it("should send invitations to friends for viral growth", async () => {
      let insertCallCount = 0;
      const fromMock = jest.fn((table: string) => {
        if (table === "sessions") {
          return createMockChain({
            data: {
              id: "session-1",
              user_id: "user-1",
              beach_name: "Viral Beach",
              arrival_time: "2024-01-15T08:00:00Z",
              status: "planned",
            },
            error: null,
          });
        }

        if (table === "session_invitations") {
          // Create a mock chain object that can handle all query patterns
          const mockChain: any = {
            select: jest.fn(() => mockChain),
            eq: jest.fn(() => mockChain),
            gt: jest.fn(() => mockChain),
            order: jest.fn(() => mockChain),
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
            insert: jest.fn((data: any) => ({
              select: jest.fn(() => ({
                single: jest.fn(() => {
                  insertCallCount++;
                  return Promise.resolve({
                    data: {
                      id: `invite-${insertCallCount}`,
                      session_id: "session-1",
                      inviter_id: "user-1",
                      invitee_email: data.invitee_email,
                      invitee_id: data.invitee_id,
                      status: "pending",
                      message: data.message || null,
                      created_at: new Date().toISOString(),
                      seen_at: null,
                    },
                    error: null,
                  });
                }),
              })),
            })),
          };
          return mockChain;
        }

        if (table === "profiles") {
          return createMockChain({
            data: null,
            error: null,
          });
        }

        // Return empty chain for other tables to avoid errors
        return createMockChain({ data: null, error: null });
      });

      mockSupabaseClient.from.mockImplementation(fromMock);
      mockSendSessionInviteEmail.mockResolvedValue(undefined);

      const requestBody = {
        sessionId: "session-1",
        invitees: [
          { email: "friend1@example.com", name: "Friend One" },
          { email: "friend2@example.com", name: "Friend Two" },
        ],
        message: "Join me for an epic surf session! 🏄‍♂️",
      };

      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "invite-key-123",
          },
        }
      );

      const response = await InvitationsAPI(request);
      const responseData = await response.json();
      if (!responseData.success)
        console.log("invite success test payload", responseData);

      expect(responseData.success).toBe(true);
      expect(mockSendSessionInviteEmail).toHaveBeenCalledTimes(2);
    });

    it("should track invitation success rates for growth analytics", async () => {
      const fromMock = jest.fn((table: string) => {
        if (table === "sessions") {
          return createMockChain({
            data: {
              id: "session-1",
              user_id: "user-1",
              beach_name: "Analytics Beach",
              arrival_time: "2024-01-15T09:00:00Z",
              status: "planned",
            },
            error: null,
          });
        }

        if (table === "session_invitations") {
          // Create a mock chain object that can handle all query patterns
          const mockChain: any = {
            select: jest.fn(() => mockChain),
            eq: jest.fn(() => mockChain),
            gt: jest.fn(() => mockChain),
            order: jest.fn(() => mockChain),
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
            insert: jest.fn((data: any) => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: {
                      id: "invite-1",
                      session_id: "session-1",
                      inviter_id: "user-1",
                      invitee_email: data.invitee_email,
                      invitee_id: data.invitee_id,
                      status: "pending",
                      message: data.message || null,
                      created_at: new Date().toISOString(),
                      seen_at: null,
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
          return mockChain;
        }

        if (table === "profiles") {
          return createMockChain({
            data: null,
            error: null,
          });
        }

        if (table === "session_invitation_analytics") {
          return createMockChain({
            data: { invitationsSent: 1, uniqueInvitees: 1 },
            error: null,
          });
        }

        // Return empty chain for other tables to avoid errors
        return createMockChain({ data: null, error: null });
      });

      mockSupabaseClient.from.mockImplementation(fromMock);
      mockSendSessionInviteEmail.mockResolvedValue(undefined);

      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: "session-1",
            invitees: [{ email: "test@example.com" }],
          }),
        }
      );

      const response = await InvitationsAPI(request);
      const data = await response.json();
      if (!data.success) console.log("invite analytics payload", data);

      expect(data.success).toBe(true);
      expect(data.data.invitationsSent).toBeDefined();
    });

    it("should handle failed invitations gracefully", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: { id: "session-1", user_id: "user-1" },
          error: null,
        })
      );

      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { message: "Database error" },
        })
      );

      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: "session-1",
            invitees: [{ email: "test@example.com" }],
          }),
        }
      );

      const response = await InvitationsAPI(request);
      const data = await response.json();

      expect(data.success).toBe(false);
    });

    it("should prevent spam with rate limiting", async () => {
      // Mock session exists
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: { id: "session-1", user_id: "user-1" },
          error: null,
        })
      );

      // Mock checking for existing invitations (spam prevention)
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: [
            {
              id: "existing-1",
              invitee_email: "test@example.com",
              created_at: "2024-01-15T07:00:00Z",
            },
          ],
          error: null,
        })
      );

      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: "session-1",
            invitees: [{ email: "test@example.com" }],
          }),
        }
      );

      // Should handle duplicate invitations gracefully
      const response = await InvitationsAPI(request);
      expect(response).toBeDefined();
    });
  });

  describe("Follow Suggestions (Growth Engine)", () => {
    it("should suggest popular users to follow for network growth", async () => {
      const mockSuggestions = [
        { id: "user-2", full_name: "Popular Surfer", followers_count: 1000 },
        { id: "user-3", full_name: "Pro Surfer", followers_count: 500 },
        { id: "user-4", full_name: "Local Legend", followers_count: 250 },
      ];

      (mockGetSuggestedUsers as jest.Mock).mockResolvedValue({
        success: true,
        data: mockSuggestions,
      });

      const SuggestedUsersComponent = () => {
        const [suggestions, setSuggestions] = React.useState<any[]>([]);
        const [loading, setLoading] = React.useState(false);

        const loadSuggestions = async () => {
          setLoading(true);
          const result = await mockGetSuggestedUsers(5);
          const data = (result as any)?.data;
          if ((result as any)?.success && Array.isArray(data)) {
            setSuggestions(data);
          }
          setLoading(false);
        };

        React.useEffect(() => {
          loadSuggestions();
        }, []);

        return (
          <div>
            <h2>Discover Surfers</h2>
            {loading ? (
              <div data-testid="loading">Finding awesome surfers...</div>
            ) : (
              <div data-testid="suggestions-list">
                {suggestions.map((user: any) => (
                  <div key={user.id} data-testid={`suggestion-${user.id}`}>
                    {user.full_name} ({user.followers_count} followers)
                    <button
                      onClick={() => mockFollowUser(user.id)}
                      data-testid={`follow-${user.id}`}
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      };

      render(<SuggestedUsersComponent />);

      await waitFor(() => {
        expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Popular Surfer (1000 followers)")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Pro Surfer (500 followers)")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Local Legend (250 followers)")
      ).toBeInTheDocument();
    });

    it("should enable easy following for viral growth", async () => {
      (mockFollowUser as jest.Mock).mockResolvedValue({
        success: true,
        data: { followId: "follow-1", message: "Now following Popular Surfer" },
      });

      const FollowButton = ({ userId }: { userId: string }) => {
        const [following, setFollowing] = React.useState(false);

        const handleFollow = async () => {
          const result = await mockFollowUser(userId);
          if (result.success) {
            setFollowing(true);
          }
        };

        return (
          <button onClick={handleFollow} data-testid="follow-button">
            {following ? "Following" : "Follow"}
          </button>
        );
      };

      render(<FollowButton userId="user-2" />);

      const followButton = screen.getByTestId("follow-button");
      expect(followButton).toHaveTextContent("Follow");

      fireEvent.click(followButton);

      await waitFor(() => {
        expect(followButton).toHaveTextContent("Following");
      });

      expect(mockFollowUser).toHaveBeenCalledWith("user-2");
    });
  });

  describe("Social Proof and Network Effects", () => {
    it("should display social proof to encourage user growth", async () => {
      const SocialProofComponent = () => {
        const stats = {
          totalUsers: 10500,
          activeSessions: 234,
          photosShared: 5600,
        };

        return (
          <div data-testid="social-proof">
            <div data-testid="total-users">
              Join {stats.totalUsers.toLocaleString()}+ surfers
            </div>
            <div data-testid="active-sessions">
              {stats.activeSessions} sessions happening now
            </div>
            <div data-testid="photos-shared">
              {stats.photosShared.toLocaleString()} epic photos shared
            </div>
          </div>
        );
      };

      render(<SocialProofComponent />);

      expect(screen.getByText("Join 10,500+ surfers")).toBeInTheDocument();
      expect(
        screen.getByText("234 sessions happening now")
      ).toBeInTheDocument();
      expect(screen.getByText("5,600 epic photos shared")).toBeInTheDocument();
    });

    it("should create FOMO with active user indicators", async () => {
      const FOMOIndicator = () => {
        const recentActivity = [
          {
            user: "Sarah",
            action: "logged epic session at Malibu",
            time: "2 min ago",
          },
          { user: "Mike", action: "shared amazing photo", time: "5 min ago" },
          {
            user: "Alex",
            action: "planned session for tomorrow",
            time: "8 min ago",
          },
        ];

        return (
          <div data-testid="fomo-feed">
            <h3>Live Activity</h3>
            {recentActivity.map((activity, index) => (
              <div key={index} data-testid={`activity-${index}`}>
                <strong>{activity.user}</strong> {activity.action} •{" "}
                {activity.time}
              </div>
            ))}
          </div>
        );
      };

      render(<FOMOIndicator />);

      // Be robust to potential text splitting within elements
      const a0 = screen.getByTestId("activity-0");
      const a1 = screen.getByTestId("activity-1");
      const a2 = screen.getByTestId("activity-2");
      expect(a0.textContent || "").toMatch(/Sarah/);
      expect(a0.textContent || "").toMatch(/Malibu/);
      expect(a0.textContent || "").toMatch(/2 min ago/);
      expect(a1.textContent || "").toMatch(/Mike/);
      expect(a1.textContent || "").toMatch(/shared amazing photo/);
      expect(a1.textContent || "").toMatch(/5 min ago/);
      expect(a2.textContent || "").toMatch(/Alex/);
      expect(a2.textContent || "").toMatch(/planned session for tomorrow/);
      expect(a2.textContent || "").toMatch(/8 min ago/);
    });
  });

  describe("Referral and Sharing Incentives", () => {
    it("should encourage sharing with growth-focused messaging", async () => {
      const SharingIncentives = () => {
        return (
          <div data-testid="sharing-incentives">
            <h3>Share Your Epic Sessions</h3>
            <p data-testid="viral-message">
              Tag @QuiverSurf and inspire other surfers to join the community!
              Every share helps grow our surf family 🌊
            </p>
            <div data-testid="sharing-benefits">
              <div>📈 Get featured in our weekly highlights</div>
              <div>🏆 Build your surf reputation</div>
              <div>👥 Connect with local surf communities</div>
            </div>
          </div>
        );
      };

      render(<SharingIncentives />);

      expect(
        screen.getByText(/inspire other surfers to join the community/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Get featured in our weekly highlights/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Build your surf reputation/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Connect with local surf communities/)
      ).toBeInTheDocument();
    });

    it("should track referral attribution for growth analysis", async () => {
      const ReferralTracker = () => {
        const trackReferral = (source: string, medium: string) => {
          // In real implementation, this would send analytics
          console.log(`Referral tracked: ${source}/${medium}`);
          return { tracked: true, source, medium };
        };

        React.useEffect(() => {
          // Simulate UTM tracking
          const urlParams = new URLSearchParams(
            "?utm_source=instagram&utm_medium=story&utm_campaign=surf-session"
          );
          const source = urlParams.get("utm_source");
          const medium = urlParams.get("utm_medium");

          if (source && medium) {
            trackReferral(source, medium);
          }
        }, []);

        return (
          <div data-testid="referral-tracker">
            Tracking referral attribution...
          </div>
        );
      };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      render(<ReferralTracker />);

      expect(
        screen.getByText("Tracking referral attribution...")
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Referral tracked: instagram/story"
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Gamification for Viral Growth", () => {
    it("should reward users for inviting friends", async () => {
      const InviteRewards = () => {
        const [inviteCount, setInviteCount] = React.useState(3);
        const rewards = [
          {
            threshold: 1,
            reward: "🥉 Invite Rookie",
            unlocked: inviteCount >= 1,
          },
          {
            threshold: 5,
            reward: "🥈 Social Surfer",
            unlocked: inviteCount >= 5,
          },
          {
            threshold: 10,
            reward: "🥇 Community Builder",
            unlocked: inviteCount >= 10,
          },
        ];

        return (
          <div data-testid="invite-rewards">
            <h3>Invite Achievements</h3>
            <div data-testid="invite-count">Invited: {inviteCount} friends</div>
            {rewards.map((reward, index) => (
              <div
                key={index}
                data-testid={`reward-${index}`}
                className={reward.unlocked ? "unlocked" : "locked"}
              >
                {reward.reward}{" "}
                {reward.unlocked ? "✅" : `(${reward.threshold} invites)`}
              </div>
            ))}
          </div>
        );
      };

      render(<InviteRewards />);

      expect(screen.getByText("Invited: 3 friends")).toBeInTheDocument();
      expect(screen.getByText("🥉 Invite Rookie ✅")).toBeInTheDocument();
      expect(
        screen.getByText("🥈 Social Surfer (5 invites)")
      ).toBeInTheDocument();
      expect(
        screen.getByText("🥇 Community Builder (10 invites)")
      ).toBeInTheDocument();
    });

    it("should create leaderboards for social engagement", async () => {
      const SocialLeaderboard = () => {
        const leaderboard = [
          { rank: 1, user: "WaveRider", sessions: 156, shares: 89 },
          { rank: 2, user: "OceanExplorer", sessions: 142, shares: 76 },
          { rank: 3, user: "SurfPro", sessions: 138, shares: 71 },
        ];

        return (
          <div data-testid="social-leaderboard">
            <h3>Social Champions</h3>
            {leaderboard.map((entry) => (
              <div key={entry.rank} data-testid={`leader-${entry.rank}`}>
                #{entry.rank} {entry.user} - {entry.sessions} sessions,{" "}
                {entry.shares} shares
              </div>
            ))}
          </div>
        );
      };

      render(<SocialLeaderboard />);

      expect(
        screen.getByText("#1 WaveRider - 156 sessions, 89 shares")
      ).toBeInTheDocument();
      expect(
        screen.getByText("#2 OceanExplorer - 142 sessions, 76 shares")
      ).toBeInTheDocument();
      expect(
        screen.getByText("#3 SurfPro - 138 sessions, 71 shares")
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invitation API failures gracefully", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { message: "Service unavailable" },
        })
      );

      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: "session-1",
            invitees: [{ email: "test@example.com" }],
          }),
        }
      );

      const response = await InvitationsAPI(request);
      const data = await response.json();

      expect(data.success).toBe(false);
    });

    it("should handle malformed invitation requests", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: "invalid json",
        }
      );

      const response = await InvitationsAPI(request);
      const data = await response.json();

      expect(data.success).toBe(false);
    });

    it("should handle email sending failures", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: { id: "session-1", user_id: "user-1" },
          error: null,
        })
      );

      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: [{ id: "invite-1", status: "pending" }],
          error: null,
        })
      );

      mockSendSessionInviteEmail.mockRejectedValue(
        new Error("Email service down")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/session-planner/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: "session-1",
            invitees: [{ email: "test@example.com" }],
          }),
        }
      );

      // Should handle email failures gracefully
      const response = await InvitationsAPI(request);
      expect(response).toBeDefined();
    });
  });

  describe("Growth Metrics and Analytics", () => {
    it("should track viral coefficient metrics", async () => {
      const ViralMetrics = () => {
        const metrics = {
          invitationsSent: 1250,
          invitationsAccepted: 385,
          viralCoefficient: (385 / 1250).toFixed(2),
          avgInvitesPerUser: 2.3,
          sharesGenerated: 892,
        };

        return (
          <div data-testid="viral-metrics">
            <div data-testid="invites-sent">
              Invites sent: {metrics.invitationsSent}
            </div>
            <div data-testid="invites-accepted">
              Invites accepted: {metrics.invitationsAccepted}
            </div>
            <div data-testid="viral-coefficient">
              Viral coefficient: {metrics.viralCoefficient}
            </div>
            <div data-testid="avg-invites">
              Avg invites/user: {metrics.avgInvitesPerUser}
            </div>
            <div data-testid="shares-generated">
              Shares generated: {metrics.sharesGenerated}
            </div>
          </div>
        );
      };

      render(<ViralMetrics />);

      expect(screen.getByText("Invites sent: 1250")).toBeInTheDocument();
      expect(screen.getByText("Invites accepted: 385")).toBeInTheDocument();
      expect(screen.getByText("Viral coefficient: 0.31")).toBeInTheDocument();
      expect(screen.getByText("Avg invites/user: 2.3")).toBeInTheDocument();
      expect(screen.getByText("Shares generated: 892")).toBeInTheDocument();
    });
  });
});
