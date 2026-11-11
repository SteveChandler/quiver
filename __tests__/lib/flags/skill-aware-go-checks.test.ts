import {
  SKILL_AWARE_GO_CHECKS_ENABLED_FLAG,
  SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG,
  isSkillAwareGoChecksEnabled,
  isSkillAwareGoChecksOn,
  isSkillAwareGoChecksUserAllowed,
  ratingExperience,
} from "@/lib/flags/skill-aware-go-checks";

describe("skill-aware go checks flags", () => {
  const savedEnabled = process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];
  const savedAllowlist = process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG];

  afterEach(() => {
    if (savedEnabled === undefined) {
      delete process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];
    } else {
      process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] = savedEnabled;
    }
    if (savedAllowlist === undefined) {
      delete process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG];
    } else {
      process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] = savedAllowlist;
    }
  });

  it("defaults off when unset", () => {
    delete process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];

    expect(isSkillAwareGoChecksEnabled()).toBe(false);
  });

  it.each(["", "false", "TRUE", "1", " true", "true "])(
    "stays off for %j",
    (value) => {
      process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] = value;

      expect(isSkillAwareGoChecksEnabled()).toBe(false);
    },
  );

  it("enables for exact true", () => {
    process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] = "true";

    expect(isSkillAwareGoChecksEnabled()).toBe(true);
  });

  it("allows every user when the allowlist is unset", () => {
    delete process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG];

    expect(isSkillAwareGoChecksUserAllowed("any-user")).toBe(true);
  });

  it.each(["", "   ", ",,,", " , , \t, "])(
    "allows every user for an empty allowlist %j",
    (value) => {
      process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] = value;

      expect(isSkillAwareGoChecksUserAllowed("any-user")).toBe(true);
    },
  );

  it("allows only listed IDs with whitespace trimmed", () => {
    process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] = " a, b ,,c ";

    expect(isSkillAwareGoChecksUserAllowed("a")).toBe(true);
    expect(isSkillAwareGoChecksUserAllowed("b")).toBe(true);
    expect(isSkillAwareGoChecksUserAllowed("c")).toBe(true);
    expect(isSkillAwareGoChecksUserAllowed("absent-user")).toBe(false);
    expect(isSkillAwareGoChecksUserAllowed("ab")).toBe(false);
    expect(isSkillAwareGoChecksUserAllowed("")).toBe(false);
  });

  it("needs the flag, the allowlist and a user id", () => {
    process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] = "u1";
    delete process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];

    expect(isSkillAwareGoChecksOn("u1")).toBe(false);

    process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] = "true";

    expect(isSkillAwareGoChecksOn("u1")).toBe(true);
    expect(isSkillAwareGoChecksOn("u2")).toBe(false);
    expect(isSkillAwareGoChecksOn(null)).toBe(false);
    expect(isSkillAwareGoChecksOn(undefined)).toBe(false);
    expect(isSkillAwareGoChecksOn("")).toBe(false);
  });

  it("rates a missing or unknown skill as beginner only on the skill-aware path", () => {
    expect(ratingExperience(null, false)).toBeNull();
    expect(ratingExperience("pro", false)).toBe("pro");
    expect(ratingExperience(null, true)).toBe("beginner");
    expect(ratingExperience("  ", true)).toBe("beginner");
    expect(ratingExperience("pro", true)).toBe("beginner");
    expect(ratingExperience("Advanced", true)).toBe("advanced");
  });
});
