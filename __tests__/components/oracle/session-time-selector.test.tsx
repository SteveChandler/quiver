import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { SessionTimeSelector } from "@/components/oracle/session-time-selector";
import type { SessionTimeSelectorProps } from "@/components/oracle/session-time-selector";

function makeProps(overrides: Partial<SessionTimeSelectorProps> = {}): SessionTimeSelectorProps {
  return {
    onSelect: jest.fn(),
    ...overrides,
  };
}

describe("SessionTimeSelector", () => {
  describe("prompt text", () => {
    it("renders the prompt question", () => {
      render(<SessionTimeSelector {...makeProps()} />);
      expect(
        screen.getByText(/when do you usually paddle out/i)
      ).toBeInTheDocument();
    });
  });

  describe("options rendering", () => {
    it("renders all six time options", () => {
      render(<SessionTimeSelector {...makeProps()} />);
      expect(screen.getByText("Dawn Patrol")).toBeInTheDocument();
      expect(screen.getByText("Morning")).toBeInTheDocument();
      expect(screen.getByText("Lunch")).toBeInTheDocument();
      expect(screen.getByText("Afternoon")).toBeInTheDocument();
      expect(screen.getByText("Evening")).toBeInTheDocument();
      expect(screen.getByText("Any time")).toBeInTheDocument();
    });

    it("renders time range labels", () => {
      render(<SessionTimeSelector {...makeProps()} />);
      expect(screen.getByText("4–7am")).toBeInTheDocument();
      expect(screen.getByText("Flexible")).toBeInTheDocument();
    });
  });

  describe("selected state", () => {
    it("applies selected styles to the matching option", () => {
      render(<SessionTimeSelector {...makeProps({ currentValue: "morning" })} />);
      const morningButton = screen.getByRole("button", { name: /morning/i });
      expect(morningButton).toHaveClass("border-[#FDB84B]");
      expect(morningButton).toHaveClass("bg-[#FDB84B]/10");
    });

    it("does not apply selected styles to non-matching options", () => {
      render(<SessionTimeSelector {...makeProps({ currentValue: "morning" })} />);
      const afternoonButton = screen.getByRole("button", { name: /afternoon/i });
      expect(afternoonButton).not.toHaveClass("border-[#FDB84B]");
    });

    it("renders with no selection when currentValue is null", () => {
      render(<SessionTimeSelector {...makeProps({ currentValue: null })} />);
      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).not.toHaveClass("border-[#FDB84B]");
      });
    });
  });

  describe("onSelect callback", () => {
    it("calls onSelect with the correct value when a button is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      render(<SessionTimeSelector {...makeProps({ onSelect })} />);

      await user.click(screen.getByRole("button", { name: /dawn patrol/i }));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("dawn_patrol");
    });

    it("calls onSelect with 'any' when 'Any time' is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      render(<SessionTimeSelector {...makeProps({ onSelect })} />);

      await user.click(screen.getByRole("button", { name: /any time/i }));
      expect(onSelect).toHaveBeenCalledWith("any");
    });

    it("calls onSelect with the correct value for each option", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      render(<SessionTimeSelector {...makeProps({ onSelect })} />);

      const expectedCalls = [
        { name: /dawn patrol/i, value: "dawn_patrol" },
        { name: /morning/i, value: "morning" },
        { name: /lunch/i, value: "lunch" },
        { name: /afternoon/i, value: "afternoon" },
        { name: /evening/i, value: "evening" },
        { name: /any time/i, value: "any" },
      ];

      for (const { name, value } of expectedCalls) {
        await user.click(screen.getByRole("button", { name }));
        expect(onSelect).toHaveBeenCalledWith(value);
      }

      expect(onSelect).toHaveBeenCalledTimes(6);
    });
  });
});
