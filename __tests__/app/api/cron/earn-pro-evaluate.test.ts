/** @jest-environment node */
import { GET } from "@/app/api/cron/earn-pro-evaluate/route";
jest.mock("@/lib/middleware/api-wrappers", () => ({ validateCronRequest: (r: Request) => r.headers.get("Authorization") === "Bearer fixture" }));
it("retired weekly grant cannot hand off even with the old enabled flag", async () => {
  process.env.EARN_PRO_ENABLED = "true";
  const result = await GET(new Request("http://localhost/api/cron/earn-pro-evaluate", { headers: { Authorization: "Bearer fixture" } }));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ status: "retired", replacement: "/api/offers/claim", granted: 0 });
  delete process.env.EARN_PRO_ENABLED;
});
it("still rejects unauthorized requests", async () => {
  expect((await GET(new Request("http://localhost/api/cron/earn-pro-evaluate"))).status).toBe(401);
});
