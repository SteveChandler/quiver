import { NextResponse, type NextRequest } from "next/server";
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

export const POST = withAuth(
  async (_req: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const id = params.id as string;

    // Check existing vote
    const { data: existing } = await supabase
      .from("roadmap_votes")
      .select("item_id")
      .eq("item_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("roadmap_votes")
        .delete()
        .eq("item_id", id)
        .eq("user_id", user.id);
      if (error) {
        console.error("[roadmap] vote delete error:", error);
        return NextResponse.json({ error: "Could not record vote" }, { status: 500 });
      }
      return NextResponse.json({ voted: false });
    }

    const { error } = await supabase
      .from("roadmap_votes")
      .insert({ item_id: id, user_id: user.id });
    if (error) {
      // 23505 = unique_violation. Double-tap races land a duplicate insert
      // attempt; treat as idempotent "already voted".
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ voted: true });
      }
      console.error("[roadmap] vote insert error:", error);
      return NextResponse.json({ error: "Could not record vote" }, { status: 500 });
    }
    return NextResponse.json({ voted: true });
  },
);
