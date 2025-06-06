"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { SessionFormState } from "@/hooks/use-session-form";
import { Board } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { getClientBrowserClient } from "@/lib/supabase";

const boardFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  type: z
    .string()
    .min(2, "Type must be at least 2 characters")
    .max(50, "Type must be less than 50 characters"),
  size: z
    .string()
    .min(2, "Size must be at least 2 characters")
    .max(50, "Size must be less than 50 characters")
    .optional(),
  volume: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === "" ||
        (!isNaN(Number(val)) && Number(val) >= 0),
      {
        message: "Volume must be a positive number",
      }
    ),
  description: z
    .string()
    .max(300, "Description must be less than 300 characters")
    .optional(),
});

type BoardFormValues = z.infer<typeof boardFormSchema>;

interface EquipmentStepProps {
  formState: SessionFormState;
  boards: Board[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function EquipmentStep({
  formState,
  boards: initialBoards,
  updateField,
}: EquipmentStepProps) {
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const supabase = getClientBrowserClient();

  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardFormSchema),
    defaultValues: {
      name: "",
      type: "",
      size: "",
      volume: "",
      description: "",
    },
  });

  useEffect(() => {
    const fetchUserBoards = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      const MAX_RETRIES = 3;
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          // Small delay between retries, increasing with each retry
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, retries * 500));
            console.log(
              `Retrying board fetch, attempt ${retries + 1}/${MAX_RETRIES}`
            );
          }

          const { data, error } = await supabase
            .from("boards")
            .select("*")
            .eq("user_id", user.id);

          if (error) throw error;

          setBoards(data as Board[]);
          success = true;
        } catch (err) {
          console.error(
            `Error fetching boards (attempt ${retries + 1}/${MAX_RETRIES}):`,
            err
          );
          retries++;

          // Only set error if all retries failed
          if (retries === MAX_RETRIES) {
            setError(
              "Failed to load your boards. Please refresh the page or try again later."
            );
          }
        }
      }

      setLoading(false);
    };

    fetchUserBoards();
  }, [user, supabase]);

  const handleAddBoard = () => {
    setIsDialogOpen(true);
  };

  const handleCreateBoard = async (formData: BoardFormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries < MAX_RETRIES) {
      try {
        // Small delay between retries
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, retries * 500));
          console.log(
            `Retrying board creation, attempt ${retries + 1}/${MAX_RETRIES}`
          );
        }

        // Insert the new board
        const { data: newBoard, error } = await supabase
          .from("boards")
          .insert({
            user_id: user.id,
            name: formData.name,
            type: formData.type,
            size: formData.size,
            volume:
              formData.volume && formData.volume !== ""
                ? Number(formData.volume)
                : null,
            description: formData.description || null,
            session_count: 0,
          })
          .select()
          .single();

        if (error) throw error;

        // Add the new board to the local state
        const boardWithTypes = newBoard as unknown as Board;
        setBoards((prev) => [boardWithTypes, ...prev]);

        // Select the new board in the dropdown
        updateField("selectedBoard", boardWithTypes.id);
        updateField("boardId", boardWithTypes.id);

        toast.success("Board added successfully!");
        setIsDialogOpen(false);
        form.reset();
        return; // Success, exit the retry loop
      } catch (error) {
        console.error(
          `Error creating board (attempt ${retries + 1}/${MAX_RETRIES}):`,
          error
        );
        retries++;

        // Only show error toast if all retries failed
        if (retries === MAX_RETRIES) {
          toast.error("Failed to create board. Please try again.");
        }
      }
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500 mb-2">{error}</p>
        <Button type="button" onClick={handleAddBoard} variant="outline">
          Add Board
        </Button>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="mb-2">You don't have any boards yet</p>
        <Button type="button" onClick={handleAddBoard}>
          Add Board
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Board</DialogTitle>
              <DialogDescription>
                Add a new surfboard to your collection.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateBoard)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Board Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Favorite Board" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
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
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Board Size</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 5'10 x 19 1/4 x 2 3/8"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="volume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Board Volume</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 21.5, 23.5, etc."
                          {...field}
                        />
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
                      <FormLabel>Description (Optional)</FormLabel>
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

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Board"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={formState.selectedBoard}
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
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={handleAddBoard}
          variant="outline"
          size="icon"
          title="Add a new board"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {formState.selectedBoard && (
        <div className="text-xs text-muted-foreground">
          Selected board ID: {formState.selectedBoard}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Board</DialogTitle>
            <DialogDescription>
              Add a new surfboard to your collection.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleCreateBoard)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Favorite Board" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
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
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board Size</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 5'10 x 19 1/4 x 2 3/8"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board Volume</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 21.5, 23.5, etc." {...field} />
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
                    <FormLabel>Description (Optional)</FormLabel>
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Board"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
