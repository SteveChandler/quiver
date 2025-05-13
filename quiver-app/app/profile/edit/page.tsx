import { EditProfileForm } from "@/components/edit-profile-form"
import { getProfile } from "@/actions/profile-actions"
import { createServerClient } from "@/lib/supabase"
import { redirect } from "next/navigation"

export default async function EditProfilePage() {
  const supabase = createServerClient()

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/sign-in")
  }

  // Get the user's profile
  const { data: profile } = await getProfile(user.id)

  return (
    <div className="container max-w-2xl py-10">
      <EditProfileForm
        initialData={{
          full_name: profile?.full_name || "",
          bio: profile?.bio || "",
          location: profile?.location || "",
          experience_level: profile?.experience_level || "",
          favorite_spot: profile?.favorite_spot || "",
          instagram: profile?.instagram || "",
          avatar_url: profile?.avatar_url || "",
        }}
      />
    </div>
  )
}
