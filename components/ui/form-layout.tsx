"use client";

import { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";

interface CardFormLayoutProps {
  title: string;
  description?: string;
  form: UseFormReturn<any>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

/**
 * Standardized Card Form Layout component
 * Eliminates the repetitive Card + CardHeader + CardTitle + CardDescription + Form + CardContent pattern
 *
 * Usage:
 * <CardFormLayout
 *   title="Edit Profile"
 *   description="Update your personal information"
 *   form={form}
 *   onSubmit={handleSubmit}
 * >
 *   <FormField ... />
 *   <FormField ... />
 * </CardFormLayout>
 */
export function CardFormLayout({
  title,
  description,
  form,
  onSubmit,
  children,
  className,
  headerActions,
}: CardFormLayoutProps) {
  return (
    <Card className={className}>
      <CardHeader
        className={
          headerActions
            ? "flex flex-row items-center justify-between"
            : undefined
        }
      >
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {headerActions && headerActions}
      </CardHeader>
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-6">{children}</CardContent>
        </form>
      </Form>
    </Card>
  );
}

/**
 * Simple Card Layout without form wrapper
 * For cases where you need custom form handling
 */
export function SimpleCardLayout({
  title,
  description,
  children,
  className,
  headerActions,
}: Omit<CardFormLayoutProps, "form" | "onSubmit">) {
  return (
    <Card className={className}>
      <CardHeader
        className={
          headerActions
            ? "flex flex-row items-center justify-between"
            : undefined
        }
      >
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {headerActions && headerActions}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}
