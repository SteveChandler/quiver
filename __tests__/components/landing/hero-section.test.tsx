import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroSection } from "@/components/landing-page/hero-section";

// Mock HTMLMediaElement.play (JSDOM doesn't implement it)
beforeAll(() => {
  HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = jest.fn();
});

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    alt = "",
    ...props
  }: Record<string, unknown>) => {
    return <img alt={String(alt)} {...props} />;
  },
}));

// Mock framer-motion to avoid animation complexity in tests
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            variants: _variants,
            initial: _initial,
            animate: _animate,
            whileInView: _whileInView,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        }
      ),
      h1: React.forwardRef(
        (
          props: Record<string, unknown>,
          ref: React.Ref<HTMLHeadingElement>
        ) => {
          const { variants: _variants, ...rest } = props;
          return <h1 ref={ref} {...rest} />;
        }
      ),
      p: React.forwardRef(
        (
          props: Record<string, unknown>,
          ref: React.Ref<HTMLParagraphElement>
        ) => {
          const { variants: _variants, ...rest } = props;
          return <p ref={ref} {...rest} />;
        }
      ),
    },
    useInView: () => true,
  };
});

// Mock UnifiedAuthModal
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({
    isOpen,
    mode,
  }: {
    isOpen: boolean;
    mode: string;
  }) =>
    isOpen ? (
      <div data-testid="auth-modal" data-mode={mode}>
        Auth Modal
      </div>
    ) : null,
}));

// Mock analytics
jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
}));

// Mock CONTENT
jest.mock("@/lib/constants/features", () => ({
  CONTENT: {
    hero: {
      title: "Quiver: Your best days on repeat.",
      subtitle:
        "Log your sessions, teach Quiver what works for you, and get alerts when the forecast lines up again.",
      cta: "Get my surf call",
      secondaryCta: "Find your spots",
    },
  },
}));

describe("HeroSection", () => {
  it("renders the hero headline from CONTENT", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", {
        name: /quiver: your best days on repeat\./i,
      })
    ).toBeInTheDocument();
  });

  it("renders the subtitle text", () => {
    render(<HeroSection />);
    expect(
      screen.getByText(
        "Log your sessions, teach Quiver what works for you, and get alerts when the forecast lines up again."
      )
    ).toBeInTheDocument();
  });

  it("renders the primary CTA button with correct text", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("button", {
      name: /get my surf call/i,
    });
    expect(cta).toBeInTheDocument();
  });

  it("renders the spots secondary CTA linking to /beginner/san-diego", () => {
    render(<HeroSection />);
    const secondary = screen.getByRole("link", { name: /find your spots/i });
    expect(secondary).toBeInTheDocument();
    expect(secondary).toHaveAttribute("href", "/beginner/san-diego");
  });

  it("opens auth modal in signup mode when primary CTA is clicked", async () => {
    const user = userEvent.setup();
    render(<HeroSection />);

    const cta = screen.getByRole("button", {
      name: /get my surf call/i,
    });
    await user.click(cta);

    const modal = screen.getByTestId("auth-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-mode", "signup");
  });

  it("does not call trackAuthModalOpened from click handler (canonical fire is in modal useEffect)", async () => {
    const { trackAuthModalOpened } = require("@/lib/analytics/auth-events");
    const user = userEvent.setup();
    render(<HeroSection />);

    const cta = screen.getByRole("button", {
      name: /get my surf call/i,
    });
    await user.click(cta);

    expect(trackAuthModalOpened).not.toHaveBeenCalled();
  });

  it("does not render HeroCarousel or HeroMatchDemo", () => {
    render(<HeroSection />);
    expect(screen.queryByTestId("hero-carousel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-match-demo")).not.toBeInTheDocument();
  });

  it("does not render a search bar", () => {
    render(<HeroSection />);
    expect(
      screen.queryByPlaceholderText(/search by beach/i)
    ).not.toBeInTheDocument();
  });
});
