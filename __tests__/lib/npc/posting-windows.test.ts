import { isInPostingWindow } from "@/lib/npc/posting-windows";

describe("isInPostingWindow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns true when hour is in primary window", () => {
    // isInPostingWindow uses date.getHours() (machine-local), so use fake timers
    // to make getHours() deterministic. 6:30 AM local is in the local's primary [5,8].
    jest.setSystemTime(new Date(2026, 0, 13, 6, 30, 0));
    const date = new Date();
    expect(isInPostingWindow("local", date)).toBe(true);
  });

  it("returns false when outside posting windows", () => {
    // 12:00 PM local is outside the local's windows [5,8] and [16,19].
    jest.setSystemTime(new Date(2026, 0, 13, 12, 0, 0));
    const date = new Date();
    expect(isInPostingWindow("local", date)).toBe(false);
  });
});
