"use client";

import { ReactNode } from "react";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BaseFormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface FormInputProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFormFieldProps<TFieldValues> {
  type?: "text" | "email" | "password" | "number" | "url" | "tel";
}

interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFormFieldProps<TFieldValues> {
  rows?: number;
  minHeight?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFormFieldProps<TFieldValues> {
  options: SelectOption[];
  emptyOption?: string;
}

/**
 * Reusable FormInput component
 * Eliminates the repetitive FormField + FormItem + FormLabel + FormControl + Input pattern
 *
 * Usage:
 * <FormInput
 *   control={form.control}
 *   name="email"
 *   label="Email"
 *   type="email"
 *   placeholder="your.email@example.com"
 * />
 */
export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
  disabled,
  className,
}: FormInputProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              value={field.value || ""}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Reusable FormTextarea component
 * Eliminates the repetitive FormField + FormItem + FormLabel + FormControl + Textarea pattern
 *
 * Usage:
 * <FormTextarea
 *   control={form.control}
 *   name="bio"
 *   label="Bio"
 *   placeholder="Tell us about yourself..."
 *   rows={4}
 * />
 */
export function FormTextarea<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  rows = 3,
  minHeight,
  disabled,
  className,
}: FormTextareaProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              className={minHeight ? `min-h-[${minHeight}]` : undefined}
              value={field.value || ""}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Reusable FormSelect component
 * Eliminates the repetitive FormField + FormItem + FormLabel + FormControl + Select pattern
 *
 * Usage:
 * <FormSelect
 *   control={form.control}
 *   name="experience"
 *   label="Experience Level"
 *   options={[
 *     { value: "beginner", label: "Beginner" },
 *     { value: "intermediate", label: "Intermediate" },
 *     { value: "advanced", label: "Advanced" }
 *   ]}
 *   emptyOption="Select experience level"
 * />
 */
export function FormSelect<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  options,
  emptyOption,
  disabled,
  className,
}: FormSelectProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder || emptyOption} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {emptyOption && <SelectItem value="">{emptyOption}</SelectItem>}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Custom FormField component for cases that need special handling
 * Still provides the standard wrapper but allows custom content
 *
 * Usage:
 * <CustomFormField
 *   control={form.control}
 *   name="avatar"
 *   label="Profile Picture"
 *   description="Upload a profile picture"
 * >
 *   {(field) => (
 *     <div className="custom-content">
 *       // Custom form content here
 *     </div>
 *   )}
 * </CustomFormField>
 */
export function CustomFormField<
  TFieldValues extends FieldValues = FieldValues
>({
  control,
  name,
  label,
  description,
  children,
  className,
}: BaseFormFieldProps<TFieldValues> & {
  children: (field: any) => ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div>{children(field)}</div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
