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

  // Debug: Log boards data
  console.log("EquipmentStep - boards:", boards);
  console.log("EquipmentStep - formState.boardId:", formState.boardId);
  console.log(
    "EquipmentStep - formState.selectedBoard:",
    formState.selectedBoard
  );

  const handleBoardAdded = () => {
    if (onBoardsRefresh) {
      onBoardsRefresh();
    }
    setIsAddBoardDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {boards.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground mb-4">
            You haven't added any boards yet
          </p>
          <AddBoardDialog
            open={isAddBoardDialogOpen}
            onOpenChange={setIsAddBoardDialogOpen}
            onBoardAdded={handleBoardAdded}
            trigger={
              <Button type="button" variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Board
              </Button>
            }
          />
        </div>
      ) : (
        <Select
          value={formState.boardId || formState.selectedBoard}
          onValueChange={(value) => {
            updateField("selectedBoard", value);
            updateField("boardId", value);
          }}
        >
          <SelectTrigger>
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
              <AddBoardDialog
                open={isAddBoardDialogOpen}
                onOpenChange={setIsAddBoardDialogOpen}
                onBoardAdded={handleBoardAdded}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Board
                  </Button>
                }
              />
            </div>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
