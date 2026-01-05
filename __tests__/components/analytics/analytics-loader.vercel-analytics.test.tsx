import React from "react";
import { render, screen } from "@testing-library/react";

// The AnalyticsLoader uses Next.js Script to inject external analytics scripts.
// For unit tests we don't need to execute / load those scripts.
jest.mock("next/script", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/attribution", () => ({
  hasUTMParams: () => false,
  getAttributionForAnalytics: () => ({}),
}));

jest.mock("@vercel/analytics/react", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

import { AnalyticsLoader } from "@/components/analytics/analytics-loader";

describe("AnalyticsLoader (Vercel Web Analytics)", () => {
  it("mounts the Vercel Analytics component", () => {
    render(<AnalyticsLoader />);
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
  });
});


