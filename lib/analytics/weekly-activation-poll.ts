export interface WeeklyActivationPollDateRange {
  from: string;
  to: string;
}

export interface WeeklyActivationProfileRow {
  id: string;
  email?: string | null;
  is_mock?: boolean | null;
  analytics_is_real_user?: boolean | null;
  analytics_exclusion_reason?: string | null;
  created_at: string;
  home_beach_id?: string | null;
  onboarding_completed_at?: string | null;
  experience_level?: string | null;
  surf_styles?: unknown;
}

export interface WeeklyActivationSessionRow {
  id: string;
  user_id: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface WeeklyActivationBoardRow {
  id: string;
  user_id: string | null;
  created_at: string;
}

export interface WeeklyActivationEventRow {
  event_type: string;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
  bot_flagged?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface BuildWeeklyActivationPollInput {
  generatedAt: string;
  dateRange: WeeklyActivationPollDateRange;
  profiles: WeeklyActivationProfileRow[];
  sessions: WeeklyActivationSessionRow[];
  boards: WeeklyActivationBoardRow[];
  events: WeeklyActivationEventRow[];
  posthogRealUserProfileCount?: number;
  missingSources?: string[];
  supabaseAvailable?: boolean;
  usedScriptedFallback?: boolean;
}

export interface EventPollMetric {
  count: number;
  distinctUsers: number;
  anonymousSessions: number;
  realDeviceCount: number;
  emulatorCount: number;
}

export interface WeeklyActivationPollOutput {
  generatedAt: string;
  dateRange: WeeklyActivationPollDateRange;
  sourceStatus: {
    supabase: {
      available: boolean;
      usedScriptedFallback: boolean;
    };
    posthog: {
      profileCountAvailable: boolean;
    };
  };
  realUsers: {
    total: number;
    newInWindow: number;
    homeBeachActivated: number;
    onboardingCompleted: number;
    experienceCaptured: number;
    surfStyleCaptured: number;
    excludedProfilesByReason: Record<string, number>;
  };
  weeklyCohort: {
    newUsers: number;
    homeBeachActivated: number;
    onboardingCompleted: number;
    sessionLoggers: number;
    boardCreators: number;
  };
  adoption: {
    sessions: {
      total: number;
      inWindow: number;
      distinctUsersInWindow: number;
    };
    boards: {
      total: number;
      inWindow: number;
      distinctUsersInWindow: number;
    };
  };
  events: {
    onboardingVideo: {
      started: EventPollMetric;
      completed: EventPollMetric;
      skipped: EventPollMetric;
    };
    boardManagement: {
      boardFormSaved: EventPollMetric;
      sessionBoardFitFeedbackSelected: EventPollMetric;
    };
    botFlagged: {
      count: number;
    };
  };
  reconciliation: {
    status: "matched" | "mismatch" | "posthog_unavailable";
    supabaseRealUsers: number;
    posthogRealUsers?: number;
    delta?: number;
  };
  missingSources: string[];
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function buildWeeklyActivationPollOutput(
  input: BuildWeeklyActivationPollInput,
): WeeklyActivationPollOutput {
  const realProfiles = input.profiles.filter(isRealProfile);
  const realUserIds = new Set(realProfiles.map((profile) => profile.id));
  const newProfiles = realProfiles.filter((profile) => isWithinRange(profile.created_at, input.dateRange));
  const newProfileIds = new Set(newProfiles.map((profile) => profile.id));
  const nonDeletedSessions = input.sessions.filter((session) =>
    session.user_id !== null &&
    realUserIds.has(session.user_id) &&
    !session.deleted_at
  );
  const realBoards = input.boards.filter((board) =>
    board.user_id !== null && realUserIds.has(board.user_id)
  );
  const sessionsInWindow = nonDeletedSessions.filter((session) =>
    isWithinRange(session.created_at, input.dateRange)
  );
  const boardsInWindow = realBoards.filter((board) =>
    isWithinRange(board.created_at, input.dateRange)
  );
  const cleanEvents = input.events.filter((event) => event.bot_flagged !== true);

  const output: WeeklyActivationPollOutput = {
    generatedAt: input.generatedAt,
    dateRange: input.dateRange,
    sourceStatus: {
      supabase: {
        available: input.supabaseAvailable ?? true,
        usedScriptedFallback: input.usedScriptedFallback ?? true,
      },
      posthog: {
        profileCountAvailable: typeof input.posthogRealUserProfileCount === "number",
      },
    },
    realUsers: {
      total: realProfiles.length,
      newInWindow: newProfiles.length,
      homeBeachActivated: realProfiles.filter((profile) => Boolean(profile.home_beach_id)).length,
      onboardingCompleted: realProfiles.filter((profile) => Boolean(profile.onboarding_completed_at)).length,
      experienceCaptured: realProfiles.filter((profile) => Boolean(profile.experience_level)).length,
      surfStyleCaptured: realProfiles.filter(hasSurfStyle).length,
      excludedProfilesByReason: countExcludedProfilesByReason(input.profiles),
    },
    weeklyCohort: {
      newUsers: newProfiles.length,
      homeBeachActivated: newProfiles.filter((profile) => Boolean(profile.home_beach_id)).length,
      onboardingCompleted: newProfiles.filter((profile) => Boolean(profile.onboarding_completed_at)).length,
      sessionLoggers: distinctUsers(sessionsInWindow, realUserIds, newProfileIds).size,
      boardCreators: distinctUsers(boardsInWindow, realUserIds, newProfileIds).size,
    },
    adoption: {
      sessions: {
        total: nonDeletedSessions.length,
        inWindow: sessionsInWindow.length,
        distinctUsersInWindow: distinctUsers(sessionsInWindow, realUserIds).size,
      },
      boards: {
        total: realBoards.length,
        inWindow: boardsInWindow.length,
        distinctUsersInWindow: distinctUsers(boardsInWindow, realUserIds).size,
      },
    },
    events: {
      onboardingVideo: {
        started: eventMetric(cleanEvents, "onboarding_video_started"),
        completed: eventMetric(cleanEvents, "onboarding_video_completed"),
        skipped: eventMetric(cleanEvents, "onboarding_video_skipped"),
      },
      boardManagement: {
        boardFormSaved: eventMetric(cleanEvents, "board_form_saved", realUserIds),
        sessionBoardFitFeedbackSelected: eventMetric(
          cleanEvents,
          "session_board_fit_feedback_selected",
          realUserIds,
        ),
      },
      botFlagged: {
        count: input.events.filter((event) => event.bot_flagged === true).length,
      },
    },
    reconciliation: buildReconciliation(realProfiles.length, input.posthogRealUserProfileCount),
    missingSources: input.missingSources ?? [],
  };

  assertNoPiiInWeeklyActivationPollOutput(output);
  return output;
}

export function assertNoPiiInWeeklyActivationPollOutput(
  output: WeeklyActivationPollOutput,
): void {
  const serialized = JSON.stringify(output);
  if (EMAIL_PATTERN.test(serialized)) {
    throw new Error("Weekly activation poll output contains email-like PII");
  }
}

function isRealProfile(profile: WeeklyActivationProfileRow): boolean {
  if (typeof profile.analytics_is_real_user === "boolean") {
    return profile.analytics_is_real_user;
  }

  if (profile.is_mock === true) return false;
  if (!profile.email) return true;

  const normalized = profile.email.toLowerCase();
  return !(
    normalized.includes("test") ||
    normalized.endsWith("@local.test") ||
    normalized.endsWith("@example.invalid")
  );
}

function hasSurfStyle(profile: WeeklyActivationProfileRow): boolean {
  return Array.isArray(profile.surf_styles) && profile.surf_styles.length > 0;
}

function isWithinRange(value: string, range: WeeklyActivationPollDateRange): boolean {
  const time = Date.parse(value);
  return time >= Date.parse(range.from) && time <= Date.parse(range.to);
}

function countExcludedProfilesByReason(
  profiles: WeeklyActivationProfileRow[],
): Record<string, number> {
  return profiles.reduce<Record<string, number>>((acc, profile) => {
    if (isRealProfile(profile)) return acc;

    const reason = profile.analytics_exclusion_reason ?? inferredExclusionReason(profile);
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
}

function inferredExclusionReason(profile: WeeklyActivationProfileRow): string {
  if (profile.is_mock === true) return "mock_profile";
  if (!profile.email) return "unknown";
  const normalized = profile.email.toLowerCase();
  if (normalized.endsWith("@local.test")) return "local_test_email";
  if (normalized.endsWith("@example.invalid")) return "example_invalid_email";
  if (normalized.includes("test")) return "test_email";
  return "unknown";
}

function distinctUsers(
  rows: Array<{ user_id: string | null }>,
  realUserIds: Set<string>,
  restrictToUserIds?: Set<string>,
): Set<string> {
  const users = new Set<string>();
  for (const row of rows) {
    if (!row.user_id || !realUserIds.has(row.user_id)) continue;
    if (restrictToUserIds && !restrictToUserIds.has(row.user_id)) continue;
    users.add(row.user_id);
  }
  return users;
}

function eventMetric(
  events: WeeklyActivationEventRow[],
  eventType: string,
  realUserIds?: Set<string>,
): EventPollMetric {
  const matching = events.filter((event) => {
    if (event.event_type !== eventType) return false;
    return !realUserIds || (event.user_id !== null && realUserIds.has(event.user_id));
  });
  const users = new Set<string>();
  const anonymousSessions = new Set<string>();

  for (const event of matching) {
    if (event.user_id) users.add(event.user_id);
    if (!event.user_id && event.session_id) anonymousSessions.add(event.session_id);
  }

  return {
    count: matching.length,
    distinctUsers: users.size,
    anonymousSessions: anonymousSessions.size,
    realDeviceCount: matching.filter(isRealDeviceEvent).length,
    emulatorCount: matching.filter((event) => event.metadata?.is_emulator === true).length,
  };
}

function isRealDeviceEvent(event: WeeklyActivationEventRow): boolean {
  const platform = event.metadata?._platform;
  return (
    (platform === "native-ios" || platform === "native-android") &&
    event.metadata?.is_emulator !== true
  );
}

function buildReconciliation(
  supabaseRealUsers: number,
  posthogRealUsers?: number,
): WeeklyActivationPollOutput["reconciliation"] {
  if (typeof posthogRealUsers !== "number") {
    return {
      status: "posthog_unavailable",
      supabaseRealUsers,
    };
  }

  return {
    status: posthogRealUsers === supabaseRealUsers ? "matched" : "mismatch",
    supabaseRealUsers,
    posthogRealUsers,
    delta: posthogRealUsers - supabaseRealUsers,
  };
}
