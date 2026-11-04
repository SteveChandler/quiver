import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc: mockRpc }),
}));

type FoundingAccessModule = typeof import("../founding-access");

function loadModule(): FoundingAccessModule {
  let mod: FoundingAccessModule | undefined;
  jest.isolateModules(() => {
    mod = require("../founding-access") as FoundingAccessModule;
  });
  return mod!;
}

const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  mockRpc.mockReset();
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

describe("founding access switch", () => {

  it("reads founding_access_enabled() and returns true only for a literal true", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await loadModule().isFoundingAccessEnabled()).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("founding_access_enabled");

    mockRpc.mockResolvedValueOnce({ data: "true", error: null });
    expect(await loadModule().isFoundingAccessEnabled()).toBe(false);
  });

  it("returns false when the switch is off", async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await loadModule().isFoundingAccessEnabled()).toBe(false);
  });

  it("caches the value for 60 s and shares one in-flight read", async () => {
    jest.useFakeTimers();
    const { isFoundingAccessEnabled } = loadModule();
    mockRpc.mockResolvedValue({ data: true, error: null });

    const [a, b] = await Promise.all([isFoundingAccessEnabled(), isFoundingAccessEnabled()]);
    expect([a, b]).toEqual([true, true]);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(59_000);
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await isFoundingAccessEnabled()).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1_001);
    expect(await isFoundingAccessEnabled()).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("fails closed on an RPC error and caches the failure", async () => {
    const { isFoundingAccessEnabled } = loadModule();
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await isFoundingAccessEnabled()).toBe(false);
    expect(await isFoundingAccessEnabled()).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expectConsoleWarnings([/\[founding-access\] Switch read failed; treating as off: boom/]);
  });

  it("fails closed on a thrown client error", async () => {
    mockRpc.mockRejectedValue(new Error("network down"));
    expect(await loadModule().isFoundingAccessEnabled()).toBe(false);
    expectConsoleWarnings([/network down/]);
  });

  it("reads as off without querying when the service role is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await loadModule().isFoundingAccessEnabled()).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("resolveFeatureAccess", () => {
  it("switch ON: a signed-in free user gets founding feature access", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await loadModule().resolveFeatureAccess("user-1", false)).toEqual({
      isPro: false,
      foundingAccess: true,
      hasFeatureAccess: true,
    });
  });

  it("switch OFF: a signed-in free user has no feature access", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await loadModule().resolveFeatureAccess("user-1", false)).toEqual({
      isPro: false,
      foundingAccess: false,
      hasFeatureAccess: false,
    });
  });

  it("Pro is never founding and never reads the switch", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await loadModule().resolveFeatureAccess("user-1", true)).toEqual({
      isPro: true,
      foundingAccess: false,
      hasFeatureAccess: true,
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("guests are not covered even when the switch is on", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { resolveFeatureAccess } = loadModule();
    expect(await resolveFeatureAccess(null, false)).toEqual({
      isPro: false,
      foundingAccess: false,
      hasFeatureAccess: false,
    });
    expect(await resolveFeatureAccess(undefined, false)).toMatchObject({ hasFeatureAccess: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
