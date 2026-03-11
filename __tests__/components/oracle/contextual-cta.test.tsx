import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextualCTA, ContextualCTAProps } from "@/components/oracle/contextual-cta";

const baseProps: ContextualCTAProps = {
  hasHomeBeach: true,
  hasSessionToday: false,
  hasFollows: false,
  conditionsGood: false,
  preferredTime: null,
  onSetHomeBeach: jest.fn(),
  onLogSession: jest.fn(),
  onInviteFriend: jest.fn(),
  onSetAlarm: jest.fn(),
  onShareSession: jest.fn(),
};

function makeProps(overrides: Partial<ContextualCTAProps> = {}): ContextualCTAProps {
  return {
    ...baseProps,
    onSetHomeBeach: jest.fn(),
    onLogSession: jest.fn(),
    onInviteFriend: jest.fn(),
    onSetAlarm: jest.fn(),
    onShareSession: jest.fn(),
    ...overrides,
  };
}

describe("ContextualCTA", () => {
  describe("primary CTA priority logic", () => {
    it("shows 'Set your home beach' when user has no home beach", () => {
      render(<ContextualCTA {...makeProps({ hasHomeBeach: false })} />);
      expect(
        screen.getByRole("button", { name: /set your home beach/i })
      ).toBeInTheDocument();
    });

    it("shows 'Share your session' when session was logged today", () => {
      render(
        <ContextualCTA
          {...makeProps({ hasHomeBeach: true, hasSessionToday: true })}
        />
      );
      expect(
        screen.getByRole("button", { name: /share your session/i })
      ).toBeInTheDocument();
    });

    it("shows 'Paddle out' when home beach is set and conditions are good", () => {
      render(
        <ContextualCTA
          {...makeProps({
            hasHomeBeach: true,
            hasSessionToday: false,
            conditionsGood: true,
          })}
        />
      );
      expect(
        screen.getByRole("button", { name: /paddle out/i })
      ).toBeInTheDocument();
    });

    it("shows 'Tell your crew' when user has follows but conditions are not good", () => {
      render(
        <ContextualCTA
          {...makeProps({
            hasHomeBeach: true,
            hasSessionToday: false,
            conditionsGood: false,
            hasFollows: true,
          })}
        />
      );
      expect(
        screen.getByRole("button", { name: /tell your crew/i })
      ).toBeInTheDocument();
    });

    it("shows 'Invite a friend' as default when no other conditions match", () => {
      render(
        <ContextualCTA
          {...makeProps({
            hasHomeBeach: true,
            hasSessionToday: false,
            conditionsGood: false,
            hasFollows: false,
          })}
        />
      );
      // The primary button should say "Invite a friend"
      const buttons = screen.getAllByRole("button", { name: /invite a friend/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it("'Set your home beach' takes priority over a logged session today", () => {
      render(
        <ContextualCTA
          {...makeProps({ hasHomeBeach: false, hasSessionToday: true })}
        />
      );
      expect(
        screen.getByRole("button", { name: /set your home beach/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /share your session/i })
      ).not.toBeInTheDocument();
    });

    it("'Share session' takes priority over good conditions", () => {
      render(
        <ContextualCTA
          {...makeProps({
            hasHomeBeach: true,
            hasSessionToday: true,
            conditionsGood: true,
          })}
        />
      );
      // Share session (outline/secondary) is primary here — paddle out should not appear
      expect(
        screen.getByRole("button", { name: /share your session/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /paddle out/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("callback invocations", () => {
    it("calls onSetHomeBeach when 'Set your home beach' is clicked", async () => {
      const user = userEvent.setup();
      const onSetHomeBeach = jest.fn();
      render(
        <ContextualCTA {...makeProps({ hasHomeBeach: false, onSetHomeBeach })} />
      );
      await user.click(
        screen.getByRole("button", { name: /set your home beach/i })
      );
      expect(onSetHomeBeach).toHaveBeenCalledTimes(1);
    });

    it("calls onLogSession when 'Paddle out' is clicked", async () => {
      const user = userEvent.setup();
      const onLogSession = jest.fn();
      render(
        <ContextualCTA
          {...makeProps({ hasHomeBeach: true, conditionsGood: true, onLogSession })}
        />
      );
      await user.click(screen.getByRole("button", { name: /paddle out/i }));
      expect(onLogSession).toHaveBeenCalledTimes(1);
    });

    it("calls onShareSession when 'Share your session' is clicked", async () => {
      const user = userEvent.setup();
      const onShareSession = jest.fn();
      render(
        <ContextualCTA
          {...makeProps({ hasHomeBeach: true, hasSessionToday: true, onShareSession })}
        />
      );
      await user.click(
        screen.getByRole("button", { name: /share your session/i })
      );
      expect(onShareSession).toHaveBeenCalledTimes(1);
    });

    it("calls onSetAlarm when 'Set alarm' secondary button is clicked", async () => {
      const user = userEvent.setup();
      const onSetAlarm = jest.fn();
      render(
        <ContextualCTA {...makeProps({ hasHomeBeach: false, onSetAlarm })} />
      );
      await user.click(screen.getByRole("button", { name: /set alarm/i }));
      expect(onSetAlarm).toHaveBeenCalledTimes(1);
    });

    it("calls onInviteFriend when 'Invite a friend' secondary button is clicked", async () => {
      const user = userEvent.setup();
      const onInviteFriend = jest.fn();
      render(
        <ContextualCTA {...makeProps({ hasHomeBeach: false, onInviteFriend })} />
      );
      await user.click(screen.getByRole("button", { name: /invite a friend/i }));
      expect(onInviteFriend).toHaveBeenCalledTimes(1);
    });
  });

  describe("secondary row rendering", () => {
    it("renders two secondary buttons in the secondary row", () => {
      render(<ContextualCTA {...makeProps({ hasHomeBeach: false })} />);
      // Two secondary buttons visible alongside the primary
      expect(screen.getByRole("button", { name: /set alarm/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /invite a friend/i })).toBeInTheDocument();
    });
  });
});
