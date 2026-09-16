import {
  BOARD_PICKS_FREE_ENABLED_FLAG,
  isBoardPicksFreeEnabled,
} from "../board-picks-free";

describe("isBoardPicksFreeEnabled", () => {
  const previous = process.env[BOARD_PICKS_FREE_ENABLED_FLAG];

  afterEach(() => {
    if (previous === undefined) delete process.env[BOARD_PICKS_FREE_ENABLED_FLAG];
    else process.env[BOARD_PICKS_FREE_ENABLED_FLAG] = previous;
  });

  it("defaults off and requires the literal true string", () => {
    delete process.env[BOARD_PICKS_FREE_ENABLED_FLAG];
    expect(isBoardPicksFreeEnabled()).toBe(false);
    process.env[BOARD_PICKS_FREE_ENABLED_FLAG] = "true";
    expect(isBoardPicksFreeEnabled()).toBe(true);
    process.env[BOARD_PICKS_FREE_ENABLED_FLAG] = "1";
    expect(isBoardPicksFreeEnabled()).toBe(false);
  });
});
