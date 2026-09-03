import { redactSecrets } from "@/lib/monitoring/redact-secrets";

describe("credential redaction", () => {
  it("removes serialized sessions, headers and nested tokens from telemetry", () => {
    const event = {
      exception: { values: [{ value: 'Cannot create property user on string {"access_token":"synthetic-access","refresh_token":"synthetic-refresh"}' }] },
      request: { headers: { authorization: "Bearer synthetic-access", cookie: "sb-project-auth-token=synthetic-refresh" } },
      breadcrumbs: [{ message: "Bearer synthetic-access", data: { refresh_token: "synthetic-refresh" } }],
      message: "A safe failure",
    };
    const result = redactSecrets(event);
    const output = JSON.stringify(result);
    expect(output).not.toContain("synthetic-access");
    expect(output).not.toContain("synthetic-refresh");
    expect(result.message).toBe("A safe failure");
    expect(event.request.headers.authorization).toBe("Bearer synthetic-access");
  });

  it.each(["?token=synthetic-secret", "refresh_token=synthetic-secret", "eyJabc.def.ghi"])(
    "redacts credential-bearing strings: %s", (input) => {
      expect(redactSecrets(input)).toBe("[REDACTED]");
    }
  );
});
