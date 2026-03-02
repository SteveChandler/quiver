"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
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
import { toast } from "@/components/ui/use-toast";
import { createBoard } from "@/actions/board-actions";
import { useAuth } from "@/context/auth-context";
import type { Board } from "@/types/database";

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

interface AddBoardDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onBoardAdded?: (board?: Board) => void;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}

export function AddBoardDialog({
  open,
  onOpenChange,
  onBoardAdded,
  trigger,
  children,
}: AddBoardDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

  const handleAddBoard = async (
    data: BoardFormValues,
    event?: React.FormEvent
  ) => {
    // Prevent the form submit from bubbling up to any parent forms
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!user?.id) return;

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

      // Close dialog
      const shouldClose = open !== undefined ? false : true;
      if (shouldClose) {
        setIsOpen(false);
      }
      if (onOpenChange) {
        onOpenChange(false);
      }

      resetForm();
      router.refresh();

      // Call the callback to refresh data and pass the created board
      if (onBoardAdded) {
        onBoardAdded(result.data);
      }
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

  const handleOpenChange = (newOpen: boolean) => {
    if (open !== undefined && onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setIsOpen(newOpen);
    }

    if (!newOpen) {
      resetForm();
    }
  };

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : isOpen;

  const dialogContent = (
    <DialogContent className="bg-[#0B1426] border-[#1E2D4A] overflow-hidden">
      {/* pointer-events-none is critical — grain sits below the close (X) button injected by DialogContent */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{ backgroundImage: "url('/textures/noise.png')", backgroundRepeat: "repeat" }}
      />
      <div className="theme-retro-dark relative z-10">
        <DialogHeader>
          <DialogTitle>Add New Board</DialogTitle>
          <DialogDescription>
            Add a new surfboard to your quiver.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit((data) => handleAddBoard(data, e))(e);
            }}
            className="space-y-4"
          >
            <BoardFormFields control={form.control} disabled={isSubmitting} theme="dark" />
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  type="button"
                  onClick={resetForm}
                  className="border-[#1E2D4A] bg-transparent text-[#8B9EC2] hover:bg-[#172544]"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#FF3B8B] to-[#E0357A] text-white hover:brightness-110 border-0"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Board
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </DialogContent>
  );

  if (trigger || children) {
    return (
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {dialogContent}
    </Dialog>
  );
}
