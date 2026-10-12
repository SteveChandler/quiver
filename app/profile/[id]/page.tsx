import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { getUserMetadata } from "@/actions/profile-actions";
export { default } from "@/app/user/[id]/page";

interface ProfileShareMetadataInput {
  full_name: string | null;
}

export function buildProfileShareMetadata(
  profileId: string,
  user: ProfileShareMetadataInput | null,
): Metadata {
  const userName = user?.full_name || "Surfer";

  return buildPageMetadata({
    title: user ? `${userName} on Quiver` : "Surfer profile on Quiver",
    description: user
      ? `See ${userName}'s surf profile on Quiver.`
      : "See this surfer's sessions and profile on Quiver.",
    path: `/profile/${profileId}`,
    image: "/images/hero/quiver-landing-hero-social.jpg",
    imageWidth: 1200,
    imageHeight: 630,
  });
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;

  try {
    const result = await getUserMetadata(params.id);
    if (result.success && result.data) {
      return buildProfileShareMetadata(params.id, result.data);
    }
  } catch {
    // Fall through to generic metadata.
  }

  return buildProfileShareMetadata(params.id, null);
}
