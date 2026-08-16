import { render, screen } from "@testing-library/react";
import { BeachReviewsList } from "@/components/beach/beach-reviews-list";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { BeachReviewWithUser } from "@/types/database";

jest.mock("@/actions/beach-review-actions", () => ({
  getBeachReviews: jest.fn(),
  deleteBeachReview: jest.fn(),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/components/social/user-avatar-button", () => ({
  UserAvatarButton: ({ name }: { name: string }) => <span>{name}</span>,
}));

jest.mock("@/components/ui/star-rating", () => ({
  StarRating: () => <span aria-hidden="true">★★★★★</span>,
}));

describe("BeachReviewsList accessibility", () => {
  it("names review edit and delete controls and hides their icons", () => {
    const review = {
      id: "review-1",
      user_id: "user-1",
      profiles: {
        id: "user-1",
        full_name: "Test Surfer",
        avatar_url: null,
      },
      overall_rating: 4,
      wave_quality_rating: 4,
      crowd_density_rating: 3,
      parking_rating: 4,
      accessibility_rating: 5,
      created_at: null,
      visit_date: null,
      title: "Good morning waves",
      content: "A fun, clean session.",
    } as unknown as BeachReviewWithUser;

    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
    (useDataFetcher as jest.Mock).mockReturnValue({
      data: [review],
      loading: false,
      refetch: jest.fn(),
    });

    render(<BeachReviewsList beachId="beach-1" />);

    const editButton = screen.getByRole("button", { name: "Edit review" });
    const deleteButton = screen.getByRole("button", { name: "Delete review" });

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    expect(editButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(deleteButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
