/**
 * @jest-environment node
 */

import { setupApiTestEnvironment } from "@/test-utils/api-test-helpers";
import { NextRequest } from "next/server";

const eqMock = jest.fn();
const orderMock = jest.fn();
const limitMock = jest.fn();

const buildChain = () => {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = eqMock.mockReturnValue(chain);
  chain.order = orderMock.mockReturnValue(chain);
  chain.limit = limitMock.mockResolvedValue({ data: [], error: null });
  return chain;
};

const fromMock = jest.fn(() => buildChain());

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve({ from: fromMock })),
}));

jest.mock("@/actions/session-actions", () => ({
  addFeaturedPhotoToSessions: jest.fn(async (_supabase: unknown, sessions: unknown[]) => sessions),
}));

const { GET } = require("@/app/api/beaches/[id]/sessions/route");

describe("GET /api/beaches/[id]/sessions", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    eqMock.mockClear();
    orderMock.mockClear();
    limitMock.mockClear();
    fromMock.mockClear();
    fromMock.mockImplementation(() => buildChain());
  });

  afterEach(() => {
    cleanup();
  });

  it("does NOT filter is_public when publicOnly is absent", async () => {
    const request = new NextRequest("http://localhost/api/beaches/abc/sessions?limit=5");
    await GET(request, { params: Promise.resolve({ id: "abc" }) });

    const eqCalls = eqMock.mock.calls;
    expect(eqCalls).toContainEqual(["beach_id", "abc"]);
    expect(eqCalls).toContainEqual(["status", "completed"]);
    expect(eqCalls.find((c) => c[0] === "is_public")).toBeUndefined();
  });

  it("does NOT filter is_public when publicOnly is 'false'", async () => {
    const request = new NextRequest("http://localhost/api/beaches/abc/sessions?publicOnly=false");
    await GET(request, { params: Promise.resolve({ id: "abc" }) });

    const eqCalls = eqMock.mock.calls;
    expect(eqCalls.find((c) => c[0] === "is_public")).toBeUndefined();
  });

  it("filters is_public=true when publicOnly=true", async () => {
    const request = new NextRequest("http://localhost/api/beaches/abc/sessions?publicOnly=true&limit=3");
    await GET(request, { params: Promise.resolve({ id: "abc" }) });

    const eqCalls = eqMock.mock.calls;
    expect(eqCalls).toContainEqual(["beach_id", "abc"]);
    expect(eqCalls).toContainEqual(["status", "completed"]);
    expect(eqCalls).toContainEqual(["is_public", true]);
  });

  it("respects the limit param (max 25)", async () => {
    const request = new NextRequest("http://localhost/api/beaches/abc/sessions?limit=3");
    await GET(request, { params: Promise.resolve({ id: "abc" }) });
    expect(limitMock).toHaveBeenCalledWith(3);

    limitMock.mockClear();

    const requestBig = new NextRequest("http://localhost/api/beaches/abc/sessions?limit=999");
    await GET(requestBig, { params: Promise.resolve({ id: "abc" }) });
    expect(limitMock).toHaveBeenCalledWith(25);
  });
});
