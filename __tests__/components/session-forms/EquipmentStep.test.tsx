import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EquipmentStep } from "@/components/session-forms/EquipmentStep";

describe("EquipmentStep", () => {
  const boards = [
    {
      id: "b1",
      name: "Fish",
      board_type: "Fish",
      dimensions: "5'6\"",
      user_id: "u1",
      created_at: "",
      updated_at: "",
    } as any,
  ];
  const formState = { boardId: "", selectedBoard: "" } as any;
  const updateField = jest.fn();

  test("selecting a board calls updateField but does not submit", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentStep
        formState={formState}
        boards={boards}
        updateField={updateField}
        onBoardsRefresh={jest.fn()}
      />
    );

    // Open select and pick the board
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    // Use role option which Radix exposes via ARIA roles in tests
    const option = await screen.findByRole("option", { name: /Fish/i });
    await user.click(option);

    expect(updateField).toHaveBeenCalledWith("selectedBoard", "b1");
    expect(updateField).toHaveBeenCalledWith("boardId", "b1");
  });
});
