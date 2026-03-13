"use client";

import { Button } from "@/components/ui/button";

export interface ContextualCTAProps {
  hasHomeBeach: boolean;
  hasSessionToday: boolean;
  hasFollows: boolean;
  conditionsGood: boolean; // score > 6
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

  // Priority logic — first match wins
  if (!hasHomeBeach) {
    return {
      primary: setHomeBeach,
      secondary: [setAlarm, inviteFriend],
      contextLine:
        "Pin your home break to unlock personalized windows, nearby spots, and local activity.",
    };
  }

  if (hasSessionToday) {
    return {
      primary: shareSession,
      secondary: [setAlarm, inviteFriend],
      contextLine: "Your crew wants to see how it was out there.",
    };
  }

  if (hasHomeBeach && conditionsGood) {
    return {
      primary: paddleOut,
      secondary: [setAlarm, inviteFriend],
      contextLine: "Conditions are lining up at your spot — don't miss it.",
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
    secondary: [setAlarm, shareSession],
    contextLine: "Surfing's better with friends.",
  };
}

export function ContextualCTA(props: ContextualCTAProps) {
  const { primary, secondary, contextLine } = resolveCTAs(props);

  return (
    <div className="px-6 py-4">
      <div className="noise-texture rounded-xl border border-[#404C92] bg-[#2D357D] p-5">
        {contextLine && (
          <p className="text-medium mb-3 text-sm">{contextLine}</p>
        )}
        <div className="flex flex-col gap-3">
          <Button
            variant={primary.variant}
            className="w-full py-4 bg-[#F78E42] hover:bg-[#D57835] text-white font-heading font-semibold text-base"
            onClick={primary.handler}
          >
            {primary.label}
          </Button>

          <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
            {secondary.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="w-full text-white/60 hover:text-white/80 hover:bg-white/[0.04] font-heading text-sm sm:flex-1"
                onClick={action.handler}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
