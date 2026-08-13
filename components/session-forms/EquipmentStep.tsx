"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SessionFormState } from "@/hooks/use-session-form";
import { Board } from "@/types/database";
import { AddBoardDialog } from "@/components/add-board-dialog";

interface EquipmentStepProps {
  formState: SessionFormState;
  boards: Board[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  onBoardsRefresh?: () => void;
}

export function EquipmentStep({
  formState,
  boards,
  updateField,
  onBoardsRefresh,
}: EquipmentStepProps) {
  const [isAddBoardDialogOpen, setIsAddBoardDialogOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);

  const handleBoardAdded = async (newBoard?: Board) => {
    // Auto-select the newly created board immediately
    if (newBoard) {
      updateField("selectedBoard", newBoard.id);
      updateField("boardId", newBoard.id);
    }

    setIsAddBoardDialogOpen(false);

    // Refresh boards list after everything else is done
    if (onBoardsRefresh) {
      try {
        await onBoardsRefresh();

        // Ensure the board stays selected after refresh
        if (newBoard) {
          updateField("selectedBoard", newBoard.id);
          updateField("boardId", newBoard.id);
        }
      } catch (error) {
        console.error("Error refreshing boards:", error);
      }
    }
  };

  const handleAddNewBoard = () => {
    // Close the select dropdown first
    setSelectOpen(false);
    // Then open the dialog
    setTimeout(() => {
      setIsAddBoardDialogOpen(true);
    }, 100);
  };

  return (
    <div className="space-y-4">
      {boards.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t added any boards yet
          </p>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setIsAddBoardDialogOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Add Your First Board
          </Button>
        </div>
      ) : (
        <>
          <Select
            value={formState.boardId || formState.selectedBoard}
            onValueChange={(value) => {
              if (value === "add-new-board") {
                handleAddNewBoard();
                return;
              }
              updateField("selectedBoard", value);
              updateField("boardId", value);
            }}
            open={selectOpen}
            onOpenChange={setSelectOpen}
          >
            <SelectTrigger aria-label="Board used">
              <SelectValue placeholder="Select a board" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={board.id}>
                  {board.name}
                  {board.board_type && ` - ${board.board_type}`}
                  {board.dimensions && ` (${board.dimensions})`}
                </SelectItem>
              ))}
              <div className="border-t px-2 py-2">
                <SelectItem value="add-new-board">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add New Board
                  </div>
                </SelectItem>
              </div>
            </SelectContent>
          </Select>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setIsAddBoardDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Add New Board
            </Button>
          </div>
        </>
      )}

      {/* AddBoardDialog is now outside the Select component */}
      <AddBoardDialog
        open={isAddBoardDialogOpen}
        onOpenChange={setIsAddBoardDialogOpen}
        onBoardAdded={handleBoardAdded}
      />
    </div>
  );
}
