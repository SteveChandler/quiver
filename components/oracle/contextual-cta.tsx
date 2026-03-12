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
    };
  }

  if (hasSessionToday) {
    return {
      primary: shareSession,
      secondary: [setAlarm, inviteFriend],
    };
  }

  if (hasHomeBeach && conditionsGood) {
    return {
      primary: paddleOut,
      secondary: [setAlarm, inviteFriend],
    };
  }

  if (hasFollows) {
    return {
      primary: tellCrew,
      secondary: [setAlarm, inviteFriend],
    };
  }

  return {
    primary: inviteFriend,
    secondary: [setAlarm, shareSession],
  };
}

export function ContextualCTA(props: ContextualCTAProps) {
  const { primary, secondary } = resolveCTAs(props);

  return (
    <div className="px-6 py-4">
      <div className="flex flex-col gap-3">
        <Button
          variant={primary.variant}
          className="w-full font-heading"
          onClick={primary.handler}
        >
          {primary.label}
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row">
          {secondary.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="w-full border-[#404C92] font-heading sm:flex-1"
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
