/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

it("retires the deployed signup webhook without sending or reading its payload", async () => {
  let handler: ((request: Request) => Response) | undefined;
  const fetch = jest.fn(() => { throw new Error("Retired webhook contacted a provider"); });
  runInNewContext(readFileSync(resolve(process.cwd(), "supabase/functions/on-auth-user-created/index.ts"), "utf8"), {
    Deno: { serve: (callback: (request: Request) => Response): void => { handler = callback; } },
    Response, fetch,
  });
  expect(handler).toBeDefined();
  for (const body of [JSON.stringify({ record: { id: "qa", email: "qa@example.invalid" } }), "invalid-json"]) {
    const response = await handler!(new Request("https://example.invalid/signup", { method: "POST", body }));
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "retired", replacement: "/api/cron/email-lifecycle", sent: 0 });
  }
  expect(fetch).not.toHaveBeenCalled();
});
