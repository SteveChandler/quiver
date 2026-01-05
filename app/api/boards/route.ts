import type { NextRequest } from "next/server";
import type { Board } from "@/types/database";
import { revalidatePath } from "next/cache";
import {
  withAuth,
  createSuccessResponse,
  methodNotAllowed,
  validateOrError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { BoardCreateSchema } from "@/lib/validation/schemas";

/**
 * GET /api/boards - List user's boards
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Defensive: older data may contain empty/whitespace-only required strings.
    // The API contract treats these as invalid, so filter them out on read.
    const boards = ((data || []) as Board[])
      .map((b) => ({
        ...b,
        name: typeof b.name === "string" ? b.name.trim() : b.name,
        board_type: typeof (b as any).board_type === "string" ? (b as any).board_type.trim() : (b as any).board_type,
        dimensions: typeof (b as any).dimensions === "string" ? (b as any).dimensions.trim() : (b as any).dimensions,
      }))
      .filter(
        (b) =>
          typeof b.name === "string" &&
          b.name.length > 0 &&
          typeof (b as any).board_type === "string" &&
          (b as any).board_type.length > 0 &&
          typeof (b as any).dimensions === "string" &&
          (b as any).dimensions.length > 0
      );

    return createSuccessResponse({ boards });
  },
  { errorMessage: "Error loading boards" }
);

/**
 * POST /api/boards - Create a new board
 */
export const POST = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    // Validate Content-Type and parse JSON
    const parseResult = await parseAndValidateJson(request);
    if ("error" in parseResult) {
      return parseResult.error;
    }

    // Validate and normalize request payload
    const validationResult = validateOrError(BoardCreateSchema, parseResult.data);
    if ("error" in validationResult) {
      return validationResult.error;
    }

    const { name, board_type, dimensions, description, image_url, size, volume } =
      validationResult.data;

    // Prepare the data to insert
    const insertData = {
      user_id: user.id,
      name,
      board_type,
      dimensions,
      description,
      image_url,
      size,
      volume,
      session_count: 0,
    };

    const { data, error } = await supabase
      .from("boards")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Revalidate the profile page
    revalidatePath("/profile");

    return createSuccessResponse(data as Board, 201);
  },
  { errorMessage: "Error creating board" }
);

export function PUT() {
  return methodNotAllowed(["GET", "POST"]);
}

export function PATCH() {
  return methodNotAllowed(["GET", "POST"]);
}

export function DELETE() {
  return methodNotAllowed(["GET", "POST"]);
}
