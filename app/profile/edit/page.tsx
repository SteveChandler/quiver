import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProfile } from "@/actions/profile-actions";
import { getUserBoards } from "@/actions/board-actions";
import { getUserSessions } from "@/actions/session-actions";
import { getBeaches } from "@/actions/beach-actions";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

export default async function EditProfilePage() {
  const supabase = await createSupabaseServerClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  // Get the user's profile
  const { data: profile } = await getProfile(user.id);

  // Get the user's boards (quiver)
  const { data: boards = [] } = await getUserBoards(user.id);

  // Get the user's recent sessions (last 3)
  const { data: allSessions = [] } = await getUserSessions(user.id);
  const recentSessions = allSessions.slice(0, 3);

  // Get all beaches for default beach preference
  const { data: beaches = [] } = await getBeaches();

  return (
    <div className="container py-10">
      <ProfileEditForm
        userId={user.id}
        email={user.email || ""}
        profile={profile}
        boards={boards}
        recentSessions={recentSessions}
        beaches={beaches}
      />
    </div>
  );
}
