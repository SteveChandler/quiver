import {
  LEARN_APP_HANDOFF_CTA_ENABLED,
  isLearnAppHandoffCtaEnabled,
} from "@/lib/flags/learn-app-handoff-cta";

const originalFlag = process.env[LEARN_APP_HANDOFF_CTA_ENABLED];

function setFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[LEARN_APP_HANDOFF_CTA_ENABLED];
    return;
  }
  process.env[LEARN_APP_HANDOFF_CTA_ENABLED] = value;
}

describe("learn app handoff CTA flag", () => {
  afterEach(() => {
    setFlag(originalFlag);
  });

  it.each([undefined, "", "false", "TRUE", "1"])("fails closed when the flag is %p", (value) => {
    setFlag(value);
    expect(isLearnAppHandoffCtaEnabled()).toBe(false);
  });

  it("opens only on the exact string true", () => {
    setFlag("true");
    expect(isLearnAppHandoffCtaEnabled()).toBe(true);
  });
});
