type CanonicalDecisionModule = {
  buildCanonicalSessionDecision: (input: unknown) => unknown;
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
  safetyOverrideReasons?: Array<"water_quality_closure">;
  personalMatch?: {
    score: number;
    label: "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH";
    confidence: "low" | "medium" | "high";
    sessionCount: number;
    reasons: readonly string[];
  } | null;
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

  it.each([
    ["EPIC", "go"],
    ["GOOD", "go"],
    ["FAIR", "maybe"],
    ["RIDEABLE", "maybe"],
    ["MEH", "no"],
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

  it("lets a safe GOOD personal match override rough physical MAYBE context", () => {
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
      verdict: "go",
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
    ["beginner-intermediate", "intermediate"],
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
