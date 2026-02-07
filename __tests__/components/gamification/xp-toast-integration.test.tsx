import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { useGamification } from "@/hooks/use-gamification";

// Mock trackXP to simulate a successful XP award
jest.mock("@/lib/gamification", () => ({
  trackXP: jest.fn(async () => ({
    success: true,
    data: {
      xp_gained: 50,
      total_xp: 150,
      previous_level: 1,
      new_level: 2,
      level_up: true,
      level_title: "Grom",
      new_badges: [],
    },
  })),
  getUserXPStatus: jest.fn(async () => ({ success: true, data: null })),
  getUserBadges: jest.fn(async () => ({ success: true, data: [] })),
}));

// Prevent canvas-confetti from touching HTMLCanvasElement in JSDOM
jest.mock("canvas-confetti", () => ({
  __esModule: true,
  default: jest.fn(() => undefined),
}));

function TriggerXPButton() {
  const { trackUserXP } = useGamification();
  return (
    <button onClick={() => trackUserXP("plan_session", "sess-1", "session")}>Gain XP</button>
  );
}

describe("XP Toast Integration", () => {
  test("shows XP toast and level-up notification", async () => {
    render(
      <div>
        <Toaster />
        <TriggerXPButton />
      </div>
    );

    fireEvent.click(screen.getByText("Gain XP"));

    // Expect level-up toast content (toast limit is 1, so level-up may replace XP toast)
    await waitFor(() => {
      expect(screen.getByText(/Level Up!/i)).toBeInTheDocument();
      expect(screen.getByText(/Grom/)).toBeInTheDocument();
    });
  });
});
