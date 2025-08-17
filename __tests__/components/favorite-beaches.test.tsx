import { render, screen } from "@testing-library/react";
import { FavoriteBeaches } from "@/components/favorite-beaches";

// Mock auth context to provide a user (required to attempt loading favorites)
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user-id", email: "dev@local.test" } }),
}));

// Mock actions to return empty favorites list
jest.mock("@/actions/beach-actions", () => ({
  getFavoriteBeaches: jest.fn().mockResolvedValue({ success: true, data: [] }),
  removeFavoriteBeach: jest.fn(),
}));

// Mock Next.js Link to render a normal anchor
jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe("FavoriteBeaches empty state", () => {
  it("renders Explore beaches link pointing to /map", async () => {
    render(<FavoriteBeaches />);

    // Wait for empty state to render
    const exploreLink = await screen.findByRole("link", {
      name: /explore beaches/i,
    });
    expect(exploreLink).toHaveAttribute("href", "/map");
  });
});
