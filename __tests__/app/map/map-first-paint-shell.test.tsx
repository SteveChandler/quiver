import { render, screen } from "@testing-library/react";
import { MapFirstPaintShell } from "@/app/map/map-first-paint-shell";

describe("MapFirstPaintShell", () => {
  it("keeps the loading state in the final map geometry and announces it", () => {
    render(<MapFirstPaintShell />);

    expect(screen.getByTestId("map-first-paint-shell")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Loading surf map and nearby conditions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Charting nearby breaks…")).toBeInTheDocument();
    expect(screen.getAllByTestId("map-toolbar-skeleton-action")).toHaveLength(4);
    expect(screen.queryByText("Popular surf spots")).not.toBeInTheDocument();
  });
});
