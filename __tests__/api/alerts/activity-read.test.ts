/** @jest-environment node */

import { NextRequest } from "next/server";

if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

const mockUser = { id: "user-1" };

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();

let selectedRow: { id: string; type: string; read_at: string | null } | null = null;
let selectError: { message: string } | null = null;
let updatedRow: { id: string; read_at: string } | null = null;
let updateError: { message: string } | null = null;

function buildSelectChain() {
  const chain: any = { queryKind: "select" };
  chain.select = mockSelect;
  chain.eq = mockEq;
  chain.in = mockIn;
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

function buildUpdateChain() {
  const chain: any = { queryKind: "update" };
  chain.update = mockUpdate;
  chain.eq = mockEq;
  chain.in = mockIn;
  chain.select = mockSelect;
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth:
      (handler: any) =>
      (request: Request, context: { params: { notificationId: string } }) =>
        handler(request, {
          user: mockUser,
          supabase: { from: mockFrom },
          params: context.params,
        }),
  };
});

import { POST } from "@/app/api/alerts/activity/[notificationId]/read/route";

describe("POST /api/alerts/activity/[notificationId]/read", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2026-05-26T12:34:00.000Z");
    mockSelect.mockImplementation(function (this: any) {
      return this;
    });
    mockEq.mockImplementation(function (this: any) {
      return this;
    });
    mockIn.mockImplementation(function (this: any) {
      return this;
    });
    mockUpdate.mockImplementation(function (this: any) {
      return this;
    });
    mockMaybeSingle.mockImplementation(function (this: any) {
      return Promise.resolve(
        this.queryKind === "update"
          ? { data: updatedRow, error: updateError }
          : { data: selectedRow, error: selectError },
      );
    });
    selectedRow = null;
    selectError = null;
    updatedRow = null;
    updateError = null;
    mockFrom.mockReturnValue(buildSelectChain());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marks an unread alert notification as read for the authenticated user", async () => {
    selectedRow = { id: "notif-1", type: "forecast_alert", read_at: null };
    updatedRow = { id: "notif-1", read_at: "2026-05-26T12:34:00.000Z" };
    mockFrom.mockReturnValueOnce(buildSelectChain()).mockReturnValueOnce(buildUpdateChain());

    const res = await POST(
      new NextRequest("http://localhost:3000/api/alerts/activity/notif-1/read", {
        method: "POST",
      }),
      { params: { notificationId: "notif-1" } },
    );

    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockSelect).toHaveBeenCalledWith("id, type, read_at");
    expect(mockEq).toHaveBeenCalledWith("id", "notif-1");
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockIn).toHaveBeenCalledWith("type", [
      "forecast_alert",
      "similarity_match",
    ]);
    expect(mockUpdate).toHaveBeenCalledWith({
      read_at: "2026-05-26T12:34:00.000Z",
    });

    const body = await res.json();
    expect(body.data).toEqual({
      id: "notif-1",
      read_at: "2026-05-26T12:34:00.000Z",
    });
    expect(body.data).not.toHaveProperty("data");
  });

  it("returns the existing read_at without updating an already-read alert", async () => {
    selectedRow = {
      id: "notif-read",
      type: "similarity_match",
      read_at: "2026-05-26T07:00:00.000Z",
    };

    const res = await POST(
      new NextRequest("http://localhost:3000/api/alerts/activity/notif-read/read", {
        method: "POST",
      }),
      { params: { notificationId: "notif-read" } },
    );

    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      data: {
        id: "notif-read",
        read_at: "2026-05-26T07:00:00.000Z",
      },
    });
  });

  it("returns 404 when the scoped alert notification does not exist", async () => {
    selectedRow = null;

    const res = await POST(
      new NextRequest("http://localhost:3000/api/alerts/activity/other-user/read", {
        method: "POST",
      }),
      { params: { notificationId: "other-user" } },
    );

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
