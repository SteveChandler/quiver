/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/offers/claim/route";
const mockFulfill = jest.fn();
jest.mock("@/lib/subscription/offer-fulfillment", () => ({ fulfillProOffer: (...args: unknown[]) => mockFulfill(...args) }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: unknown) => handler,
  withAuth: (handler: (request: Request, context: unknown) => unknown) => (request: Request) => handler(request, { user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));
const request = (body: unknown): NextRequest => new NextRequest("http://localhost/api/offers/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => jest.resetAllMocks());
it("defaults to read-only preview with the authenticated account", async () => {
  mockFulfill.mockResolvedValue({ status: "preview", months: 1 });
  const response = await POST(request({ offerToken: "a".repeat(43) }));
  expect(response.status).toBe(200);
  expect(mockFulfill).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "a".repeat(43), fetch, true);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it.each([{ offerToken: "short" }, { offerToken: "a".repeat(43), userId: "other" }, { offerToken: "a".repeat(43), mode: "live" }])("invalid or owner-overriding payload is rejected", async body => {
  expect((await POST(request(body))).status).toBe(400); expect(mockFulfill).not.toHaveBeenCalled();
});
it.each([["not_found",404],["held_active_access",409],["reconciliation_required",503],["disabled",503],["verified",200]])("%s has truthful HTTP status", async (status, http) => {
  mockFulfill.mockResolvedValue({ status });
  expect((await POST(request({ offerToken: "a".repeat(43), mode: "claim" }))).status).toBe(http);
});
