import { createClientAppHandoffLink } from "@/lib/analytics/app-handoff-link";

const getClientPostHogDistinctId = jest.fn<string | undefined, []>();

jest.mock("@/lib/posthog-client", () => ({
  getClientPostHogDistinctId: () => getClientPostHogDistinctId(),
}));

describe("createClientAppHandoffLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses go.quiversurf.app and a fresh UUID without consent identity", () => {
    getClientPostHogDistinctId.mockReturnValue(undefined);

    const link = createClientAppHandoffLink({
      source: "web",
      surface: "landing-page",
      placement: "hero",
    });
    const url = new URL(link.url);

    expect(url.host).toBe("go.quiversurf.app");
    expect(url.searchParams.get("handoff_id")).toBe(link.handoffId);
    expect(url.searchParams.has("web_distinct_id")).toBe(false);
    expect(link.handoffId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("carries the web distinct ID only when consent allows it", () => {
    getClientPostHogDistinctId.mockReturnValue("web-person");

    const link = createClientAppHandoffLink({ source: "web" });

    expect(new URL(link.url).searchParams.get("web_distinct_id")).toBe(
      "web-person",
    );
  });
});
