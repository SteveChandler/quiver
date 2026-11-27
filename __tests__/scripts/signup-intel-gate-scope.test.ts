import { classifyGateEvent, isDevBuildEvent, type GateScopeRule } from "@/scripts/signup-intel-gate-scope";

const authScreens: GateScopeRule = {
  key: "source",
  values: ["auth-page", "redirect", "email-confirmed", "welcome_gate"],
  label: "full-page auth screens and the native welcome gate",
};

const event = (metadata: unknown) => ({ metadata });

describe("signup intel gate scope", () => {
  it.each(["auth-page", "redirect", "email-confirmed", "welcome_gate"])(
    "keeps %s out of the prompted-modal gate",
    (source) => {
      expect(classifyGateEvent(event({ source, mode: "signup" }), authScreens)).toBe("out-of-scope");
    }
  );

  it.each(["app-header", "inline-cta-cams-hawaii-inline", "sticky-bar-beach-detail-agate-beach", "landing-navbar"])(
    "counts the prompted modal source %s",
    (source) => {
      expect(classifyGateEvent(event({ source }), authScreens)).toBe("counted");
    }
  );

  it("counts every event when the gate has no scope rule", () => {
    expect(classifyGateEvent(event({ source: "auth-page" }))).toBe("counted");
  });

  it("counts an event that has no source or no metadata", () => {
    expect(classifyGateEvent(event({ mode: "login" }), authScreens)).toBe("counted");
    expect(classifyGateEvent(event(null), authScreens)).toBe("counted");
  });

  it("drops emulator and development-channel events before the scope rule", () => {
    expect(classifyGateEvent(event({ source: "app-header", is_emulator: true }), authScreens)).toBe("dev-build");
    expect(classifyGateEvent(event({ source: "welcome_gate", expo_channel: "development" }), authScreens)).toBe("dev-build");
    expect(classifyGateEvent(event({ is_emulator: true }))).toBe("dev-build");
  });

  it("does not treat production or web events as dev builds", () => {
    expect(isDevBuildEvent(event({ is_emulator: false, expo_channel: "production" }))).toBe(false);
    expect(isDevBuildEvent(event({ platform: "web" }))).toBe(false);
    expect(isDevBuildEvent(event({ expo_channel: null }))).toBe(false);
  });
});
