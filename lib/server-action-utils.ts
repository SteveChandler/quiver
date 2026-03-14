// Note: Do not mark this utility module with "use server" to avoid build-time
// restrictions that require every export to be an async function. Individual
// server actions and returned functions include "use server" where required.

import { createSupabaseServerClient, createPublicReadClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";

// Standard server action response type
export interface ServerActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Server action wrapper with consistent error handling
export async function withServerAction<T>(
  action: () => Promise<T>
): Promise<ServerActionResponse<T>> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error) {
    console.error("Server action error:", error);
    // Improve error handling to provide more context
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object" && "message" in error) {
      message = String(error.message);
    } else {
      // For tests expecting this exact generic message
      message = "Unknown error occurred";
      console.error("Unhandled error type:", typeof error, error);
    }
    return {
      success: false,
      error: message,
    };
  }
}

// Authenticated server action wrapper
export async function withAuthenticatedAction<T>(
  action: (
    user: User,
    supabase: SupabaseServerClient
  ) => Promise<T>
): Promise<ServerActionResponse<T>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(`Authentication error: ${error.message}`);
    }

    if (!user) {
      throw new Error("User not authenticated");
    }

    return action(user, supabase);
  });
}

// New: Curried version that returns a callable authenticated action.
// Enables: export const doThing = makeAuthenticatedAction(async (user, supabase, arg1, arg2) => { ... })
// Then call: await doThing(arg1, arg2)
//
// IMPORTANT: Files using this must have "use server" at the top level.
// Do NOT add "use server" inside the returned function - it conflicts with file-level directive.
export function makeAuthenticatedAction<
  TArgs extends any[],
  T
>(
  action: (
    user: User,
    supabase: SupabaseServerClient,
    ...args: TArgs
  ) => Promise<T>
) {
  const serverAction = async (
    ...args: TArgs
  ): Promise<ServerActionResponse<T>> => {
    // Note: "use server" is NOT here - the calling file must have it at file level
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw new Error(`Authentication error: ${error.message}`);
      }
      if (!user) {
        throw new Error("User not authenticated");
      }

      const data = await action(user, supabase, ...args);
      return { success: true, data };
    } catch (error: unknown) {
      console.error("Server action error:", error);
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        message = String((error as { message: unknown }).message);
      } else {
        message = "Unknown error occurred";
        console.error("Unhandled error type:", typeof error, error);
      }
      return {
        success: false,
        error: message,
      };
    }
  };

  return serverAction;
}

/**
 * Validation wrapper for server actions
 *
 * Validates input against a Zod schema before calling the action.
 */
export function withValidation<TInput, TOutput>(
  schema: z.ZodType<TInput>,
  action: (input: TInput) => Promise<TOutput>
): (input: unknown) => Promise<ServerActionResponse<TOutput>> {
  return async (input: unknown) => {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((e) => e.message).join(", ");
      return {
        success: false,
        error: `Validation failed: ${errors}`,
      };
    }

    return withServerAction(() => action(parsed.data));
  };
}

/**
 * Options for createServerAction
 */
export interface CreateServerActionOptions<TInput, TOutput> {
  /** Zod schema for input validation */
  schema?: z.ZodType<TInput>;
  /** Require authentication */
  auth?: boolean;
  /** Action handler */
  handler: (context: {
    input: TInput;
    user: User | null;
    supabase: SupabaseServerClient;
  }) => Promise<TOutput>;
}

/**
 * Create a server action with configurable auth and validation
 *
 * Combines validation, authentication, and error handling in one wrapper.
 */
export function createServerAction<TInput, TOutput>(
  options: CreateServerActionOptions<TInput, TOutput>
): (input: TInput) => Promise<ServerActionResponse<TOutput>> {
  const { schema, auth = false, handler } = options;

  return async (input: TInput) => {
    // Validate input if schema provided
    let validatedInput = input;
    if (schema) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((e) => e.message).join(", ");
        return {
          success: false,
          error: `Validation failed: ${errors}`,
        };
      }
      validatedInput = parsed.data;
    }

    return withServerAction(async () => {
      const supabase = await createSupabaseServerClient();

      let user: User | null = null;

      if (auth) {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (error || !authUser) {
          throw new Error("Authentication required");
        }

        user = authUser;
      }

      return handler({ input: validatedInput, user, supabase });
    });
  };
}

// Database operation with consistent error handling
export async function withDatabaseOperation<T>(
  operation: (
    supabase: SupabaseServerClient
  ) => Promise<{ data: T | null; error: any }>,
  options?: { allowNull?: boolean }
): Promise<ServerActionResponse<T>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await operation(supabase);

    if (error) {
      throw new Error(error.message || "Database operation failed");
    }

    if (!data && !options?.allowNull) {
      throw new Error("No data returned from operation");
    }

    return data as T;
  });
}

/**
 * Public (cookie-free) database operation for ISR-compatible pages.
 *
 * Unlike withDatabaseOperation, this never calls cookies() from next/headers.
 * Use this in Server Components or data-fetching functions that run under ISR
 * (i.e. with a `revalidate` export) where dynamic rendering must be avoided.
 *
 * Constraints:
 * - Queries run as the anon role and are subject to RLS policies.
 * - Do NOT use for authenticated or write operations.
 * - Errors are re-thrown (no ServerActionResponse envelope) so the caller can
 *   handle them at the page level (e.g. notFound(), redirect()).
 */
export async function withPublicDatabaseOperation<T>(
  operation: (supabase: SupabaseClient<Database>) => Promise<T>,
  errorMessage: string = "Database operation failed"
): Promise<T> {
  try {
    const supabase = createPublicReadClient();
    return await operation(supabase);
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    throw error;
  }
}

// Common database queries
export async function getUserById(userId: string) {
  return withDatabaseOperation(async (supabase) => {
    return supabase.from("profiles").select("*").eq("id", userId).single();
  });
}

export async function getUserByEmail(email: string) {
  return withDatabaseOperation(async (supabase) => {
    return supabase.from("profiles").select("*").eq("email", email).single();
  });
}

// File upload utilities
export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<ServerActionResponse<string>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return publicUrl;
  });
}

export async function deleteFile(
  bucket: string,
  path: string
): Promise<ServerActionResponse<void>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      throw new Error(`File deletion failed: ${error.message}`);
    }
  });
}
