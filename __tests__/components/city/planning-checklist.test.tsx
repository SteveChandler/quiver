/**
 * Tests for PlanningChecklist Component
 *
 * Tests the planning checklist component that displays actionable checklist items.
 * Priority 3 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { PlanningChecklist } from "@/components/city/planning-checklist";

describe("PlanningChecklist Component", () => {
  const mockItems = [
    "Check tide charts for optimal session windows",
    "Review marine layer forecasts for morning conditions",
    "Confirm parking availability at primary spots",
    "Pack appropriate wetsuit thickness for current temps",
  ];

  describe("Rendering", () => {
    it("should render section heading", () => {
      render(<PlanningChecklist items={mockItems} />);

      expect(screen.getByText("Planning Checklist")).toBeInTheDocument();
    });

    it("should render all checklist items", () => {
      render(<PlanningChecklist items={mockItems} />);

      expect(
        screen.getByText("Check tide charts for optimal session windows")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Review marine layer forecasts for morning conditions")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Confirm parking availability at primary spots")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Pack appropriate wetsuit thickness/)
      ).toBeInTheDocument();
    });

    it("should render dash markers for each item", () => {
      const { container } = render(<PlanningChecklist items={mockItems} />);

      const dashes = container.querySelectorAll("span.text-sky-600");
      expect(dashes.length).toBe(mockItems.length);
      dashes.forEach((dash) => {
        expect(dash.textContent).toBe("-");
      });
    });

    it("should render items in a list", () => {
      render(<PlanningChecklist items={mockItems} />);

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(mockItems.length);
    });
  });

  describe("Empty State", () => {
    it("should return null when items array is empty", () => {
      const { container } = render(<PlanningChecklist items={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when items is undefined", () => {
      // @ts-expect-error - Testing undefined case
      const { container } = render(<PlanningChecklist items={undefined} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Single Item", () => {
    it("should render correctly with single item", () => {
      render(<PlanningChecklist items={["Single checklist item"]} />);

      expect(screen.getByText("Single checklist item")).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(1);
    });
  });

  describe("Many Items", () => {
    it("should render correctly with many items", () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`);
      render(<PlanningChecklist items={manyItems} />);

      manyItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });

      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(10);
    });
  });

  describe("Heading Level", () => {
    it("should use h2 for section heading", () => {
      render(<PlanningChecklist items={mockItems} />);

      const heading = screen.getByRole("heading", { name: "Planning Checklist" });
      expect(heading.tagName).toBe("H2");
    });
  });

  describe("Styling", () => {
    it("should render as aside element", () => {
      const { container } = render(<PlanningChecklist items={mockItems} />);

      const aside = container.querySelector("aside");
      expect(aside).toBeInTheDocument();
    });

    it("should apply card styling", () => {
      const { container } = render(<PlanningChecklist items={mockItems} />);

      const aside = container.querySelector("aside");
      expect(aside?.className).toContain("rounded-xl");
      expect(aside?.className).toContain("border");
      expect(aside?.className).toContain("bg-slate-50");
      expect(aside?.className).toContain("p-6");
    });

    it("should apply sky color to dash markers", () => {
      const { container } = render(<PlanningChecklist items={mockItems} />);

      const dash = container.querySelector("span.text-sky-600");
      expect(dash).toBeInTheDocument();
    });

    it("should apply spacing between items", () => {
      const { container } = render(<PlanningChecklist items={mockItems} />);

      const list = container.querySelector("ul");
      expect(list?.className).toContain("space-y-2");
    });
  });

  describe("Item Layout", () => {
    it("should display items with flex layout", () => {
      const { container } = render(<PlanningChecklist items={mockItems} />);

      const listItem = container.querySelector("li");
      expect(listItem?.className).toContain("flex");
      expect(listItem?.className).toContain("items-start");
      expect(listItem?.className).toContain("gap-2");
    });
  });

  describe("Long Item Text", () => {
    it("should handle long item text without breaking", () => {
      const longItem =
        "This is a very long checklist item that contains a lot of text and should still render properly without any issues in the component layout";
      render(<PlanningChecklist items={[longItem]} />);

      expect(screen.getByText(longItem)).toBeInTheDocument();
    });
  });

  describe("Special Characters", () => {
    it("should handle items with special characters", () => {
      const specialItems = [
        "Check 5-day forecast & tide charts",
        "Water temp: ~60°F (wear 4/3mm wetsuit)",
        "Sunrise @ 6:30am - prime session window",
      ];
      render(<PlanningChecklist items={specialItems} />);

      specialItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
  });
});
