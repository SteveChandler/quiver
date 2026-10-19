import type { ScoringDecisionEffect } from '@/lib/domains/scoring/types';

type CanonicalDecisionModule = {
  buildCanonicalSessionDecision: (input: unknown) => unknown;
  beachSkillVetoReason: (beachSkillLevel: unknown, profileExperience: unknown) =>
    "missing_beach_skill" | "beach_skill_exceeds_user" | null;
};

interface TestCandidate {
  candidateId: string;
  beachId: string;
  beachName: string;
  beachSkillLevel: unknown;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  forecastId: string;
  forecastAt: string;
  waveHeight: unknown;
  utilityScore: number;
  recommendationLabel: "Worth it" | "Maybe" | "Skip";
  characterCategory?: string | null;
  safetyOverrideReasons?: Array<"water_quality_closure">;
  personalMatch?: {
    score: number;
    label: "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH";
    confidence: "low" | "medium" | "high";
    sessionCount: number;
    reasons: readonly string[];
  } | null;
  effects?: ScoringDecisionEffect[];
}

function loadEngine(): CanonicalDecisionModule {
  return require("@/lib/recommendations/canonical-decision") as CanonicalDecisionModule;
}

function candidate(overrides: Partial<TestCandidate> = {}): TestCandidate {
  return {
    candidateId: "beach:blackies:2026-07-23T14:00:00.000Z",
    beachId: "blackies",
    beachName: "Blackies",
    beachSkillLevel: "intermediate",
    windowStart: "2026-07-23T14:00:00.000Z",
    windowEnd: "2026-07-23T17:00:00.000Z",
    timezone: "America/Los_Angeles",
    forecastId: "forecast-1",
    forecastAt: "2026-07-23T14:00:00.000Z",
    waveHeight: "3-4 ft",
    utilityScore: 82,
    recommendationLabel: "Worth it",
    ...overrides,
  };
}

function input(
  candidates: readonly TestCandidate[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    anchorTime: "2026-07-22T18:00:00.000Z",
    scope: {
      kind: "plan_next_session",
      windowStart: "2026-07-22T18:00:00.000Z",
      windowEnd: "2026-07-23T18:00:00.000Z",
      timezone: "America/Los_Angeles",
    },
    profileExperience: "intermediate",
    recommendationAvailability: {
      state: "available",
      holdEpoch: "hold-epoch-1",
      resolutionAsOf: "2026-07-22T17:59:59.000Z",
    },
    candidates,
    ...overrides,
  };
}

describe("canonical session decision engine", () => {
  it.each([
    ["beginner-intermediate", "beginner", null],
    ["lower-intermediate", "beginner", "beach_skill_exceeds_user"],
    ["intermediate", "beginner", "beach_skill_exceeds_user"],
    ["upper-intermediate", "beginner", "beach_skill_exceeds_user"],
    ["beginner", "beginner", null],
    [null, null, "missing_beach_skill"],
    ["advanced", null, null],
  ] as const)("returns the beach skill veto for %s and %s", (beachSkill, experience, expected) => {
    expect(loadEngine().beachSkillVetoReason(beachSkill, experience)).toBe(expected);
  });

  it.each([
    [{ gate: 'candidate_pool', observed: { count: 0 } }],
    [{ gate: 'forecast_rows', observed: { count: 0 } }],
    [{ gate: 'forecast_alignment', observed: { forecastAt: '2026-07-22T18:00:00.000Z' }, allowed: { maximumDeltaMinutes: 90 } }],
    [{ gate: 'past_forecast', observed: { count: 3 } }],
    [{ gate: 'time_slot', observed: { count: 2 }, detail: 'morning' }],
    [{ gate: 'score_floor', observed: { score: 34 }, allowed: { minimumScore: 40 } }],
    [{ gate: 'horizon', observed: { hoursAhead: 26 }, allowed: { maximumHoursAhead: 24 } }],
    [{ gate: 'daylight', observed: { count: 4 } }],
    [{ gate: 'session_duration', observed: { durationHours: 0.5 }, allowed: { minimumDurationHours: 1 } }],
    [{ gate: 'window_selection', observed: { count: 2 } }],
    [{ gate: 'saved_spot_eligibility', observed: { status: 'Maybe' }, allowed: { status: 'Worth it' } }],
    [{ gate: 'water_quality_hold', observed: { status: 'advisory' }, allowed: { status: 'open' } }],
    [{ gate: 'skill_gate', observed: { skill: 'advanced' }, allowed: { skill: 'intermediate' } }],
    [{ gate: 'ranking', observed: { count: 3 } }],
  ])('preserves a %j discovery rejection without changing no_candidates', (candidateRejection) => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(input([], { candidateRejection })) as {
      reasonCode: string; candidateRejection: unknown;
    };
    expect(decision.reasonCode).toBe('no_candidates');
    expect(decision.candidateRejection).toEqual(candidateRejection);
  });

  it.each([
    ['wave_height_exceeds_skill', { waveHeight: '7.2 ft' }, { gate: 'skill_gate', observed: { waveHeightFt: 7.2 }, allowed: { minimumWaveHeightFt: 1, maximumWaveHeightFt: 6, skill: 'intermediate' } }],
    ['beach_skill_exceeds_user', { beachSkillLevel: 'advanced' }, { gate: 'skill_gate', observed: { skill: 'advanced' }, allowed: { skill: 'intermediate' } }],
    ['water_quality_closure', { safetyOverrideReasons: ['water_quality_closure'] }, { gate: 'water_quality_hold', observed: { status: 'closure' }, allowed: { status: 'open' } }],
  ])('records observed and allowed values for %s', (reasonCode, candidateOverrides, rejection) => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(input([candidate(candidateOverrides as Partial<TestCandidate>)])) as {
      reasonCode: string; candidateRejection: unknown;
    };
    expect(decision.reasonCode).toBe(reasonCode);
    expect(decision.candidateRejection).toEqual(rejection);
  });
  it('keeps the decision id stable when display-only rejection evidence changes', () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const withoutRejection = buildCanonicalSessionDecision(input([])) as { decisionId: string };
    const withRejection = buildCanonicalSessionDecision(input([], {
      candidateRejection: { gate: 'daylight', observed: { count: 2 } },
    })) as { decisionId: string };
    expect(withRejection.decisionId).toBe(withoutRejection.decisionId);
  });

  it('labels the beginner safety limit applied for an unknown skill', () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(input([candidate({ waveHeight: '5-6 ft' })], {
      profileExperience: undefined,
    })) as { reasonCode: string; candidateRejection: unknown };
    expect(decision.reasonCode).toBe('wave_height_exceeds_skill');
    expect(decision.candidateRejection).toEqual({
      gate: 'skill_gate',
      observed: { waveHeightFt: 6 },
      allowed: { minimumWaveHeightFt: 0.5, maximumWaveHeightFt: 4, skill: 'beginner' },
    });
  });

  it('vetoes a beginner at a beginner-intermediate beach when waves exceed the beginner range', () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(input([
      candidate({ beachSkillLevel: 'beginner-intermediate', waveHeight: '4-5 ft' }),
    ], { profileExperience: 'beginner' })) as {
      verdict: string;
      reasonCode: string;
      skillEligibility: { reasonCodes: string[] };
    };

    expect(decision.verdict).toBe('no');
    expect(decision.reasonCode).toBe('wave_height_exceeds_skill');
    expect(decision.skillEligibility.reasonCodes).toEqual(['wave_height_exceeds_skill']);
  });

  it("keeps the objective call while withholding personal fit for unknown skill", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            personalMatch: {
              score: 9.2,
              label: "EPIC",
              confidence: "high",
              sessionCount: 20,
              reasons: ["Matches your completed sessions"],
            },
          }),
        ],
        { profileExperience: null },
      ),
    ) as {
      verdict: string;
      decisionBasis: string;
      reasonCode: string;
      selection: {
        evidence: { personalMatch: unknown };
      } | null;
      skillEligibility: { state: string; reasonCodes: string[] };
    };

    expect(decision).toMatchObject({
      verdict: "go",
      decisionBasis: "physical_fallback",
      reasonCode: "selected_go",
      selection: { evidence: { personalMatch: null } },
      skillEligibility: {
        state: "insufficient_safety_data",
        reasonCodes: ["unknown_skill"],
      },
    });
  });

  it("keeps the beginner hard floor when skill is unknown", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            waveHeight: "5-6 ft",
            personalMatch: {
              score: 9.2,
              label: "EPIC",
              confidence: "high",
              sessionCount: 20,
              reasons: ["Matches your completed sessions"],
            },
          }),
        ],
        { profileExperience: undefined },
      ),
    ) as {
      verdict: string;
      decisionBasis: string;
      reasonCode: string;
      selection: unknown;
      skillEligibility: { state: string; reasonCodes: string[] };
    };

    expect(decision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "wave_height_exceeds_skill",
      selection: null,
      skillEligibility: {
        state: "ineligible",
        reasonCodes: ["wave_height_exceeds_skill", "unknown_skill"],
      },
    });
  });

  it("returns one go selection for the highest-ranked safe session", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate(),
        candidate({
          candidateId: "beach:tourmaline:2026-07-23T15:00:00.000Z",
          beachId: "tourmaline",
          beachName: "Tourmaline",
          beachSkillLevel: "beginner",
          windowStart: "2026-07-23T15:00:00.000Z",
          windowEnd: "2026-07-23T18:00:00.000Z",
          forecastId: "forecast-2",
          forecastAt: "2026-07-23T15:00:00.000Z",
          waveHeight: "2-3 ft",
          utilityScore: 75,
        }),
      ]),
    ) as {
      verdict: string;
      selection: { beachId: string; windowStart: string; windowEnd: string } | null;
    };

    expect(decision.verdict).toBe("go");
    expect(decision.selection).toEqual(
      expect.objectContaining({
        beachId: "blackies",
        windowStart: "2026-07-23T14:00:00.000Z",
        windowEnd: "2026-07-23T17:00:00.000Z",
      }),
    );
  });

  it("returns maybe when the best safe session is worth watching but not a go", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          utilityScore: 58,
          recommendationLabel: "Maybe",
        }),
      ]),
    ) as { verdict: string; reasonCode: string; selection: unknown };

    expect(decision.verdict).toBe("maybe");
    expect(decision.reasonCode).toBe("selected_maybe");
    expect(decision.selection).not.toBeNull();
  });

  it("does not let a GOOD personal label promote a physical maybe to go", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          candidateId: "pb-point:2026-09-16T18:00:00Z",
          utilityScore: 65,
          recommendationLabel: "Maybe",
          personalMatch: {
            score: 7.9,
            label: "GOOD",
            confidence: "high",
            sessionCount: 12,
            reasons: [],
          },
        }),
      ]),
    ) as { verdict: string; reasonCode: string };

    expect(decision.verdict).toBe("maybe");
    expect(decision.reasonCode).not.toBe("selected_go");
  });

  it("keeps go when both physical and personal say go", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          utilityScore: 82,
          recommendationLabel: "Worth it",
          personalMatch: {
            score: 9.1,
            label: "EPIC",
            confidence: "high",
            sessionCount: 12,
            reasons: [],
          },
        }),
      ]),
    ) as { verdict: string };

    expect(decision.verdict).toBe("go");
  });

  it("labels a go capped below EPIC from the capped score, matching its evidence", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          utilityScore: 94,
          effects: [{
            code: "tide_outside_band",
            severity: "material",
            verdictCeiling: 79,
            message: "Tide a bit high",
          }],
        }),
      ]),
    ) as {
      verdict: string;
      conditionLabel: string;
      selection: { evidence: { conditionScore: number } } | null;
    };

    expect(decision.verdict).toBe("go");
    expect(decision.conditionLabel).toBe("GOOD");
    expect(decision.selection?.evidence.conditionScore).toBe(79);
  });

  it("labels a maybe on a blown-out row MEH, not FAIR, and leaves other rows alone", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const labelFor = (characterCategory: string | null) =>
      (buildCanonicalSessionDecision(
        input([candidate({ utilityScore: 55, recommendationLabel: "Maybe", characterCategory })]),
      ) as { verdict: string; conditionLabel: string });

    expect(labelFor("skip")).toMatchObject({ verdict: "maybe", conditionLabel: "MEH" });
    expect(labelFor("medium-rough")).toMatchObject({ verdict: "maybe", conditionLabel: "FAIR" });
    expect(labelFor(null)).toMatchObject({ verdict: "maybe", conditionLabel: "FAIR" });
  });

  it("never emits conditionLabel EPIC while EPIC is off", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    for (const utilityScore of [80, 85, 94, 100]) {
      const decision = buildCanonicalSessionDecision(
        input([candidate({ utilityScore })]),
      ) as { verdict: string; conditionLabel: string };

      expect(decision.verdict).toBe("go");
      expect(decision.conditionLabel).toBe("GOOD");
    }

    const { conditionLabelForVerdict } = require("@/lib/recommendations/canonical-decision/engine") as {
      conditionLabelForVerdict: (verdict: "go" | "maybe" | "no", score: number) => string;
    };
    for (let score = 0; score <= 100; score += 1) {
      for (const verdict of ["go", "maybe", "no"] as const) {
        expect(conditionLabelForVerdict(verdict, score)).not.toBe("EPIC");
      }
    }
  });

  it("applies a structured caution to both verdict evidence and the decision hash", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const effect: ScoringDecisionEffect = {
      code: "crossing_swells",
      severity: "material",
      verdictCeiling: 65,
      message: "Crossing swells may create unstable peaks.",
    };
    const withEffect = buildCanonicalSessionDecision(
      input([
        candidate({
          utilityScore: 95,
          effects: [effect],
          personalMatch: {
            score: 9.4,
            label: "GOOD",
            confidence: "high",
            sessionCount: 18,
            reasons: ["Strong setup match"],
          },
        }),
      ]),
    ) as {
      decisionId: string;
      verdict: string;
      selection: {
        evidence: {
          conditionScore: number;
          recommendationLabel: string;
          effects: ScoringDecisionEffect[];
        };
      } | null;
      effects: ScoringDecisionEffect[];
    };
    const withoutEffect = buildCanonicalSessionDecision(
      input([
        candidate({
          utilityScore: 95,
          personalMatch: {
            score: 9.4,
            label: "GOOD",
            confidence: "high",
            sessionCount: 18,
            reasons: ["Strong setup match"],
          },
        }),
      ]),
    ) as { decisionId: string; verdict: string };

    expect(withEffect).toMatchObject({
      verdict: "maybe",
      selection: {
        evidence: {
          conditionScore: 65,
          recommendationLabel: "Maybe",
          effects: [effect],
        },
      },
      effects: [effect],
    });
    expect(withEffect.decisionId).not.toBe(withoutEffect.decisionId);
    expect(withoutEffect.verdict).toBe("go");
  });

  it.each([
    ["EPIC", "maybe"],
    ["GOOD", "maybe"],
    ["FAIR", "maybe"],
    ["RIDEABLE", "maybe"],
    ["MEH", "maybe"],
  ] as const)(
    "maps a learned %s match to canonical %s",
    (label, expectedVerdict) => {
      const { buildCanonicalSessionDecision } = loadEngine();
      const decision = buildCanonicalSessionDecision(
        input([
          candidate({
            utilityScore: 42,
            recommendationLabel: "Maybe",
            personalMatch: {
              score: label === "MEH" ? 2.5 : 8.1,
              label,
              confidence: "medium",
              sessionCount: 14,
              reasons: ["Matches your completed sessions"],
            },
          }),
        ]),
      ) as {
        verdict: string;
        decisionBasis: string;
        selection: {
          evidence: {
            conditionScore: number;
            personalMatch: { label: string; sessionCount: number };
          };
        } | null;
      };

      expect(decision.verdict).toBe(expectedVerdict);
      expect(decision.decisionBasis).toBe("personal_match");
      expect(decision.selection?.evidence).toMatchObject({
        conditionScore: 42,
        personalMatch: { label, sessionCount: 14 },
      });
    },
  );

  it("caps a safe GOOD personal match at the physical maybe verdict", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          beachId: "ala-moana-bowls",
          beachName: "Ala Moana Bowls",
          utilityScore: 54,
          recommendationLabel: "Maybe",
          personalMatch: {
            score: 8.1,
            label: "GOOD",
            confidence: "medium",
            sessionCount: 12,
            reasons: ["Your completed sessions match this setup"],
          },
        }),
      ]),
    ) as { verdict: string; decisionBasis: string };

    expect(decision).toMatchObject({
      verdict: "maybe",
      decisionBasis: "personal_match",
    });
  });

  it.each([
    [
      "match score",
      {
        personalMatch: {
          score: 8.2,
          label: "GOOD" as const,
          confidence: "low" as const,
          sessionCount: 12,
          reasons: ["Higher match"],
        },
        utilityScore: 50,
        windowStart: "2026-07-23T16:00:00.000Z",
      },
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "high" as const,
          sessionCount: 12,
          reasons: ["Lower match"],
        },
        utilityScore: 90,
        windowStart: "2026-07-23T13:00:00.000Z",
      },
    ],
    [
      "confidence",
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "high" as const,
          sessionCount: 12,
          reasons: ["Higher confidence"],
        },
        utilityScore: 50,
        windowStart: "2026-07-23T16:00:00.000Z",
      },
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "medium" as const,
          sessionCount: 12,
          reasons: ["Lower confidence"],
        },
        utilityScore: 90,
        windowStart: "2026-07-23T13:00:00.000Z",
      },
    ],
    [
      "physical utility",
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "high" as const,
          sessionCount: 12,
          reasons: ["Higher utility"],
        },
        utilityScore: 80,
        windowStart: "2026-07-23T16:00:00.000Z",
      },
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "high" as const,
          sessionCount: 12,
          reasons: ["Lower utility"],
        },
        utilityScore: 70,
        windowStart: "2026-07-23T13:00:00.000Z",
      },
    ],
    [
      "earliest start",
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "high" as const,
          sessionCount: 12,
          reasons: ["Earlier"],
        },
        utilityScore: 70,
        windowStart: "2026-07-23T13:00:00.000Z",
      },
      {
        personalMatch: {
          score: 8.1,
          label: "GOOD" as const,
          confidence: "high" as const,
          sessionCount: 12,
          reasons: ["Later"],
        },
        utilityScore: 70,
        windowStart: "2026-07-23T16:00:00.000Z",
      },
    ],
  ] as const)(
    "selects a learned window by %s before lower-priority tie breakers",
    (_priority, winningOverrides, losingOverrides) => {
      const { buildCanonicalSessionDecision } = loadEngine();
      const winner = candidate({
        ...winningOverrides,
        candidateId: "winner",
        windowEnd: "2026-07-23T17:00:00.000Z",
      });
      const loser = candidate({
        ...losingOverrides,
        candidateId: "loser",
        windowEnd: "2026-07-23T17:00:00.000Z",
      });
      const decision = buildCanonicalSessionDecision(
        input([loser, winner]),
      ) as { selection: { candidateId: string } | null };

      expect(decision.selection?.candidateId).toBe("winner");
    },
  );

  it("uses stable candidate id as the final learned-window tie breaker", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const match = {
      score: 8.1,
      label: "GOOD" as const,
      confidence: "high" as const,
      sessionCount: 12,
      reasons: ["Same evidence"],
    };
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({ candidateId: "window-b", personalMatch: match }),
        candidate({ candidateId: "window-a", personalMatch: match }),
      ]),
    ) as { selection: { candidateId: string } | null };

    expect(decision.selection?.candidateId).toBe("window-a");
  });

  it("lets a hard skill gate override a GOOD personal match", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            beachSkillLevel: "advanced",
            waveHeight: "7-9 ft",
            personalMatch: {
              score: 8.1,
              label: "GOOD",
              confidence: "high",
              sessionCount: 28,
              reasons: ["Strong historical match"],
            },
          }),
        ],
        { profileExperience: "beginner" },
      ),
    ) as { verdict: string; decisionBasis: string; selection: unknown };

    expect(decision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      selection: null,
    });
  });

  it("lets a water-quality closure override a GOOD personal match", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          safetyOverrideReasons: ["water_quality_closure"],
          personalMatch: {
            score: 8.1,
            label: "GOOD",
            confidence: "high",
            sessionCount: 28,
            reasons: ["Strong historical match"],
          },
        }),
      ]),
    ) as {
      verdict: string;
      decisionBasis: string;
      reasonCode: string;
      selection: unknown;
    };

    expect(decision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "water_quality_closure",
      selection: null,
    });
  });

  it("returns explicit no instead of selecting the best below-threshold session", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          utilityScore: 39,
          recommendationLabel: "Skip",
        }),
      ]),
    ) as { verdict: string; reasonCode: string; selection: unknown };

    expect(decision.verdict).toBe("no");
    expect(decision.reasonCode).toBe("selected_no");
    expect(decision.selection).not.toBeNull();
  });

  it("reports low utility when a safe skip exists beside an unsafe positive candidate", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            candidateId: "beach:unsafe:2026-07-23T14:00:00.000Z",
            beachId: "unsafe",
            beachName: "Unsafe Beach",
            beachSkillLevel: "advanced",
            utilityScore: 96,
            recommendationLabel: "Worth it",
          }),
          candidate({
            candidateId: "beach:safe:2026-07-23T15:00:00.000Z",
            beachId: "safe",
            beachName: "Safe Beach",
            beachSkillLevel: "beginner",
            windowStart: "2026-07-23T15:00:00.000Z",
            windowEnd: "2026-07-23T18:00:00.000Z",
            forecastId: "forecast-safe",
            forecastAt: "2026-07-23T15:00:00.000Z",
            waveHeight: "1-2 ft",
            utilityScore: 32,
            recommendationLabel: "Skip",
          }),
        ],
        { profileExperience: "beginner" },
      ),
    ) as {
      verdict: string;
      reasonCode: string;
      selection: unknown;
      skillEligibility: { state: string; reasonCodes: string[] };
    };

    expect(decision).toMatchObject({
      verdict: "no",
      reasonCode: "selected_no",
      selection: expect.objectContaining({ beachId: "safe" }),
      skillEligibility: { state: "eligible", reasonCodes: [] },
    });
  });

  it("excludes a beach above the surfer's skill and selects the best safe alternative", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            candidateId: "beach:blacks:2026-07-23T14:00:00.000Z",
            beachId: "blacks",
            beachName: "Black's Beach",
            beachSkillLevel: "advanced",
            waveHeight: "2-3 ft",
            utilityScore: 95,
          }),
          candidate({
            candidateId: "beach:shores:2026-07-23T15:00:00.000Z",
            beachId: "shores",
            beachName: "La Jolla Shores",
            beachSkillLevel: "beginner",
            windowStart: "2026-07-23T15:00:00.000Z",
            windowEnd: "2026-07-23T18:00:00.000Z",
            forecastId: "forecast-shores",
            forecastAt: "2026-07-23T15:00:00.000Z",
            waveHeight: "2-3 ft",
            utilityScore: 80,
          }),
        ],
        { profileExperience: "beginner" },
      ),
    ) as {
      verdict: string;
      selection: { beachId: string } | null;
      skillEligibility: { skill: string; state: string };
    };

    expect(decision.verdict).toBe("go");
    expect(decision.selection?.beachId).toBe("shores");
    expect(decision.skillEligibility).toMatchObject({
      skill: "beginner",
      state: "eligible",
    });
  });

  it("excludes waves above the surfer's safety ceiling", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            beachSkillLevel: "beginner",
            waveHeight: "6-8 ft",
            utilityScore: 98,
          }),
          candidate({
            candidateId: "beach:protected:2026-07-23T15:00:00.000Z",
            beachId: "protected",
            beachName: "Protected Beach",
            beachSkillLevel: "beginner",
            windowStart: "2026-07-23T15:00:00.000Z",
            windowEnd: "2026-07-23T18:00:00.000Z",
            forecastId: "forecast-protected",
            forecastAt: "2026-07-23T15:00:00.000Z",
            waveHeight: "2-3 ft",
            utilityScore: 72,
          }),
        ],
        { profileExperience: "beginner" },
      ),
    ) as { verdict: string; selection: { beachId: string } | null };

    expect(decision.verdict).toBe("go");
    expect(decision.selection?.beachId).toBe("protected");
  });

  it("returns the objective call when skill is unknown", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([candidate()], { profileExperience: null }),
    ) as {
      verdict: string;
      decisionBasis: string;
      reasonCode: string;
      selection: { beachId: string } | null;
      skillEligibility: {
        skill: string;
        state: string;
        reasonCodes: string[];
      };
    };

    expect(decision.verdict).toBe("go");
    expect(decision.decisionBasis).toBe("physical_fallback");
    expect(decision.reasonCode).toBe("selected_go");
    expect(decision.selection?.beachId).toBe("blackies");
    expect(decision.skillEligibility).toEqual({
      skill: "unknown",
      state: "insufficient_safety_data",
      reasonCodes: ["unknown_skill"],
    });
  });

  it("returns explicit no with stable safety reasons when no safe option exists", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input(
        [
          candidate({
            beachSkillLevel: "advanced",
            waveHeight: "2-3 ft",
          }),
          candidate({
            candidateId: "beach:large:2026-07-23T15:00:00.000Z",
            beachId: "large",
            beachName: "Large Beginner Beach",
            beachSkillLevel: "beginner",
            windowStart: "2026-07-23T15:00:00.000Z",
            windowEnd: "2026-07-23T18:00:00.000Z",
            forecastId: "forecast-large",
            forecastAt: "2026-07-23T15:00:00.000Z",
            waveHeight: "7-9 ft",
          }),
        ],
        { profileExperience: "beginner" },
      ),
    ) as {
      verdict: string;
      reasonCode: string;
      selection: unknown;
      skillEligibility: { state: string; reasonCodes: string[] };
    };

    expect(decision.verdict).toBe("no");
    expect(decision.selection).toBeNull();
    expect(decision.reasonCode).toBe("beach_skill_exceeds_user");
    expect(decision.skillEligibility).toEqual({
      skill: "beginner",
      state: "ineligible",
      reasonCodes: [
        "beach_skill_exceeds_user",
        "wave_height_exceeds_skill",
      ],
    });
  });

  it.each([
    ["all", "beginner"],
    ["beginner-intermediate", "beginner"],
    ["lower-intermediate", "intermediate"],
    ["intermediate-advanced", "advanced"],
    ["upper-intermediate", "intermediate"],
  ])(
    "accepts the canonical %s beach requirement for a %s surfer",
    (beachSkillLevel, profileExperience) => {
      const { buildCanonicalSessionDecision } = loadEngine();
      const decision = buildCanonicalSessionDecision(
        input(
          [candidate({ beachSkillLevel })],
          { profileExperience },
        ),
      ) as {
        verdict: string;
        reasonCode: string;
        selection: { beachId: string } | null;
        skillEligibility: { reasonCodes: string[] };
      };

      expect(decision.verdict).toBe("go");
      expect(decision.reasonCode).toBe("selected_go");
      expect(decision.selection?.beachId).toBe("blackies");
      expect(decision.skillEligibility.reasonCodes).not.toContain(
        "missing_beach_skill",
      );
    },
  );

  it("preserves a P0-A explicit-none hold over every positive candidate", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([candidate()], {
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
          holdEpoch: "active-hold-epoch",
          resolutionAsOf: "2026-07-22T17:59:59.000Z",
          expiresAt: "2026-07-24T18:00:00.000Z",
        },
      }),
    ) as {
      verdict: string;
      reasonCode: string;
      selection: unknown;
      holdEpoch: string;
    };

    expect(decision).toMatchObject({
      verdict: "no",
      reasonCode: "major_event_hold",
      selection: null,
      holdEpoch: "active-hold-epoch",
    });
  });

  it("returns explicit no when the decision scope has no candidates", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(input([])) as {
      verdict: string;
      reasonCode: string;
      selection: unknown;
    };

    expect(decision).toMatchObject({
      verdict: "no",
      decisionBasisV2: "data_unavailable",
      reasonCode: "no_candidates",
      selection: null,
    });
  });

  it("prioritizes no_candidates over unknown skill for an empty scope", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([], { profileExperience: null }),
    ) as {
      reasonCode: string;
      skillEligibility: {
        reasonCodes: string[];
      };
    };

    expect(decision.reasonCode).toBe("no_candidates");
    expect(decision.skillEligibility.reasonCodes).toEqual(["no_candidates"]);
  });

  it("selects the highest-ranked recommendable session instead of a higher-scored skip", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          candidateId: "beach:rough:2026-07-23T14:00:00.000Z",
          beachId: "rough",
          beachName: "Rough Beach",
          utilityScore: 96,
          recommendationLabel: "Skip",
        }),
        candidate({
          candidateId: "beach:clean:2026-07-23T15:00:00.000Z",
          beachId: "clean",
          beachName: "Clean Beach",
          windowStart: "2026-07-23T15:00:00.000Z",
          windowEnd: "2026-07-23T18:00:00.000Z",
          forecastId: "forecast-clean",
          forecastAt: "2026-07-23T15:00:00.000Z",
          utilityScore: 81,
          recommendationLabel: "Worth it",
        }),
      ]),
    ) as { verdict: string; selection: { beachId: string } | null };

    expect(decision.verdict).toBe("go");
    expect(decision.selection?.beachId).toBe("clean");
  });

  it("cannot select a malformed candidate window", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const decision = buildCanonicalSessionDecision(
      input([
        candidate({
          candidateId: "beach:invalid:2026-07-23T14:00:00.000Z",
          beachId: "invalid",
          beachName: "Invalid Window",
          windowStart: "2026-07-23T17:00:00.000Z",
          windowEnd: "2026-07-23T14:00:00.000Z",
          utilityScore: 99,
        }),
        candidate({
          candidateId: "beach:valid:2026-07-23T15:00:00.000Z",
          beachId: "valid",
          beachName: "Valid Window",
          windowStart: "2026-07-23T15:00:00.000Z",
          windowEnd: "2026-07-23T18:00:00.000Z",
          forecastId: "forecast-valid",
          forecastAt: "2026-07-23T15:00:00.000Z",
          utilityScore: 80,
        }),
      ]),
    ) as { verdict: string; selection: { beachId: string } | null };

    expect(decision.verdict).toBe("go");
    expect(decision.selection?.beachId).toBe("valid");
  });

  it("uses one deterministic decision id for canonically equivalent inputs", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const first = candidate();
    const second = candidate({
      candidateId: "beach:second:2026-07-23T15:00:00.000Z",
      beachId: "second",
      beachName: "Second Beach",
      windowStart: "2026-07-23T15:00:00.000Z",
      windowEnd: "2026-07-23T18:00:00.000Z",
      forecastId: "forecast-second",
      forecastAt: "2026-07-23T15:00:00.000Z",
      utilityScore: 75,
    });
    const decisionA = buildCanonicalSessionDecision(
      input([first, second], { profileExperience: "intermediate" }),
    ) as { decisionId: string };
    const decisionB = buildCanonicalSessionDecision(
      input([second, first], { profileExperience: " INTERMEDIATE " }),
    ) as { decisionId: string };

    expect(decisionA.decisionId).toBe(decisionB.decisionId);
  });

  it("changes the decision id when a safety-relevant forecast input changes", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const safe = buildCanonicalSessionDecision(
      input([candidate({ beachSkillLevel: "beginner", waveHeight: "2-3 ft" })], {
        profileExperience: "beginner",
      }),
    ) as { decisionId: string };
    const unsafe = buildCanonicalSessionDecision(
      input([candidate({ beachSkillLevel: "beginner", waveHeight: "7-9 ft" })], {
        profileExperience: "beginner",
      }),
    ) as { decisionId: string };

    expect(safe.decisionId).not.toBe(unsafe.decisionId);
  });

  it("changes the decision id when selected presentation data changes", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const original = buildCanonicalSessionDecision(
      input([candidate({ beachName: "Blackies" })]),
    ) as { decisionId: string };
    const renamed = buildCanonicalSessionDecision(
      input([candidate({ beachName: "Blackies Beach" })]),
    ) as { decisionId: string };

    expect(original.decisionId).not.toBe(renamed.decisionId);
  });

  it("keeps physical forecast values outside the decision and leaves inputs unchanged", () => {
    const { buildCanonicalSessionDecision } = loadEngine();
    const candidates = [candidate()];
    const before = JSON.stringify(candidates);
    const decision = buildCanonicalSessionDecision(input(candidates)) as {
      selection: Record<string, unknown> | null;
    };

    expect(JSON.stringify(candidates)).toBe(before);
    expect(decision.selection).not.toHaveProperty("waveHeight");
    expect(decision.selection).not.toHaveProperty("utilityScore");
    expect(decision.selection).not.toHaveProperty("confidence");
    expect(decision.selection).not.toHaveProperty("forecast");
    expect(decision.selection).toHaveProperty("forecastRef", {
      forecastId: "forecast-1",
      beachId: "blackies",
      forecastAt: "2026-07-23T14:00:00.000Z",
    });
  });
});
