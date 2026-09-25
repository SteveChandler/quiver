import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextualCTA, ContextualCTAProps } from "@/components/oracle/contextual-cta";

const baseProps: ContextualCTAProps = {
  hasHomeBeach: true,
  hasSessionToday: false,
  totalSessions: 3,
  followingCount: 1,
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

    it("leads with 'Log a session' on an ordinary day instead of an invite", () => {
      render(<ContextualCTA {...makeProps()} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveTextContent(/log a session/i);
      expect(
        screen.queryByRole("button", { name: /invite a friend/i })
      ).not.toBeInTheDocument();
    });

    it("asks a surfer with no sessions to log their first", () => {
      render(<ContextualCTA {...makeProps({ totalSessions: 0 })} />);
      expect(
        screen.getByText("Log a session. We'll sharpen the forecast.")
      ).toBeInTheDocument();
      expect(screen.getAllByRole("button")[0]).toHaveTextContent(/log a session/i);
    });

    it("invites only after 5+ sessions with nobody followed (native parity)", () => {
      const { rerender } = render(
        <ContextualCTA {...makeProps({ totalSessions: 5, followingCount: 0 })} />
      );
      expect(screen.getAllByRole("button")[0]).toHaveTextContent(/invite a friend/i);

      rerender(<ContextualCTA {...makeProps({ totalSessions: 4, followingCount: 0 })} />);
      expect(
        screen.queryByRole("button", { name: /invite a friend/i })
      ).not.toBeInTheDocument();

      rerender(<ContextualCTA {...makeProps({ totalSessions: 12, followingCount: 2 })} />);
      expect(
        screen.queryByRole("button", { name: /invite a friend/i })
      ).not.toBeInTheDocument();
    });

    it("does not fire count-gated asks while counts are unknown", () => {
      render(
        <ContextualCTA {...makeProps({ totalSessions: null, followingCount: null })} />
      );
      expect(screen.getAllByRole("button")[0]).toHaveTextContent(/log a session/i);
      expect(
        screen.queryByText("Log a session. We'll sharpen the forecast.")
      ).not.toBeInTheDocument();
    });

    it("fallback secondary row offers 'Log a session', not 'Share your session'", () => {
      render(
        <ContextualCTA
          {...makeProps({
            hasHomeBeach: true,
            hasSessionToday: false,
            conditionsGood: false,
          })}
        />
      );
      expect(
        screen.getByRole("button", { name: /log a session/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /share your session/i })
      ).not.toBeInTheDocument();
    });

    it("calls onLogSession when the fallback 'Log a session' button is clicked", async () => {
      const user = userEvent.setup();
      const onLogSession = jest.fn();
      render(
        <ContextualCTA
          {...makeProps({
            hasHomeBeach: true,
            hasSessionToday: false,
            conditionsGood: false,
            onLogSession,
          })}
        />
      );
      await user.click(screen.getByRole("button", { name: /log a session/i }));
      expect(onLogSession).toHaveBeenCalledTimes(1);
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
