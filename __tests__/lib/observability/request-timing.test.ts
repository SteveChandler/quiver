/** @jest-environment node */
jest.mock("server-only", () => ({}));

import {
  formatServerTiming,
  recordStage,
  runWithStageTimings,
  startInstanceProbe,
  timeStage,
  timeStageSync,
} from "@/lib/observability/request-timing";

describe("request stage timings", () => {
  it("ignores stages recorded outside a request", async () => {
    recordStage("orphan", 5);
    await expect(timeStage("orphan", async () => 1)).resolves.toBe(1);
    expect(timeStageSync("orphan", () => 2)).toBe(2);
  });

  it("collects async, sync and nested stages per request without mixing requests", async () => {
    const first = runWithStageTimings(async () => {
      await timeStage("load", async () => {
        timeStageSync("build", () => undefined);
      });
      recordStage("manual", 12.345);
      return "done";
    });
    const second = runWithStageTimings(async () => {
      recordStage("other", 1);
    });
    await expect(first.result).resolves.toBe("done");
    await second.result;
    expect(first.stages.map((stage) => stage.name)).toEqual(["build", "load", "manual"]);
    expect(first.stages[2].ms).toBe(12.3);
    expect(second.stages.map((stage) => stage.name)).toEqual(["other"]);
  });

  it("records a stage even when its work rejects", async () => {
    const run = runWithStageTimings(() => timeStage("fails", async () => {
      throw new Error("boom");
    }));
    await expect(run.result).rejects.toThrow("boom");
    expect(run.stages.map((stage) => stage.name)).toEqual(["fails"]);
  });

  it("formats a Server-Timing header with token-safe names", () => {
    expect(formatServerTiming([
      { name: "swell-past rows", ms: 4.5 },
      { name: "total", ms: 10 },
    ])).toBe("swell-past_rows;dur=4.5, total;dur=10");
  });
});

describe("instance probe", () => {
  it("marks only the first request cold and counts concurrent requests", () => {
    const stopFirst = startInstanceProbe();
    const stopSecond = startInstanceProbe();
    const first = stopFirst();
    const second = stopSecond();
    expect(first).toMatchObject({ cold: true, inflight: 1 });
    expect(second).toMatchObject({ cold: false, inflight: 2 });
    expect(stopFirst()).toBe(first);
    expect(startInstanceProbe()()).toMatchObject({ cold: false, inflight: 1 });
    expect(first.cpuMs).toBeGreaterThanOrEqual(0);
    expect(first.loopDelayMaxMs).toBeGreaterThanOrEqual(0);
  });
});
