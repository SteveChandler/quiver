// Note: Do not mark this utility module with "use server" to avoid build-time
// restrictions that require every export to be an async function. Individual
// server actions and returned functions include "use server" where required.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
    } else if (error && typeof error === "object" && "message" in error) {
      message = String(error.message);
    } else {
      // Preserve string and primitive errors as-is to satisfy tests
      message = typeof error === "string" ? error : "Unknown error occurred";
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
    supabase: ReturnType<typeof createSupabaseServerClient>
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
export function makeAuthenticatedAction<
  TArgs extends any[],
  T
>(
  action: (
    user: User,
    supabase: ReturnType<typeof createSupabaseServerClient>,
    ...args: TArgs
  ) => Promise<T>
) {
  const serverAction = async (
    ...args: TArgs
  ): Promise<ServerActionResponse<T>> => {
    "use server";
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
    } catch (error: any) {
      console.error("Server action error:", error);
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        message = String(error.message);
      } else {
        message = "Unknown error";
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

// Database operation with consistent error handling
export async function withDatabaseOperation<T>(
  operation: (
    supabase: ReturnType<typeof createSupabaseServerClient>
  ) => Promise<{ data: T | null; error: any }>
): Promise<ServerActionResponse<T>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await operation(supabase);

    if (error) {
      throw new Error(error.message || "Database operation failed");
    }

    if (!data) {
      throw new Error("No data returned from operation");
    }

    return data;
  });
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
