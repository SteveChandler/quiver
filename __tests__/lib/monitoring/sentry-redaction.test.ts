/** @jest-environment node */
jest.mock("@sentry/nextjs", () => ({ init: jest.fn() }));

describe.each(["server", "edge"])("%s telemetry redaction", (runtime) => {
  it("scrubs actual exception, transaction and log hooks", () => {
    jest.isolateModules(() => {
      require(`../../../sentry.${runtime}.config`);
      const { init } = require("@sentry/nextjs");
      const config = init.mock.calls[0][0];
      const event = {
        request: { url: "https://www.quiversurf.app/api/internal/send-welcome-email", headers: { authorization: "Bearer synthetic-access" } },
        exception: { values: [{ value: 'Error on {"refresh_token":"synthetic-refresh"}' }] },
      };
      for (const hook of [config.beforeSend, config.beforeSendTransaction, config.beforeSendLog]) {
        const result = hook(event);
        expect(result).not.toBeNull();
        expect(JSON.stringify(result)).not.toContain("synthetic-access");
        expect(JSON.stringify(result)).not.toContain("synthetic-refresh");
        expect(result.request.url).toBe(event.request.url);
      }
    });
  });
});
