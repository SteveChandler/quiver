"use client";

import { Button } from "@/components/ui/button";

export interface ContextualCTAProps {
  hasHomeBeach: boolean;
  hasSessionToday: boolean;
  hasFollows: boolean;
  /**
   * Whether the hero score crossed the "good conditions" threshold. Pass
   * `undefined` while the canonical surf-call is still loading so the
   * "Paddle out" branch doesn't fire on a phantom score, and the "Set
   * alarm" branch doesn't fire on a phantom NO either — neutral default
   * CTA carries the loading window.
   */
  conditionsGood?: boolean; // score > 6
  /**
   * Canonical surf-call verdict for the hero beach. When "NO", the
   * "Paddle out — log a session" CTA is suppressed — don't ask users to do
   * the thing the surf-call copy just told them not to do. "Set alarm"
   * remains visible since it's still useful on flat days. See feedback
   * memo "feedback_hide_paddle_out_cta_on_no_verdict".
   */
  surfVerdict?: "YES" | "MAYBE" | "NO" | null;
  preferredTime: string | null; // dawn_patrol, morning, etc.
  sunriseTime?: string; // e.g., "5:45a"
  isPreSunrise?: boolean;
  onSetHomeBeach: () => void;
  onLogSession: () => void;
  onInviteFriend: () => void;
  onSetAlarm: () => void;
  onShareSession: () => void;
}

interface CTAAction {
  label: string;
  handler: () => void;
  variant: "default" | "outline";
}

function resolveCTAs(props: ContextualCTAProps): {
  primary: CTAAction;
  secondary: CTAAction[];
  contextLine: string;
} {
  const {
    hasHomeBeach,
    hasSessionToday,
    conditionsGood,
    hasFollows,
    surfVerdict,
    onSetHomeBeach,
    onLogSession,
    onInviteFriend,
    onSetAlarm,
    onShareSession,
  } = props;

  const setHomeBeach: CTAAction = {
    label: "Set your home beach",
    handler: onSetHomeBeach,
    variant: "default",
  };
  const shareSession: CTAAction = {
    label: "Share your session",
    handler: onShareSession,
    variant: "outline",
  };
  const paddleOut: CTAAction = {
    label: "Paddle out — log a session",
    handler: onLogSession,
    variant: "default",
  };
  const tellCrew: CTAAction = {
    label: "Tell your crew",
    handler: onInviteFriend,
    variant: "default",
  };
  const inviteFriend: CTAAction = {
    label: "Invite a friend",
    handler: onInviteFriend,
    variant: "default",
  };
  const setAlarm: CTAAction = {
    label: "Set alarm",
    handler: onSetAlarm,
    variant: "outline",
  };
  const logSession: CTAAction = {
    label: "Log a session",
    handler: onLogSession,
    variant: "outline",
  };

  // Priority logic — first match wins
  if (!hasHomeBeach) {
    return {
      primary: setHomeBeach,
      secondary: [setAlarm, inviteFriend],
      contextLine:
        "Lock in your local. Everything dials in from there.",
    };
  }

  if (hasSessionToday) {
    return {
      primary: shareSession,
      secondary: [setAlarm, inviteFriend],
      contextLine: "Your crew wants to see how it was out there.",
    };
  }

  // Only surface the "Paddle out — log a session" CTA when the surf-call
  // verdict isn't NO. On a NO day the hero copy says "don't bother"; the
  // primary CTA must not contradict that. `=== true` is intentional so the
  // unknown-loading state (undefined) falls through to the neutral default.
  if (hasHomeBeach && conditionsGood === true && surfVerdict !== "NO") {
    return {
      primary: paddleOut,
      secondary: [setAlarm, inviteFriend],
      contextLine: "Conditions are lining up at your spot — don't miss it.",
    };
  }

  // NO-verdict day at the home beach: lead with "Set alarm" so the page still
  // offers a useful next step, instead of pretending conditions are good.
  // Only fires when the surf-call resolved with an explicit NO — undefined
  // verdict (still loading) must not paint the alarm CTA.
  if (hasHomeBeach && surfVerdict === "NO") {
    return {
      primary: { ...setAlarm, variant: "default" },
      secondary: [inviteFriend],
      contextLine: "Conditions aren't there today — get a heads-up when they swing in.",
    };
  }

  if (hasFollows) {
    return {
      primary: tellCrew,
      secondary: [setAlarm, inviteFriend],
      contextLine: "Rally the crew for a session.",
    };
  }

  return {
    primary: inviteFriend,
    secondary: [setAlarm, logSession],
    contextLine: "Surfing's better with friends.",
  };
}

const INK = "#11100D";

export function ContextualCTA(props: ContextualCTAProps) {
  const { primary, secondary, contextLine } = resolveCTAs(props);

  return (
    <div className="utility-strip">
      {contextLine && (
        <p
          className="mb-4"
          style={{
            fontFamily: "var(--font-handwritten), cursive",
            fontSize: 21,
            lineHeight: 1.2,
            fontWeight: 700,
            color: INK,
            margin: "0 0 16px",
          }}
        >
          {contextLine}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {/* Charming Orange stays the single primary accent, but printed flat
            with an offset block shadow rather than a rounded SaaS pill. */}
        <Button
          variant={primary.variant}
          className="w-full rounded-none py-4 text-base font-semibold hover:bg-[#D57835]"
          style={{
            background: "#F78E42",
            color: "#11100D",
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            boxShadow: "3px 4px 0 rgba(17,16,13,0.35)",
          }}
          onClick={primary.handler}
        >
          {primary.label}
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          {secondary.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              className="w-full rounded-none text-sm hover:bg-[rgba(17,16,13,0.06)] sm:flex-1"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: INK,
                border: "1.5px dashed rgba(17,16,13,0.45)",
              }}
              onClick={action.handler}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
