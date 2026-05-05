import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getUserMetadata } from "@/actions/profile-actions";
import UserProfileClient from "@/app/user/[id]/user-profile-client";

export default function PublicProfileAliasPage() {
  return <UserProfileClient />;
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;

  try {
    const result = await getUserMetadata(params.id);
    if (result.success && result.data) {
      const user = result.data;
      const userName = user.full_name || "Surfer";
      const sessionCount = user.session_count || 0;
      const location = user.location ? ` from ${user.location}` : "";

      return buildPageMetadata({
        title:
          sessionCount > 0
            ? `${userName}'s Surf Profile - ${sessionCount} Sessions${location}`
            : `${userName}'s Surf Profile${location}`,
        description:
          sessionCount > 0
            ? `Follow ${userName} on Quiver to see their ${sessionCount} surf sessions, favorite spots, and surfing journey. Connect with local surfers and join the community.`
            : `Follow ${userName} on Quiver to connect and surf together. Join the growing community of surfers tracking sessions and discovering new spots.`,
        path: `/profile/${params.id}`,
      });
    }
  } catch {
    // Fall through to generic metadata.
  }

  return buildPageMetadata({
    title: "Surfer Profile",
    description:
      "View surfer profile, sessions, and stats on Quiver - the ultimate surf community platform.",
    path: `/profile/${params.id}`,
  });
}
