import React from "react";
import { render, screen } from "@testing-library/react";
import UserProfileClient from "@/app/user/[id]/user-profile-client";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "user-2" }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));
jest.mock("@/components/social/follow-button", () => ({
  FollowButton: () => null,
}));
jest.mock("@/components/social/user-social-stats", () => ({
  UserSocialStats: () => null,
}));

const baseProfile = {
  id: "user-2",
  full_name: "Kelly",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  followers_count: 0,
  following_count: 0,
  session_count: 0,
  isOwnProfile: false,
};

function renderWithProfile(profile: Record<string, unknown>) {
  (useDataFetcher as jest.Mock).mockReturnValue({ data: profile, loading: false, error: null });
  return render(<UserProfileClient />);
}

describe("UserProfileClient Instagram handle", () => {
  it("shows the public Instagram handle as a link", () => {
    renderWithProfile({ ...baseProfile, instagram: "@kelly.s" });

    const link = screen.getByRole("link", { name: /@kelly\.s on Instagram/ });
    expect(link).toHaveAttribute("href", "https://instagram.com/kelly.s");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the link when the surfer has no handle", () => {
    renderWithProfile({ ...baseProfile, instagram: null });

    expect(screen.queryByRole("link", { name: /on Instagram/ })).not.toBeInTheDocument();
  });
});
