"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  onBoardAdded?: () => void;
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

  const handleAddBoard = async (data: BoardFormValues) => {
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      const result = await createBoard({
        ...data,
        image_url: data.image_url || undefined,
        description: data.description || undefined,
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

      // Call the callback to refresh data
      if (onBoardAdded) {
        onBoardAdded();
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
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Board Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Favorite Shortboard" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="board_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Board Type</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Shortboard, Longboard, Fish, etc."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dimensions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dimensions</FormLabel>
                <FormControl>
                  <Input placeholder="5'10 x 19 1/4 x 2 3/8" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us about this board..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Image URL (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/my-board.jpg"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
