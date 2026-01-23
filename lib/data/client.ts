/**
 * Centralized client-side data gateway (additive stub)
 *
 * Client-safe functions should use HTTP routes under app/api/* to avoid importing server actions into client components.
 * This file intentionally exposes a minimal surface to start: beaches.getAll().
 *
 * Server-side variants with full access to server actions live in lib/data/server.ts.
 */

import { fetchWithAuthRetry } from "@/lib/fetch-with-auth-retry";

export type ClientBeach = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Other columns exist; we keep this minimal to avoid tight coupling.
};

type __CacheEntry<T> = { value: T; expiresAt: number };
const __CACHE_TTL_MS = 30_000;
const __cache = {
  usersProfile: new Map<string, __CacheEntry<any>>(),
  usersSessions: new Map<string, __CacheEntry<any[]>>(), // key: `${userId}:${limit}`
  boards: new Map<string, __CacheEntry<any[]>>(), // key: "me"
  sessionLikesStatus: new Map<string, __CacheEntry<{ liked: boolean; likesCount: number }>>(),
  dailyIntel: new Map<string, __CacheEntry<ClientBeachDailyIntel | null>>(), // key: `${beachId}:${forecastDate}`
  inflight: new Map<string, Promise<any>>(),
};

function __now() {
  return Date.now();
}

function __getCached<T>(map: Map<string, __CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= __now()) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function __setCached<T>(map: Map<string, __CacheEntry<T>>, key: string, value: T) {
  map.set(key, { value, expiresAt: __now() + __CACHE_TTL_MS });
}

async function getAllBeaches(): Promise<ClientBeach[]> {
  const response = await fetchWithAuthRetry("/api/beaches", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to load beaches: ${response.status}`);
  }

  // API routes generally wrap payload in { success, data }, but some older ones return { beaches }.
  const json = (await response.json()) as any;
  const beaches =
    (Array.isArray(json?.beaches) ? json.beaches : null) ??
    (Array.isArray(json?.data?.beaches) ? json.data.beaches : null) ??
    [];
  return beaches;
}

export type ClientBeachDailyIntel = {
  beach_id: string;
  forecast_date: string;
  generation_time: string;
  generated_at: string;

  best_window_start: string | null;
  best_window_end: string | null;
  best_window_description: string | null;

  surf_min_ft: number | null;
  surf_max_ft: number | null;
  surf_description: string | null;

  tide_height_ft: number | null;
  tide_time: string | null;
  tide_status: string | null;
  tide_optimal_range: string | null;
  next_tide_type: string | null;
  next_tide_time: string | null;
  next_tide_height_ft: number | null;

  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  wind_direction_text: string | null;
  wind_quality: string | null;
  wind_description: string | null;

  confidence: string | null;
  recommendation: string | null;
  conditions_score: number | null;

  raw_intel_data: unknown;
};

async function getDailyIntel(
  beachId: string,
  forecastDate: string
): Promise<ClientBeachDailyIntel | null> {
  const cacheKey = `${beachId}:${forecastDate}`;
  const cached = __getCached(__cache.dailyIntel, cacheKey);
  if (cached !== null) return cached;

  const inflightKey = `dailyIntel:${cacheKey}`;
  const inflight = __cache.inflight.get(inflightKey);
  if (inflight) return inflight;

  const p = (async () => {
    const params = new URLSearchParams({ beachId, forecastDate });
    const res = await fetchWithAuthRetry(`/api/beach-daily-intel?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Failed to load daily intel: ${res.status}`);
    const json = await res.json();
    const intel = (json?.data?.intel ?? null) as ClientBeachDailyIntel | null;
    __setCached(__cache.dailyIntel, cacheKey, intel);
    return intel;
  })();

  __cache.inflight.set(inflightKey, p);
  try {
    return await p;
  } finally {
    __cache.inflight.delete(inflightKey);
  }
}

export const data = {
  beaches: {
    getAll: getAllBeaches,
  },
  intel: {
    getDaily: getDailyIntel,
  },
  boards: {
    async list() {
      const cacheKey = "me";
      const cached = __getCached(__cache.boards, cacheKey);
      if (cached) return cached;

      const inflightKey = `boards:${cacheKey}`;
      const inflight = __cache.inflight.get(inflightKey);
      if (inflight) return inflight;

      const p = (async () => {
        const res = await fetchWithAuthRetry(`/api/boards`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load boards: ${res.status}`);
        const json = await res.json();
        const boards = json.data?.boards || [];
        __setCached(__cache.boards, cacheKey, boards);
        return boards;
      })();

      __cache.inflight.set(inflightKey, p);
      try {
        return await p;
      } finally {
        __cache.inflight.delete(inflightKey);
      }
    },
  },
  sessions: {
    likes: {
      async getStatus(sessionId: string): Promise<{ liked: boolean; likesCount: number }> {
        const cached = __getCached(__cache.sessionLikesStatus, sessionId);
        if (cached) return cached;

        const inflightKey = `likesStatus:${sessionId}`;
        const inflight = __cache.inflight.get(inflightKey);
        if (inflight) return inflight;

        const p = (async () => {
          const res = await fetchWithAuthRetry(`/api/sessions/${sessionId}/likes`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`Failed to load like status: ${res.status}`);
          const json = await res.json();
          const value = { liked: !!json.data?.liked, likesCount: Number(json.data?.likesCount || 0) };
          __setCached(__cache.sessionLikesStatus, sessionId, value);
          return value;
        })();

        __cache.inflight.set(inflightKey, p);
        try {
          return await p;
        } finally {
          __cache.inflight.delete(inflightKey);
        }
      },
      async toggle(sessionId: string) {
        const res = await fetchWithAuthRetry(`/api/sessions/${sessionId}/likes/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to toggle like: ${res.status}`);
        return res.json();
      },
    },
    comments: {
      async listTopLevel(sessionId: string) {
        const res = await fetchWithAuthRetry(`/api/sessions/${sessionId}/comments`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load comments: ${res.status}`);
        const json = await res.json();
        return json.data?.comments || [];
      },
      async create(sessionId: string, content: string) {
        const res = await fetchWithAuthRetry(`/api/sessions/${sessionId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error(`Failed to create comment: ${res.status}`);
        return res.json();
      },
      async delete(sessionId: string, commentId: string) {
        const res = await fetchWithAuthRetry(`/api/sessions/${sessionId}/comments/${commentId}`, {
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
        const cached = __getCached(__cache.usersProfile, userId);
        if (cached) {
          return cached;
        }

        const inflightKey = `usersProfile:${userId}`;
        const inflight = __cache.inflight.get(inflightKey);
        if (inflight) {
          return inflight;
        }

        // Prefer new namespaced route; keep legacy as fallback via server redirect if present
        const p = (async () => {
          const res = await fetchWithAuthRetry(`/api/users/${userId}/profile`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
          const json = await res.json();
          __setCached(__cache.usersProfile, userId, json.data);
          return json.data;
        })();

        __cache.inflight.set(inflightKey, p);
        try {
          return await p;
        } finally {
          __cache.inflight.delete(inflightKey);
        }
      },
    },
    follow: {
      async getStatusAndCounts(userId: string): Promise<{ following: boolean; followersCount: number; followingCount: number }> {
        const res = await fetchWithAuthRetry(`/api/users/${userId}/follow`, {
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
        const res = await fetchWithAuthRetry(`/api/users/${userId}/follow/toggle`, {
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
        const res = await fetchWithAuthRetry(`/api/users/${userId}/comments`, {
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
        const cacheKey = `${userId}:${limit}`;
        const cached = __getCached(__cache.usersSessions, cacheKey);
        if (cached) return cached;

        const inflightKey = `usersSessions:${cacheKey}`;
        const inflight = __cache.inflight.get(inflightKey);
        if (inflight) return inflight;

        const params = new URLSearchParams();
        if (limit) params.set("limit", String(limit));
        const p = (async () => {
          const res = await fetchWithAuthRetry(`/api/users/${userId}/sessions?${params.toString()}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`Failed to load user sessions: ${res.status}`);
          const json = await res.json();
          const sessions = json.data?.sessions || [];
          __setCached(__cache.usersSessions, cacheKey, sessions);
          return sessions;
        })();

        __cache.inflight.set(inflightKey, p);
        try {
          return await p;
        } finally {
          __cache.inflight.delete(inflightKey);
        }
      },
    },
  },
  comments: {
    async delete(commentId: string) {
      const res = await fetchWithAuthRetry(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to delete comment: ${res.status}`);
      return res.json();
    },
  },
  auth: {
    async updateEmail(newEmail: string) {
      const res = await fetchWithAuthRetry(`/api/auth/email/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      if (!res.ok) throw new Error(`Failed to update email: ${res.status}`);
      return res.json();
    },
  },
};
