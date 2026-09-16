/** @jest-environment node */
import { GET } from "@/app/api/cron/weekly-recap-email/route";
const mockAuth = jest.fn();
jest.mock("@/lib/middleware/api-wrappers", () => ({ validateCronRequest: () => mockAuth() }));
jest.mock("@/lib/mailer/client", () => ({ sendEmail: () => { throw new Error("Retired route attempted send"); } }));
it("keeps retired cron authenticated and never sends", async () => {
  mockAuth.mockReturnValue(false);
  expect((await GET(new Request("http://localhost/cron"))).status).toBe(401);
  mockAuth.mockReturnValue(true);
  const response = await GET(new Request("http://localhost/cron"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "retired", replacement: "/api/cron/email-lifecycle", sent: 0 });
});
