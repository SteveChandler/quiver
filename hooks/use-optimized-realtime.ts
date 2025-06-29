"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Consolidated update types
interface RealtimeUpdate {
  type: "session_like" | "user_follow" | "comment" | "session_update";
  entityId: string;
  payload: any;
  timestamp: number;
}

interface OptimizedRealtimeOptions {
  enableLikes?: boolean;
  enableFollows?: boolean;
  enableComments?: boolean;
  enableSessions?: boolean;
  batchDelay?: number; // ms to batch updates
  maxSubscriptions?: number;
}

interface RealtimeSubscription {
  sessionIds: Set<string>;
  userIds: Set<string>;
  callbacks: Map<string, (update: RealtimeUpdate) => void>;
}

// Global subscription manager to prevent duplicate channels
class RealtimeSubscriptionManager {
  private static instance: RealtimeSubscriptionManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private updateQueue: RealtimeUpdate[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private supabase = createClient();

  static getInstance(): RealtimeSubscriptionManager {
    if (!RealtimeSubscriptionManager.instance) {
      RealtimeSubscriptionManager.instance = new RealtimeSubscriptionManager();
    }
    return RealtimeSubscriptionManager.instance;
  }

  subscribe(
    type: "session_likes" | "user_follows" | "comments" | "session_updates",
    entityIds: string[],
    callback: (update: RealtimeUpdate) => void,
    options: OptimizedRealtimeOptions = {}
  ): () => void {
    const subscriptionKey = `${type}_subscription`;

    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, {
        sessionIds: new Set(),
        userIds: new Set(),
        callbacks: new Map(),
      });
    }

    const subscription = this.subscriptions.get(subscriptionKey)!;
    const callbackKey = `${type}_${entityIds.join("_")}_${Date.now()}`;

    // Add callback
    subscription.callbacks.set(callbackKey, callback);

    // Add entity IDs to tracking
    entityIds.forEach((id) => {
      if (type.includes("session")) {
        subscription.sessionIds.add(id);
      } else if (type.includes("user")) {
        subscription.userIds.add(id);
      }
    });

    // Create or update channel
    this.createOrUpdateChannel(type, options);

    // Return cleanup function
    return () => {
      subscription.callbacks.delete(callbackKey);

      // Remove entity IDs if no other callbacks need them
      const hasOtherCallbacks = Array.from(subscription.callbacks.keys()).some(
        (key) => key.includes(entityIds.join("_"))
      );

      if (!hasOtherCallbacks) {
        entityIds.forEach((id) => {
          subscription.sessionIds.delete(id);
          subscription.userIds.delete(id);
        });
      }

      // Clean up channel if no subscriptions remain
      if (subscription.callbacks.size === 0) {
        this.cleanupChannel(subscriptionKey);
      }
    };
  }

  private createOrUpdateChannel(
    type: string,
    options: OptimizedRealtimeOptions
  ): void {
    const channelName = `optimized_${type}`;

    if (this.channels.has(channelName)) {
      return; // Channel already exists
    }

    const channel = this.supabase.channel(channelName);

    // Configure channel based on type
    switch (type) {
      case "session_likes":
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_likes",
          },
          (payload) =>
            this.handleUpdate(
              {
                type: "session_like",
                entityId: payload.new?.session_id || payload.old?.session_id,
                payload,
                timestamp: Date.now(),
              },
              options.batchDelay
            )
        );
        break;

      case "user_follows":
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_follows",
          },
          (payload) =>
            this.handleUpdate(
              {
                type: "user_follow",
                entityId:
                  payload.new?.following_id || payload.old?.following_id,
                payload,
                timestamp: Date.now(),
              },
              options.batchDelay
            )
        );
        break;

      case "comments":
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comments",
          },
          (payload) =>
            this.handleUpdate(
              {
                type: "comment",
                entityId: payload.new?.session_id || payload.old?.session_id,
                payload,
                timestamp: Date.now(),
              },
              options.batchDelay
            )
        );
        break;

      case "session_updates":
        channel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sessions",
          },
          (payload) =>
            this.handleUpdate(
              {
                type: "session_update",
                entityId: payload.new?.id || payload.old?.id,
                payload,
                timestamp: Date.now(),
              },
              options.batchDelay
            )
        );
        break;
    }

    channel.subscribe();
    this.channels.set(channelName, channel);
  }

  private handleUpdate(update: RealtimeUpdate, batchDelay = 1000): void {
    this.updateQueue.push(update);

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Batch updates to reduce UI thrashing
    this.batchTimeout = setTimeout(() => {
      this.processBatchedUpdates();
    }, batchDelay);
  }

  private processBatchedUpdates(): void {
    const updates = [...this.updateQueue];
    this.updateQueue = [];

    // Group updates by type and entity
    const groupedUpdates = updates.reduce((acc, update) => {
      const key = `${update.type}_${update.entityId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(update);
      return acc;
    }, {} as Record<string, RealtimeUpdate[]>);

    // Process each group
    Object.entries(groupedUpdates).forEach(([key, updateGroup]) => {
      const [type] = key.split("_");
      const subscriptionKey = `${type}s_subscription`; // Convert to plural
      const subscription = this.subscriptions.get(subscriptionKey);

      if (subscription) {
        // Send latest update to all relevant callbacks
        const latestUpdate = updateGroup[updateGroup.length - 1];

        subscription.callbacks.forEach((callback, callbackKey) => {
          // Check if this callback is interested in this entity
          const shouldNotify =
            (latestUpdate.type.includes("session") &&
              subscription.sessionIds.has(latestUpdate.entityId)) ||
            (latestUpdate.type.includes("user") &&
              subscription.userIds.has(latestUpdate.entityId));

          if (shouldNotify) {
            try {
              callback(latestUpdate);
            } catch (error) {
              console.error("Realtime callback error:", error);
            }
          }
        });
      }
    });
  }

  private cleanupChannel(subscriptionKey: string): void {
    const channelName = `optimized_${subscriptionKey.replace(
      "_subscription",
      ""
    )}`;
    const channel = this.channels.get(channelName);

    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }

    this.subscriptions.delete(subscriptionKey);
  }

  // Cleanup all channels (useful for component unmount)
  cleanup(): void {
    this.channels.forEach((channel) => {
      this.supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.subscriptions.clear();

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}

// Hook for session likes with optimized realtime
export function useOptimizedSessionLikes(
  sessionIds: string[],
  initialCounts: Record<string, number> = {}
) {
  const { user } = useAuth();
  const [likes, setLikes] = useState<
    Record<string, { count: number; liked: boolean }>
  >(() =>
    Object.fromEntries(
      sessionIds.map((id) => [
        id,
        { count: initialCounts[id] || 0, liked: false },
      ])
    )
  );
  const manager = useRef(RealtimeSubscriptionManager.getInstance());

  useEffect(() => {
    if (!sessionIds.length) return;

    const cleanup = manager.current.subscribe(
      "session_likes",
      sessionIds,
      (update) => {
        const { entityId, payload } = update;

        setLikes((prev) => {
          const current = prev[entityId] || { count: 0, liked: false };

          if (payload.eventType === "INSERT") {
            return {
              ...prev,
              [entityId]: {
                count: current.count + 1,
                liked: user?.id === payload.new.user_id ? true : current.liked,
              },
            };
          } else if (payload.eventType === "DELETE") {
            return {
              ...prev,
              [entityId]: {
                count: Math.max(0, current.count - 1),
                liked: user?.id === payload.old.user_id ? false : current.liked,
              },
            };
          }

          return prev;
        });
      },
      { batchDelay: 500 } // Faster updates for likes
    );

    return cleanup;
  }, [sessionIds, user?.id]);

  return likes;
}

// Hook for user follows with optimized realtime
export function useOptimizedUserFollows(
  userIds: string[],
  initialCounts: Record<string, { followers: number; following: number }> = {}
) {
  const { user } = useAuth();
  const [follows, setFollows] = useState<
    Record<
      string,
      {
        followers: number;
        following: number;
        isFollowing: boolean;
      }
    >
  >(() =>
    Object.fromEntries(
      userIds.map((id) => [
        id,
        {
          followers: initialCounts[id]?.followers || 0,
          following: initialCounts[id]?.following || 0,
          isFollowing: false,
        },
      ])
    )
  );
  const manager = useRef(RealtimeSubscriptionManager.getInstance());

  useEffect(() => {
    if (!userIds.length) return;

    const cleanup = manager.current.subscribe(
      "user_follows",
      userIds,
      (update) => {
        const { entityId, payload } = update;

        setFollows((prev) => {
          const current = prev[entityId] || {
            followers: 0,
            following: 0,
            isFollowing: false,
          };

          if (payload.eventType === "INSERT") {
            return {
              ...prev,
              [entityId]: {
                ...current,
                followers: current.followers + 1,
                isFollowing:
                  user?.id === payload.new.follower_id
                    ? true
                    : current.isFollowing,
              },
            };
          } else if (payload.eventType === "DELETE") {
            return {
              ...prev,
              [entityId]: {
                ...current,
                followers: Math.max(0, current.followers - 1),
                isFollowing:
                  user?.id === payload.old.follower_id
                    ? false
                    : current.isFollowing,
              },
            };
          }

          return prev;
        });
      },
      { batchDelay: 1000 } // Slower batching for follows
    );

    return cleanup;
  }, [userIds, user?.id]);

  return follows;
}

// Hook for comment counts with optimized realtime
export function useOptimizedCommentCounts(
  sessionIds: string[],
  initialCounts: Record<string, number> = {}
) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(sessionIds.map((id) => [id, initialCounts[id] || 0]))
  );
  const manager = useRef(RealtimeSubscriptionManager.getInstance());

  useEffect(() => {
    if (!sessionIds.length) return;

    const cleanup = manager.current.subscribe(
      "comments",
      sessionIds,
      (update) => {
        const { entityId, payload } = update;

        setCounts((prev) => {
          const current = prev[entityId] || 0;

          if (payload.eventType === "INSERT") {
            return { ...prev, [entityId]: current + 1 };
          } else if (payload.eventType === "DELETE") {
            return { ...prev, [entityId]: Math.max(0, current - 1) };
          }

          return prev;
        });
      },
      { batchDelay: 2000 } // Slower batching for comments
    );

    return cleanup;
  }, [sessionIds]);

  return counts;
}

// Cleanup hook for app-wide cleanup
export function useRealtimeCleanup() {
  const manager = useRef(RealtimeSubscriptionManager.getInstance());

  useEffect(() => {
    return () => {
      manager.current.cleanup();
    };
  }, []);
}
