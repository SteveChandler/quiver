/**
 * PlanningChecklist — a pre-drive checklist that behaves like paper: ticks stay
 * ticked and are remembered per city.
 */

import { fireEvent, render, screen } from "@testing-library/react";

import { PlanningChecklist } from "@/components/city/planning-checklist";

const items = [
  "Check the Humboldt County and California State Parks access pages for current notices.",
  "Use a cold-water wetsuit appropriate for Northern California.",
  "Watch from shore for current channels and sneaker waves before paddling out.",
];

describe("PlanningChecklist", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns nothing without items", () => {
    expect(render(<PlanningChecklist items={[]} />).container.firstChild).toBeNull();
    // @ts-expect-error - editorial rows can omit the list
    expect(render(<PlanningChecklist items={undefined} />).container.firstChild).toBeNull();
  });

  it("renders every item as a real checkbox under an h2, with no dash marker", () => {
    render(<PlanningChecklist items={items} />);
    expect(screen.getByRole("heading", { level: 2, name: /planning checklist/i })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(items.length);
    expect(screen.getAllByRole("listitem")).toHaveLength(items.length);
    for (const item of items) expect(screen.getByLabelText(item)).not.toBeChecked();
    expect(screen.queryByText("-")).toBeNull();
  });

  it("ticks an item and counts it", () => {
    render(<PlanningChecklist items={items} />);
    expect(screen.getByText("0 of 3 checked")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(items[0]));
    expect(screen.getByLabelText(items[0])).toBeChecked();
    expect(screen.getByText("1 of 3 checked")).toBeInTheDocument();
  });

  it("remembers ticks per city across a remount", () => {
    const first = render(<PlanningChecklist items={items} storageKey="ca-trinidad" />);
    fireEvent.click(screen.getByLabelText(items[1]));
    expect(JSON.parse(window.localStorage.getItem("quiver_checklist_ca-trinidad") ?? "[]")).toEqual([
      false,
      true,
      false,
    ]);
    first.unmount();

    render(<PlanningChecklist items={items} storageKey="ca-trinidad" />);
    expect(screen.getByLabelText(items[1])).toBeChecked();
    expect(screen.getByLabelText(items[0])).not.toBeChecked();
  });

  it("keeps cities separate and survives a corrupted store", () => {
    window.localStorage.setItem("quiver_checklist_ca-trinidad", "not json");
    window.localStorage.setItem("quiver_checklist_ca-pacifica", JSON.stringify([true, true, true]));
    render(<PlanningChecklist items={items} storageKey="ca-trinidad" />);
    expect(screen.getByText("0 of 3 checked")).toBeInTheDocument();
  });

  it("does not touch storage when no key is given", () => {
    render(<PlanningChecklist items={items} />);
    fireEvent.click(screen.getByLabelText(items[0]));
    expect(window.localStorage.length).toBe(0);
  });

  it("signs off when everything is ticked and can start over", () => {
    render(<PlanningChecklist items={items} storageKey="ca-trinidad" />);
    expect(screen.queryByText(/from the sand/)).toBeNull();
    for (const item of items) fireEvent.click(screen.getByLabelText(item));

    expect(screen.getByText("All ticked. Now go look at it from the sand.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.queryByText(/from the sand/)).toBeNull();
    expect(screen.getByText("0 of 3 checked")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("quiver_checklist_ca-trinidad") ?? "[]")).toEqual([
      false,
      false,
      false,
    ]);
  });
});
