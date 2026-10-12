/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ZineUtilityStrip } from "@/components/beach-detail/zine/zine-utility-strip";
import type { Beach } from "@/types/database";

const mockAuth: { user: { id: string } | null } = { user: null };

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: mockAuth.user, isLoading: false }),
  useOptionalAuth: () => ({ user: mockAuth.user, isLoading: false }),
}));

const beach = { id: "beach-1", name: "La Jolla Shores", state: "CA" } as Beach;

describe("ZineUtilityStrip", () => {
  beforeEach(() => {
    mockAuth.user = null;
  });

  it("renders nothing for a signed-out visitor when there is no water or amenity data", () => {
    const { container } = render(
      <ZineUtilityStrip beach={beach} amenities={null} waterQuality={null} onWriteReview={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the review prompt to a signed-in surfer even without data", () => {
    mockAuth.user = { id: "user-1" };

    render(
      <ZineUtilityStrip beach={beach} amenities={null} waterQuality={null} onWriteReview={jest.fn()} />,
    );

    expect(screen.getByRole("region", { name: "Spot facts and utility" })).toBeInTheDocument();
    expect(screen.getByText("Be the first to review")).toBeInTheDocument();
  });
});
