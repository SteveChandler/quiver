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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
  maxLength?: number;
  showCharCount?: boolean;
}

interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFormFieldProps<TFieldValues> {
  rows?: number;
  minHeight?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

interface FormNumberInputProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFormFieldProps<TFieldValues> {
  step?: string;
}

interface SelectOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

interface FormSelectProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFormFieldProps<TFieldValues> {
  options: SelectOption[];
  emptyOption?: string;
  renderOption?: (option: SelectOption) => ReactNode;
}

interface FormCheckboxProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<BaseFormFieldProps<TFieldValues>, "placeholder"> {}

interface FormSwitchProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<BaseFormFieldProps<TFieldValues>, "placeholder"> {
  icon?: LucideIcon;
  variant?: "card" | "row";
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
 *
 * With character counter:
 * <FormInput
 *   control={form.control}
 *   name="title"
 *   label="Title"
 *   maxLength={100}
 * />
 */
export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
  maxLength,
  showCharCount,
  disabled,
  className,
}: FormInputProps<TFieldValues>) {
  // Default showCharCount to true when maxLength is provided
  const shouldShowCharCount = showCharCount ?? maxLength !== undefined;

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
              maxLength={maxLength}
              value={field.value || ""}
            />
          </FormControl>
          {shouldShowCharCount && maxLength ? (
            <FormDescription>
              {field.value?.length || 0}/{maxLength} characters
            </FormDescription>
          ) : description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Reusable FormNumberInput component
 * For numeric inputs that support null values (e.g., coordinates, optional numbers)
 *
 * Usage:
 * <FormNumberInput
 *   control={form.control}
 *   name="latitude"
 *   label="Latitude"
 *   placeholder="e.g., 34.0259"
 *   step="any"
 * />
 */
export function FormNumberInput<
  TFieldValues extends FieldValues = FieldValues
>({
  control,
  name,
  label,
  description,
  placeholder,
  step = "any",
  disabled,
  className,
}: FormNumberInputProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step={step}
              placeholder={placeholder}
              disabled={disabled}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
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
 *
 * With character counter:
 * <FormTextarea
 *   control={form.control}
 *   name="description"
 *   label="Description"
 *   maxLength={500}
 *   rows={6}
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
  maxLength,
  showCharCount,
  disabled,
  className,
}: FormTextareaProps<TFieldValues>) {
  // Default showCharCount to true when maxLength is provided
  const shouldShowCharCount = showCharCount ?? maxLength !== undefined;

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
              maxLength={maxLength}
              className={minHeight ? `min-h-[${minHeight}]` : undefined}
              value={field.value || ""}
            />
          </FormControl>
          {shouldShowCharCount && maxLength ? (
            <FormDescription>
              {field.value?.length || 0}/{maxLength} characters
            </FormDescription>
          ) : description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
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
 *
 * With custom option rendering:
 * <FormSelect
 *   control={form.control}
 *   name="tag"
 *   label="Tag"
 *   options={[
 *     { value: "parking", label: "Parking", description: "Parking info" },
 *     { value: "hazard", label: "Hazard", description: "Safety warnings" }
 *   ]}
 *   renderOption={(option) => (
 *     <div>
 *       <p className="font-medium">{option.label}</p>
 *       <p className="text-xs text-muted-foreground">{option.description}</p>
 *     </div>
 *   )}
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
  renderOption,
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
                  {renderOption ? renderOption(option) : option.label}
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
 * Reusable FormCheckbox component
 * For checkbox fields with label and optional description
 *
 * Usage:
 * <FormCheckbox
 *   control={form.control}
 *   name="is_private"
 *   label="Private Beach"
 *   description="Mark this beach as private or requiring special access"
 * />
 */
export function FormCheckbox<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: FormCheckboxProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4",
            className
          )}
        >
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
        </FormItem>
      )}
    />
  );
}

/**
 * Reusable FormSwitch component
 * For toggle/switch fields with optional icon and description
 *
 * Supports two variants:
 * - "card": Bordered card with label and description (default)
 * - "row": Simple inline row with icon and label
 *
 * Usage (card variant):
 * <FormSwitch
 *   control={form.control}
 *   name="notif_reminders"
 *   label="Session Reminders"
 *   description="Receive reminders to log your surf sessions"
 * />
 *
 * Usage (row variant with icon):
 * <FormSwitch
 *   control={form.control}
 *   name="notif_push_enabled"
 *   label="Push Notifications"
 *   icon={Bell}
 *   variant="row"
 * />
 */
export function FormSwitch<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  icon: Icon,
  variant = "card",
  disabled,
  className,
}: FormSwitchProps<TFieldValues>) {
  if (variant === "row") {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem
            className={cn("flex items-center justify-between py-3", className)}
          >
            <div className="flex items-center gap-3">
              {Icon && (
                <Icon
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <FormLabel className="text-sm font-normal text-foreground cursor-pointer">
                {label}
              </FormLabel>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                className="data-[state=checked]:bg-[#0077B6] focus-visible:ring-[#0077B6]/50 hover:shadow-[0_0_0_3px_rgba(0,119,182,0.15)]"
                aria-label={label}
              />
            </FormControl>
          </FormItem>
        )}
      />
    );
  }

  // Default "card" variant
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            "flex flex-row items-center justify-between rounded-lg border p-4",
            className
          )}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {Icon && (
                <Icon
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <FormLabel className="text-base">{label}</FormLabel>
            </div>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
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
