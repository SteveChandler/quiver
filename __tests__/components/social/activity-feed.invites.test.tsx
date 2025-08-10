import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/social/activity-feed";

jest.mock("@/hooks/use-activity-feed", () => ({
  useActivityFeed: () => ({
    activities: [
      {
        id: "a1",
        user_id: "u1",
        activity_type: "session_invite.created",
        entity_type: "session",
        entity_id: "s1",
        metadata: { beachName: "Ocean Beach", when: "2025-08-10T08:00:00Z" },
        created_at: "2025-08-10T07:00:00Z",
        user_name: "Inviter",
        user_avatar: null,
      },
    ],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: jest.fn(),
    refresh: jest.fn(),
    isLoadingMore: false,
  }),
}));

describe("ActivityFeed - session_invite.created", () => {
  it("renders invite text with beach and time", () => {
    render(<ActivityFeed userId="u2" />);
    expect(screen.getByText(/invited you to surf/i)).toBeInTheDocument();
    expect(screen.getByText(/Ocean Beach/i)).toBeInTheDocument();
  });
});



