import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockIn = jest.fn();
const mockSelect = jest.fn(() => ({ in: mockIn }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ from: mockFrom }),
}));

type SwellStoryModule = typeof import("../swell-story");

function loadModule(): SwellStoryModule {
  let mod: SwellStoryModule | undefined;
  jest.isolateModules(() => {
    mod = require("../swell-story") as SwellStoryModule;
  });
  return mod!;
}

const rows = (card: boolean, push: boolean) => ({
  data: [{ key: "swell_story_card", enabled: card }, { key: "swell_story_push", enabled: push }],
  error: null,
});

const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  mockIn.mockReset();
  mockSelect.mockClear();
  mockFrom.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

afterEach(() => {
  jest.useRealTimers();
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
});

describe("swell story switches", () => {
  it("reads both rows of app_runtime_flags in one query, each switch on its own row", async () => {
    mockIn.mockResolvedValueOnce(rows(true, false));
    const { isSwellStoryCardEnabled, isSwellStoryPushEnabled } = loadModule();
    expect(await isSwellStoryCardEnabled()).toBe(true);
    expect(await isSwellStoryPushEnabled()).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith("app_runtime_flags");
    expect(mockSelect).toHaveBeenCalledWith("key, enabled");
    expect(mockIn).toHaveBeenCalledWith("key", ["swell_story_card", "swell_story_push"]);
    expect(mockIn).toHaveBeenCalledTimes(1);
  });

  it("reads a missing row and a non-boolean value as off", async () => {
    mockIn.mockResolvedValueOnce({ data: [{ key: "swell_story_push", enabled: "true" }], error: null });
    const { isSwellStoryCardEnabled, isSwellStoryPushEnabled } = loadModule();
    expect(await isSwellStoryCardEnabled()).toBe(false);
    expect(await isSwellStoryPushEnabled()).toBe(false);
  });

  it("caches the values for 60 s", async () => {
    jest.useFakeTimers();
    const { isSwellStoryCardEnabled } = loadModule();
    mockIn.mockResolvedValue(rows(true, true));
    expect(await isSwellStoryCardEnabled()).toBe(true);
    jest.advanceTimersByTime(59_000);
    mockIn.mockResolvedValue(rows(false, false));
    expect(await isSwellStoryCardEnabled()).toBe(true);
    expect(mockIn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1_001);
    expect(await isSwellStoryCardEnabled()).toBe(false);
    expect(mockIn).toHaveBeenCalledTimes(2);
  });

  it("reads off on a failed first read, and caches the failure", async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { isSwellStoryCardEnabled, isSwellStoryPushEnabled } = loadModule();
    expect(await isSwellStoryCardEnabled()).toBe(false);
    expect(await isSwellStoryPushEnabled()).toBe(false);
    expect(mockIn).toHaveBeenCalledTimes(1);
    expectConsoleWarnings([/\[swell-story\] Switch read failed with no earlier read; treating as off: boom/]);
  });

  it("keeps the last read values through a failed read", async () => {
    jest.useFakeTimers();
    const { isSwellStoryCardEnabled, isSwellStoryPushEnabled } = loadModule();
    mockIn.mockResolvedValueOnce(rows(true, false));
    expect(await isSwellStoryCardEnabled()).toBe(true);
    jest.advanceTimersByTime(60_001);
    mockIn.mockRejectedValueOnce(new Error("network down"));
    expect(await isSwellStoryCardEnabled()).toBe(true);
    expect(await isSwellStoryPushEnabled()).toBe(false);
    expectConsoleWarnings([/\[swell-story\] Switch read failed; keeping last read values: network down/]);
  });

  it("reads off without a query when the service role is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await loadModule().isSwellStoryCardEnabled()).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
