import {
  CALL_SHARED_RANKING_ENABLED_FLAG,
  CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG,
  isSharedCallRankingEnabled,
  isSharedCallRankingUserAllowed,
} from "@/lib/flags/shared-call-ranking";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("shared call ranking flags", () => {
  it("defaults off when unset", () => {
    delete process.env[CALL_SHARED_RANKING_ENABLED_FLAG];

    expect(isSharedCallRankingEnabled()).toBe(false);
  });

  it.each(["", "false", "TRUE", "1", " true", "true "])(
    "stays off for %j",
    (value) => {
      process.env[CALL_SHARED_RANKING_ENABLED_FLAG] = value;

      expect(isSharedCallRankingEnabled()).toBe(false);
    },
  );

  it("enables for exact true", () => {
    process.env[CALL_SHARED_RANKING_ENABLED_FLAG] = "true";

    expect(isSharedCallRankingEnabled()).toBe(true);
  });

  it("allows every user when the allowlist is unset", () => {
    delete process.env[CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG];

    expect(isSharedCallRankingUserAllowed("any-user")).toBe(true);
  });

  it.each(["", "   ", ",,,", " , , \t, "])(
    "allows every user for an empty allowlist %j",
    (value) => {
      process.env[CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG] = value;

      expect(isSharedCallRankingUserAllowed("any-user")).toBe(true);
    },
  );

  it("allows only listed IDs with whitespace trimmed", () => {
    process.env[CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG] = " a, b ,,c ";

    expect(isSharedCallRankingUserAllowed("a")).toBe(true);
    expect(isSharedCallRankingUserAllowed("b")).toBe(true);
    expect(isSharedCallRankingUserAllowed("c")).toBe(true);
    expect(isSharedCallRankingUserAllowed("absent-user")).toBe(false);
    expect(isSharedCallRankingUserAllowed("ab")).toBe(false);
    expect(isSharedCallRankingUserAllowed("")).toBe(false);
  });
});
