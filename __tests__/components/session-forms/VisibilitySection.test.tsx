/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VisibilitySection } from "@/components/session-forms/VisibilitySection";

// Mock framer-motion to avoid animation complexities in tests
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      label: React.forwardRef(
        (
          { children, ...props }: { children?: React.ReactNode } & Record<
            string,
            unknown
          >,
          ref: React.Ref<HTMLLabelElement>
        ) => (
          <label ref={ref} {...props}>
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
          <p ref={ref} {...props}>
            {children}
          </p>
        )
      ),
    },
  };
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
