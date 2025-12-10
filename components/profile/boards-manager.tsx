"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { BoardFormFields } from "@/components/profile/shared/board-form-fields";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { ZeroState } from "@/components/ui/zero-state";
import { createBoard, updateBoard, deleteBoard } from "@/actions/board-actions";
import type { Board } from "@/types/database";
import { useAuth } from "@/context/auth-context";

const boardFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  board_type: z
    .string()
    .min(2, "Type must be at least 2 characters")
    .max(50, "Type must be less than 50 characters"),
  dimensions: z
    .string()
    .min(2, "Dimensions must be at least 2 characters")
    .max(50, "Dimensions must be less than 50 characters"),
  description: z
    .string()
    .max(300, "Description must be less than 300 characters")
    .optional(),
  image_url: z.string().optional(),
});

type BoardFormValues = z.infer<typeof boardFormSchema>;

interface BoardsManagerProps {
  userId: string;
  boards: Board[];
}

export function BoardsManager({ userId, boards }: BoardsManagerProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);

  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardFormSchema),
    defaultValues: {
      name: "",
      board_type: "",
      dimensions: "",
      description: "",
      image_url: "",
    },
  });

  const resetForm = () => {
    form.reset({
      name: "",
      board_type: "",
      dimensions: "",
      description: "",
      image_url: "",
    });
  };

  const handleAddBoard = async (data: BoardFormValues) => {
    if (!isAuthenticated || !user?.id) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add boards.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createBoard({
        ...data,
        image_url: data.image_url || null,
        description: data.description || null,
        size: null,
        volume: null,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to create board");
      }

      toast({
        title: "Board added",
        description: "Your new board has been added to your quiver.",
      });

      setIsAddDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      console.error("Error adding board:", error);
      toast({
        title: "Error",
        description: "Failed to add board. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBoard = async (data: BoardFormValues) => {
    if (!isAuthenticated || !user?.id || !selectedBoard) {
      toast({
        title: "Authentication required",
        description: "Please sign in to edit boards.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateBoard(selectedBoard.id, {
        ...data,
        image_url: data.image_url || null,
        description: data.description || null,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update board");
      }

      toast({
        title: "Board updated",
        description: "Your board has been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setSelectedBoard(null);
      router.refresh();
    } catch (error) {
      console.error("Error updating board:", error);
      toast({
        title: "Error",
        description: "Failed to update board. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!isAuthenticated || !user?.id || !selectedBoard) {
      toast({
        title: "Authentication required",
        description: "Please sign in to delete boards.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await deleteBoard(selectedBoard.id);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete board");
      }

      toast({
        title: "Board deleted",
        description: "Your board has been removed from your quiver.",
      });

      setIsDeleteDialogOpen(false);
      setSelectedBoard(null);
      router.refresh();
    } catch (error) {
      console.error("Error deleting board:", error);
      toast({
        title: "Error",
        description: "Failed to delete board. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (board: Board) => {
    setSelectedBoard(board);
    form.reset({
      name: board.name,
      board_type: board.board_type,
      dimensions: board.dimensions,
      description: board.description || "",
      image_url: board.image_url || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (board: Board) => {
    setSelectedBoard(board);
    setIsDeleteDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>My Quiver</CardTitle>
          <CardDescription>Manage your surfboards collection</CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Board
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Board</DialogTitle>
              <DialogDescription>
                Add a new surfboard to your quiver.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleAddBoard)}
                className="space-y-4"
              >
                <BoardFormFields
                  control={form.control}
                  disabled={isSubmitting}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button" onClick={resetForm}>
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add Board
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {boards.length === 0 ? (
          <ZeroState
            icon={Layers}
            title="No Boards in Your Quiver"
            description="Track which boards work best in different conditions"
            action={{
              label: "Add Your First Board",
              onClick: () => setIsAddDialogOpen(true),
              icon: Plus,
            }}
          />
        ) : (
          <div className="space-y-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{board.name}</h4>
                  <div className="text-sm text-muted-foreground">
                    {board.board_type} • {board.dimensions}
                  </div>
                  {board.session_count != null && board.session_count > 0 && (
                    <div className="text-xs mt-1 text-muted-foreground">
                      Used in {board.session_count}{" "}
                      {board.session_count === 1 ? "session" : "sessions"}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(board)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(board)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Board Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Board</DialogTitle>
            <DialogDescription>
              Update the details of your board.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleEditBoard)}
              className="space-y-4"
            >
              <BoardFormFields
                control={form.control}
                disabled={isSubmitting}
                showPlaceholders={false}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Board Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Board</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selectedBoard?.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteBoard}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
