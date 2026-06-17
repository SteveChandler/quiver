import { render, screen } from "@testing-library/react";

import { AppProofWalkthrough } from "@/components/landing-page/app-proof-walkthrough";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    priority: _priority,
    ...props
  }: Record<string, unknown>) => <img alt={String(alt)} {...props} />,
}));

describe("AppProofWalkthrough", () => {
  it("anchors the proof section and shows the three app loop steps", () => {
    const { container } = render(<AppProofWalkthrough />);

    expect(container.querySelector("#proof")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /the app loop before dawn patrol/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/get the call/i)).toBeInTheDocument();
    expect(screen.getByText(/check the beach/i)).toBeInTheDocument();
    expect(screen.getByText(/log the session/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });
});
