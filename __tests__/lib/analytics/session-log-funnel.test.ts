import { createSessionLogFlowId } from "@/lib/analytics/session-log-funnel";

it("creates a session log flow when randomUUID is unavailable", () => {
  const randomUUID = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", { value: undefined });
  try {
    expect(createSessionLogFlowId()).toMatch(/^web-\d+-[a-z0-9]+$/);
  } finally {
    Object.defineProperty(crypto, "randomUUID", { value: randomUUID });
  }
});
