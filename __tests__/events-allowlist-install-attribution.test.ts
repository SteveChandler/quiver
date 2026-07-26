import {
  ANONYMOUS_ALLOWED_EVENTS,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
} from "@/lib/analytics/event-taxonomy";
import { EVENT_WEIGHTS } from "@/types/implicit-preferences";

const JOIN_EVENT = "native_install_attribution_joined" as const;

describe("native install attribution durable event", () => {
  it("is accepted only after authentication and has no preference weight", () => {
    expect(VALID_EVENTS).toContain(JOIN_EVENT);
    expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(JOIN_EVENT);
    expect(PRE_AUTH_ONLY_EVENTS).not.toContain(JOIN_EVENT);
    expect(EVENT_WEIGHTS[JOIN_EVENT]).toBe(0);
  });
});
