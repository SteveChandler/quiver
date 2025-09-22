import { FALLBACK_POSTS } from "@/lib/constants/mock-data";

export interface Post {
  id: string;
  name: string;
  activity: string;
  imageUrl: string;
  avatar: string;
}

interface ApiPost {
  id: string;
  author?: {
    name?: string;
    avatar?: string;
  };
  caption?: string;
  imageUrl?: string;
}

export function transformApiPosts(apiPosts: ApiPost[]): Post[] {
  return apiPosts.map((post) => ({
    id: post.id,
    name: post.author?.name || "Surfer",
    activity: post.caption || "Surf session",
    imageUrl: post.imageUrl || "/placeholder.jpg",
    avatar: post.author?.avatar || "/placeholder-user.jpg",
  }));
}

export async function fetchRecentPosts(): Promise<Post[]> {
  try {
    const response = await fetch("/api/recent-posts");
    const data = await response.json();

    const transformedPosts = transformApiPosts(data.posts || []);

    // Return fallback data if no posts from API
    return transformedPosts.length > 0 ? transformedPosts : FALLBACK_POSTS;
  } catch (error) {
    console.error("Error fetching posts:", error);
    return FALLBACK_POSTS;
  }
}
