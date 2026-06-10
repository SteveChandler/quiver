import {
  SESSION_BOARD_FIT_VALUES,
  SESSION_SKILL_FIT_VALUES,
  normalizeSessionDecomposition,
} from "@/lib/session-fit";

describe("session fit contract", () => {
  it("exports the v1 categorical skill and board fit values", () => {
    expect(SESSION_SKILL_FIT_VALUES).toEqual([
      "under",
      "dialed",
      "over_my_head",
    ]);
    expect(SESSION_BOARD_FIT_VALUES).toEqual([
      "too_small",
      "right",
      "too_much_board",
      "wrong_type",
      "na",
    ]);
  });

  it("normalizes selected values to the versioned session_decomposition shape", () => {
    expect(
      normalizeSessionDecomposition({
        waves: true,
        crew: false,
        skill_fit: "dialed",
        board_fit: "right",
      })
    ).toEqual({
      version: 1,
      waves: true,
      skill_fit: "dialed",
      board_fit: "right",
    });
  });

  it("returns null instead of storing a noisy empty object", () => {
    expect(
      normalizeSessionDecomposition({
        version: 1,
        waves: false,
        crew: false,
        vibe: false,
        skill_fit: undefined,
        board_fit: undefined,
      })
    ).toBeNull();
  });
});
