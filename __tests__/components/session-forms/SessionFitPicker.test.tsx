/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  SessionFitPicker,
  type SessionFitSelection,
} from "@/components/session-forms/SessionFitPicker";

describe("SessionFitPicker", () => {
  it("maps the waves chip to a versioned session_decomposition object", () => {
    const onChange = jest.fn();
    const onSelection = jest.fn();

    render(
      <SessionFitPicker
        rating="4"
        value={null}
        onChange={onChange}
        onSelection={onSelection}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Waves" }));

    expect(onChange).toHaveBeenCalledWith({ version: 1, waves: true });
    expect(onSelection).toHaveBeenCalledWith({
      kind: "decomposition",
      tag: "waves",
    } satisfies SessionFitSelection);
  });

  it("maps skill fit to the categorical contract", () => {
    const onChange = jest.fn();
    const onSelection = jest.fn();

    render(
      <SessionFitPicker
        rating="4"
        value={null}
        onChange={onChange}
        onSelection={onSelection}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Dialed" }));

    expect(onChange).toHaveBeenCalledWith({
      version: 1,
      skill_fit: "dialed",
    });
    expect(onSelection).toHaveBeenCalledWith({
      kind: "decomposition",
      tag: "skill_fit",
      value: "dialed",
    } satisfies SessionFitSelection);
  });

  it("maps board fit to the categorical contract", () => {
    const onChange = jest.fn();
    const onSelection = jest.fn();

    render(
      <SessionFitPicker
        rating="4"
        value={null}
        onChange={onChange}
        onSelection={onSelection}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Right board" }));

    expect(onChange).toHaveBeenCalledWith({
      version: 1,
      board_fit: "right",
    });
    expect(onSelection).toHaveBeenCalledWith({
      kind: "board_fit",
      value: "right",
    } satisfies SessionFitSelection);
  });

  it("returns null instead of an empty object when the last selection is cleared", () => {
    const onChange = jest.fn();

    render(
      <SessionFitPicker
        rating="4"
        value={{ version: 1, skill_fit: "dialed" }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Dialed" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("hides until a rating exists", () => {
    const { container } = render(
      <SessionFitPicker rating="" value={null} onChange={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
