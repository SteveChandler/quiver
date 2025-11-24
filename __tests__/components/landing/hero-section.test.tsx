import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/landing-page/hero-section";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/components/beach/beach-search-autocomplete", () => {
  return {
    BeachSearchAutocomplete: ({
      onFallback,
      onQueryChange,
    }: {
      onFallback?: (query: string) => void;
      onQueryChange?: (query: string) => void;
    }) => {
      // Simple mock that behaves like a text input wired to the callbacks.
      const [value, setValue] = React.useState("");
      return (
        <input
          aria-label="Beach search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onQueryChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onFallback?.(value);
            }
          }}
        />
      );
    },
  };
});

describe("HeroSection landing search", () => {
  const push = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push });
    push.mockReset();
  });

  it("falls back to map search with query when pressing Enter", async () => {
    const user = userEvent.setup();
    render(<HeroSection />);

    const input = screen.getByLabelText("Beach search");

    await user.type(input, "ocean beach{enter}");

    expect(push).toHaveBeenCalledWith(
      "/map?search=" + encodeURIComponent("ocean beach")
    );
  });

  it("navigates to plain map when Explore nearby spots is clicked with empty query", async () => {
    const user = userEvent.setup();
    render(<HeroSection />);

    const exploreLink = screen.getByRole("link", {
      name: /explore nearby spots/i,
    });

    await user.click(exploreLink);

    expect(push).toHaveBeenCalledWith("/map");
  });
});
