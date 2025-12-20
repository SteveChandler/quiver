"use client";

import { Control, FieldValues, Path } from "react-hook-form";
import { FormInput, FormTextarea } from "@/components/ui/form-fields";

/**
 * Shape of board form values - matches the boardFormSchema used in boards-manager and add-board-dialog
 */
export interface BoardFormFieldValues {
  name: string;
  board_type: string;
  dimensions: string;
  description?: string;
  image_url?: string;
}

interface BoardFormFieldsProps<
  TFieldValues extends FieldValues = BoardFormFieldValues
> {
  /** React Hook Form control object */
  control: Control<TFieldValues>;
  /** Whether the fields are disabled (e.g., during submission) */
  disabled?: boolean;
  /** Whether to show placeholders in the inputs (useful for edit forms where values exist) */
  showPlaceholders?: boolean;
}

/**
 * Reusable board form fields component
 * Eliminates duplication between boards-manager.tsx (Add + Edit dialogs) and add-board-dialog.tsx
 *
 * Usage:
 * <BoardFormFields control={form.control} disabled={isSubmitting} />
 */
export function BoardFormFields<
  TFieldValues extends FieldValues = BoardFormFieldValues
>({
  control,
  disabled = false,
  showPlaceholders = true,
}: BoardFormFieldsProps<TFieldValues>) {
  return (
    <>
      <FormInput
        control={control}
        name={"name" as Path<TFieldValues>}
        label="Board Name"
        placeholder={showPlaceholders ? "My Favorite Shortboard" : undefined}
        disabled={disabled}
      />
      <FormInput
        control={control}
        name={"board_type" as Path<TFieldValues>}
        label="Board Type"
        placeholder={
          showPlaceholders ? "Shortboard, Longboard, Fish, etc." : undefined
        }
        disabled={disabled}
      />
      <FormInput
        control={control}
        name={"dimensions" as Path<TFieldValues>}
        label="Dimensions"
        placeholder={showPlaceholders ? "5'10 x 19 1/4 x 2 3/8" : undefined}
        disabled={disabled}
      />
      <FormTextarea
        control={control}
        name={"description" as Path<TFieldValues>}
        label="Description"
        placeholder={
          showPlaceholders ? "Tell us about this board..." : undefined
        }
        disabled={disabled}
        rows={3}
      />
      <FormInput
        control={control}
        name={"image_url" as Path<TFieldValues>}
        label="Image URL (optional)"
        placeholder={
          showPlaceholders ? "https://example.com/my-board.jpg" : undefined
        }
        disabled={disabled}
      />
    </>
  );
}







