import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConditionBuilder } from "@/components/alerts/condition-builder";
import type { AlertConditions } from "@/lib/alerts/types";

/**
 * The alert rule builder is the premium feature. Every control must carry an
 * accessible name — the visible condition label is a <span>, so name resolution
 * relies entirely on the explicit aria-labels added here.
 */
describe("ConditionBuilder accessibility", () => {
  const noop = () => {};

  it("names both swell height inputs distinctly", () => {
    const conditions: AlertConditions = {
      swell_height_min: 2,
      swell_height_max: 6,
    } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(
      screen.getByRole("spinbutton", { name: /minimum swell size/i })
    ).toHaveValue(2);
    expect(
      screen.getByRole("spinbutton", { name: /maximum swell size/i })
    ).toHaveValue(6);
  });

  it("names the wind direction select", () => {
    const conditions = { wind_direction: "offshore" } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(
      screen.getByRole("combobox", { name: /wind direction/i })
    ).toHaveValue("offshore");
  });

  it("names the tide direction select and tide height range", () => {
    const conditions = {
      tide_direction: "rising",
      tide_height_min_ft: 1,
      tide_height_max_ft: 4,
    } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(
      screen.getByRole("combobox", { name: /tide direction/i })
    ).toHaveValue("rising");
    expect(
      screen.getByRole("spinbutton", { name: /minimum tide height/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /maximum tide height/i })
    ).toBeInTheDocument();
  });

  it("names wind speed and swell period inputs", () => {
    const conditions = {
      wind_speed_max_kt: 10,
      swell_period_min: 12,
    } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(
      screen.getByRole("spinbutton", { name: /maximum wind speed/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /minimum swell period/i })
    ).toBeInTheDocument();
  });

  it("exposes each condition row as a group named by its visible label", () => {
    const conditions = { swell_height_min: 2 } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(screen.getByRole("group", { name: "Swell Size" })).toBeInTheDocument();
  });

  it("announces an inverted range as text, not colour alone", () => {
    const conditions = {
      swell_height_min: 6,
      swell_height_max: 2,
    } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    const max = screen.getByRole("spinbutton", {
      name: /maximum swell size/i,
    });
    expect(max).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Max must be higher than min."
    );
    expect(max).toHaveAccessibleDescription("Max must be higher than min.");
  });

  it("scopes the range error to the row that owns it", () => {
    // Every row receives the same `conditions` object; an inverted swell range
    // must not print an error on Wind Speed, which has no range.
    const conditions = {
      swell_height_min: 6,
      swell_height_max: 2,
      wind_speed_max_kt: 5,
    } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);

    const windSpeedRow = screen.getByRole("group", { name: "Wind Speed" });
    expect(windSpeedRow).not.toHaveTextContent("Max must be higher than min.");

    const swellRow = screen.getByRole("group", { name: "Swell Size" });
    expect(swellRow).toHaveTextContent("Max must be higher than min.");
  });

  it("has no error state for a valid range", () => {
    const conditions = {
      swell_height_min: 2,
      swell_height_max: 6,
    } as AlertConditions;

    render(<ConditionBuilder conditions={conditions} onChange={noop} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
