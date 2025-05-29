import { ProfileView } from "@/components/profile-view";
import { BottomNavigation } from "@/components/bottom-navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  // Perform a server-side auth check to ensure the visitor is signed in
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If there is no authenticated user, redirect them to the sign-in page
  if (!user) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileView />
      <BottomNavigation />
    </div>
  );
}
