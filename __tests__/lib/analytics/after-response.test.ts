/** @jest-environment node */

const mockAfter = jest.fn();
jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: (...args: unknown[]) => mockAfter(...args),
}));

import { runAfterResponse } from "@/lib/analytics/after-response";

describe("runAfterResponse", () => {
  beforeEach(() => mockAfter.mockReset());

  it("hands the task to next/server after() without running it", () => {
    const task = jest.fn(async () => undefined);

    runAfterResponse(task);

    expect(mockAfter).toHaveBeenCalledWith(task);
    expect(task).not.toHaveBeenCalled();
  });

  it("runs the task detached when there is no request scope", async () => {
    mockAfter.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });
    const task = jest.fn(async () => undefined);

    expect(() => runAfterResponse(task)).not.toThrow();
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejection from the detached task", async () => {
    mockAfter.mockImplementation(() => {
      throw new Error("outside request scope");
    });

    expect(() =>
      runAfterResponse(async () => {
        throw new Error("capture failed");
      }),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});
