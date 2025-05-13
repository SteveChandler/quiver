import { createServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { getProfile } from "@/actions/profile-actions";
import { getUserBoards } from "@/actions/board-actions";
import { getUserSessions } from "@/actions/session-actions";
import { getAllBeaches } from "@/actions/beach-actions";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

export default async function EditProfilePage() {
  const supabase = createServerClient();

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
  const { data: beaches = [] } = await getAllBeaches();

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
