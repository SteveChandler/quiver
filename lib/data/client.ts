/**
 * Centralized client-side data gateway (additive stub)
 *
 * Client-safe functions should use HTTP routes under app/api/* to avoid importing server actions into client components.
 * This file intentionally exposes a minimal surface to start: beaches.getAll().
 *
 * Server-side variants with full access to server actions live in lib/data/server.ts.
 */

type Beach = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Other columns exist; we keep this minimal to avoid tight coupling.
};

async function getAllBeaches(): Promise<Beach[]> {
  const response = await fetch("/api/beaches", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load beaches: ${response.status}`);
  }

  const json = (await response.json()) as { beaches?: Beach[] };
  return Array.isArray(json.beaches) ? json.beaches : [];
}

export const data = {
  beaches: {
    getAll: getAllBeaches,
  },
  sessions: {
    likes: {
      async getStatus(sessionId: string): Promise<{ liked: boolean; likesCount: number }> {
        const res = await fetch(`/api/sessions/${sessionId}/likes`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load like status: ${res.status}`);
        const json = await res.json();
        return { liked: !!json.data?.liked, likesCount: Number(json.data?.likesCount || 0) };
      },
      async toggle(sessionId: string) {
        const res = await fetch(`/api/sessions/${sessionId}/likes/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to toggle like: ${res.status}`);
        return res.json();
      },
    },
    comments: {
      async listTopLevel(sessionId: string) {
        const res = await fetch(`/api/sessions/${sessionId}/comments`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load comments: ${res.status}`);
        const json = await res.json();
        return json.data?.comments || [];
      },
      async create(sessionId: string, content: string) {
        const res = await fetch(`/api/sessions/${sessionId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error(`Failed to create comment: ${res.status}`);
        return res.json();
      },
      async delete(sessionId: string, commentId: string) {
        const res = await fetch(`/api/sessions/${sessionId}/comments/${commentId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to delete comment: ${res.status}`);
        return res.json();
      },
    },
  },
  users: {
    profile: {
      async get(userId: string) {
        // Prefer new namespaced route; keep legacy as fallback via server redirect if present
        const res = await fetch(`/api/users/${userId}/profile`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
        const json = await res.json();
        return json.data;
      },
    },
    follow: {
      async getStatusAndCounts(userId: string): Promise<{ following: boolean; followersCount: number; followingCount: number }> {
        const res = await fetch(`/api/users/${userId}/follow`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load follow status: ${res.status}`);
        const json = await res.json();
        return {
          following: !!json.data?.following,
          followersCount: Number(json.data?.followersCount || 0),
          followingCount: Number(json.data?.followingCount || 0),
        };
      },
      async toggle(userId: string) {
        const res = await fetch(`/api/users/${userId}/follow/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to toggle follow: ${res.status}`);
        const json = await res.json();

        // API routes wrap server action responses in { success, data }, so
        // surface the inner server action payload for callers.
        if (json && typeof json === "object" && "data" in json) {
          return json.data;
        }

        return json;
      },
    },
    comments: {
      async listByUser(userId: string) {
        const res = await fetch(`/api/users/${userId}/comments`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load user comments: ${res.status}`);
        const json = await res.json();
        return json.data?.comments || [];
      },
    },
    sessions: {
      async list(userId: string, limit = 5) {
        const params = new URLSearchParams();
        if (limit) params.set("limit", String(limit));
        const res = await fetch(`/api/users/${userId}/sessions?${params.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load user sessions: ${res.status}`);
        const json = await res.json();
        return json.data?.sessions || [];
      },
    },
  },
  comments: {
    async delete(commentId: string) {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to delete comment: ${res.status}`);
      return res.json();
    },
  },
  auth: {
    async updateEmail(newEmail: string) {
      const res = await fetch(`/api/auth/email/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      if (!res.ok) throw new Error(`Failed to update email: ${res.status}`);
      return res.json();
    },
  },
};
