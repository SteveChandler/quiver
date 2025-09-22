import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { FavoriteButton } from "@/components/favorite-button";
import { useAuth } from "@/context/auth-context";
import * as favoriteBeachActions from "@/actions/beach/beach-favorite-actions";

jest.mock("@/context/auth-context");
jest.mock("@/actions/beach/beach-favorite-actions");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const actions = favoriteBeachActions as jest.Mocked<
  typeof favoriteBeachActions
>;
const originalFetch = global.fetch as any;

describe("FavoriteButton", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@example.com" } as any,
      session: null as any,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    actions.getFavoriteBeaches.mockResolvedValue({
      success: true,
      data: [],
    } as any);
    actions.addFavoriteBeach.mockResolvedValue({ success: true } as any);
    actions.removeFavoriteBeach.mockResolvedValue({ success: true } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("toggles aria-label on click (optimistic)", async () => {
    // First call add -> success, second call remove -> success
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, action: "added" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, action: "removed" }),
      } as any);

    render(<FavoriteButton beachId="b1" />);

    // After initial load, should show Add to favorites
    const btn = await screen.findByRole("button", {
      name: /add to favorites/i,
    });

    // Click to add -> label should flip to Remove from favorites
    fireEvent.click(btn);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /remove from favorites/i })
      ).toBeInTheDocument();
    });

    // Click to remove -> label should flip back to Add to favorites
    fireEvent.click(
      screen.getByRole("button", { name: /remove from favorites/i })
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add to favorites/i })
      ).toBeInTheDocument();
    });
  });

  it("reverts on server error", async () => {
    // Force API to return success:false so component reverts optimistic state
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: "boom" }),
      } as any);

    render(<FavoriteButton beachId="b2" />);
    const btn = await screen.findByRole("button", {
      name: /add to favorites/i,
    });

    fireEvent.click(btn);

    // Optimistic flip then revert to Add to favorites when API fails
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add to favorites/i })
      ).toBeInTheDocument();
    });
  });
});
