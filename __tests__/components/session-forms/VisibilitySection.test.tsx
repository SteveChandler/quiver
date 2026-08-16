/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import { VisibilitySection } from "@/components/session-forms/VisibilitySection";

// Mock framer-motion to avoid animation complexities in tests
jest.mock("framer-motion", () => {
  const React = require("react");
  const toDomProps = (props: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(props).flatMap(([key, value]) => {
        if (!["initial", "animate", "exit", "transition"].includes(key)) {
          return [[key, value]];
        }
        if (value === undefined) return [];
        return [[`data-motion-${key}`, JSON.stringify(value)]];
      })
    );

  return {
    useReducedMotion: jest.fn(() => false),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: React.forwardRef(
        (
          { children, ...props }: { children?: React.ReactNode } & Record<
            string,
            unknown
          >,
          ref: React.Ref<HTMLDivElement>
        ) => (
          <div
            ref={ref}
            {...toDomProps(props)}
          >
            {children}
          </div>
        )
      ),
      label: React.forwardRef(
        (
          { children, ...props }: { children?: React.ReactNode } & Record<
            string,
            unknown
          >,
          ref: React.Ref<HTMLLabelElement>
        ) => (
          <label ref={ref} {...toDomProps(props)}>
            {children}
          </label>
        )
      ),
      p: React.forwardRef(
        (
          { children, ...props }: { children?: React.ReactNode } & Record<
            string,
            unknown
          >,
          ref: React.Ref<HTMLParagraphElement>
        ) => (
          <p ref={ref} {...toDomProps(props)}>
            {children}
          </p>
        )
      ),
    },
  };
});

const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;

afterEach(() => {
  mockUseReducedMotion.mockReturnValue(false);
});

describe("VisibilitySection", () => {
  it("renders with Public selected by default", () => {
    render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    const publicBtn = screen.getByRole("button", { name: /public/i });
    expect(publicBtn).toHaveAttribute("data-active", "true");
  });

  it("shows mute checkbox only when public", () => {
    const { rerender } = render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    expect(screen.getByText(/keep it off the feed/i)).toBeInTheDocument();

    rerender(
      <VisibilitySection
        isPublic={false}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    expect(
      screen.queryByText(/keep it off the feed/i)
    ).not.toBeInTheDocument();
  });

  it("shows privacy note when private", () => {
    render(
      <VisibilitySection
        isPublic={false}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );
    expect(
      screen.getByText(/still help improve forecast accuracy/i)
    ).toBeInTheDocument();
  });

  it("uses grid rows and an overflow wrapper for both collapsing sections", () => {
    const { rerender } = render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );

    const muteSection = screen
      .getByText(/keep it off the feed/i)
      .closest("div.grid") as HTMLElement;
    expect(muteSection).toHaveAttribute(
      "data-motion-initial",
      JSON.stringify({ gridTemplateRows: "0fr", opacity: 0 })
    );
    expect(muteSection).toHaveAttribute(
      "data-motion-animate",
      JSON.stringify({ gridTemplateRows: "1fr", opacity: 1 })
    );
    expect(muteSection.getAttribute("data-motion-initial")).not.toContain("height");
    expect(muteSection.getAttribute("data-motion-animate")).not.toContain("height");
    expect(muteSection.firstElementChild).toHaveClass("overflow-hidden");

    rerender(
      <VisibilitySection
        isPublic={false}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );

    const privacySection = screen
      .getByText(/still help improve forecast accuracy/i)
      .closest("div.grid") as HTMLElement;
    expect(privacySection).toHaveAttribute(
      "data-motion-initial",
      JSON.stringify({ gridTemplateRows: "0fr", opacity: 0 })
    );
    expect(privacySection).toHaveAttribute(
      "data-motion-animate",
      JSON.stringify({ gridTemplateRows: "1fr", opacity: 1 })
    );
    expect(privacySection.firstElementChild).toHaveClass("overflow-hidden");
  });

  it("skips Framer Motion collapse animation when reduced motion is requested", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={jest.fn()}
        onMutedChange={jest.fn()}
      />
    );

    const muteSection = screen
      .getByText(/keep it off the feed/i)
      .closest("div.grid") as HTMLElement;
    expect(muteSection).toHaveAttribute("data-motion-initial", "false");
    expect(muteSection).not.toHaveAttribute("data-motion-animate");
    expect(muteSection).not.toHaveAttribute("data-motion-exit");
    expect(muteSection).toHaveAttribute(
      "data-motion-transition",
      JSON.stringify({ duration: 0 })
    );
  });

  it("calls onPublicChange when toggling", () => {
    const onPublicChange = jest.fn();
    render(
      <VisibilitySection
        isPublic={true}
        isMuted={false}
        onPublicChange={onPublicChange}
        onMutedChange={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /just me/i }));
    expect(onPublicChange).toHaveBeenCalledWith(false);
  });

  it("resets muted when switching to private", () => {
    const onMutedChange = jest.fn();
    render(
      <VisibilitySection
        isPublic={true}
        isMuted={true}
        onPublicChange={jest.fn()}
        onMutedChange={onMutedChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /just me/i }));
    expect(onMutedChange).toHaveBeenCalledWith(false);
  });
});
