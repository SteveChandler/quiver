import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  SwellWatchEmail,
  type SwellWatchEmailProps,
} from "@/lib/mailer/templates/SwellWatchEmail";

function makeProps(
  overrides: Partial<SwellWatchEmailProps> = {}
): SwellWatchEmailProps {
  return {
    beachName: "Lower Trestles",
    eventStartDate: "2026-07-05",
    peakDate: "2026-07-06",
    peakHeightFt: 6,
    peakPeriodS: 14,
    forecastAt: "2026-07-06T19:00:00.000Z",
    issuedAt: "2026-07-01T15:00:00.000Z",
    timezone: "America/Los_Angeles",
    ctaUrl: "https://www.quiversurf.app/surf/san-clemente/lower-trestles",
    manageUrl: "https://www.quiversurf.app/settings",
    unsubscribeUrl: "https://www.quiversurf.app/api/alerts/unsubscribe-email",
    ...overrides,
  };
}

describe("SwellWatchEmail", () => {
  it("uses the issue date, not the peak forecast date, in the masthead", () => {
    const { container } = render(<SwellWatchEmail {...makeProps()} />);

    expect(container.textContent).toContain("WED · JUL 1");
    expect(container.textContent).not.toContain("MON · JUL 6");
    expect(container.textContent).toContain("Sunday arrival · Monday peak");
  });
});
