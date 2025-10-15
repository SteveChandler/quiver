/**
 * Realtime Subscription Monitoring Utility
 * 
 * Provides utilities to track and monitor active Supabase Realtime subscriptions
 * to help identify memory leaks and duplicate subscriptions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChannelInfo {
  channelName: string;
  state: string;
  topic: string;
  presenceState: any;
}

/**
 * Get all active Realtime channels from a Supabase client
 */
export function getActiveChannels(supabase: SupabaseClient): ChannelInfo[] {
  const channels: any[] = (supabase as any).getChannels?.() || [];
  
  return channels.map((channel) => ({
    channelName: channel.topic || "unknown",
    state: channel.state || "unknown",
    topic: channel.topic || "unknown",
    presenceState: channel.presenceState || {},
  }));
}

/**
 * Log all active Realtime subscriptions for debugging
 */
export function logActiveSubscriptions(supabase: SupabaseClient): void {
  const channels = getActiveChannels(supabase);
  
  console.group("🔌 Active Realtime Subscriptions");
  console.log(`Total channels: ${channels.length}`);
  
  if (channels.length === 0) {
    console.log("No active channels");
  } else {
    channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.channelName} (${channel.state})`);
    });
  }
  
  console.groupEnd();
}

/**
 * Detect potential duplicate channel subscriptions
 * Returns array of channel names that appear more than once
 */
export function detectDuplicateSubscriptions(
  supabase: SupabaseClient
): string[] {
  const channels = getActiveChannels(supabase);
  const channelCounts = new Map<string, number>();
  
  channels.forEach((channel) => {
    const count = channelCounts.get(channel.channelName) || 0;
    channelCounts.set(channel.channelName, count + 1);
  });
  
  const duplicates: string[] = [];
  channelCounts.forEach((count, name) => {
    if (count > 1) {
      duplicates.push(`${name} (${count}x)`);
    }
  });
  
  return duplicates;
}

/**
 * Monitor Realtime subscriptions and warn about potential issues
 */
export function monitorRealtimeHealth(supabase: SupabaseClient): {
  totalChannels: number;
  duplicates: string[];
  warnings: string[];
} {
  const channels = getActiveChannels(supabase);
  const duplicates = detectDuplicateSubscriptions(supabase);
  const warnings: string[] = [];
  
  // Warn if too many channels
  if (channels.length > 20) {
    warnings.push(
      `High channel count (${channels.length}). Consider consolidating subscriptions.`
    );
  }
  
  // Warn about duplicates
  if (duplicates.length > 0) {
    warnings.push(
      `Found ${duplicates.length} duplicate channel(s): ${duplicates.join(", ")}`
    );
  }
  
  // Warn about channels in error state
  const errorChannels = channels.filter((ch) => ch.state === "errored");
  if (errorChannels.length > 0) {
    warnings.push(
      `${errorChannels.length} channel(s) in error state: ${errorChannels.map((ch) => ch.channelName).join(", ")}`
    );
  }
  
  return {
    totalChannels: channels.length,
    duplicates,
    warnings,
  };
}

/**
 * Development-only: Set up periodic monitoring of Realtime health
 * Call this once during app initialization in development
 */
export function setupRealtimeMonitoring(
  supabase: SupabaseClient,
  intervalMs: number = 30000 // 30 seconds
): () => void {
  if (process.env.NODE_ENV !== "development") {
    return () => {}; // No-op in production
  }
  
  console.log("🔍 Realtime monitoring enabled (development only)");
  
  const intervalId = setInterval(() => {
    const health = monitorRealtimeHealth(supabase);
    
    if (health.warnings.length > 0) {
      console.warn("⚠️ Realtime Health Warnings:");
      health.warnings.forEach((warning) => {
        console.warn(`  - ${warning}`);
      });
    }
    
    if (health.totalChannels > 0) {
      console.log(`📊 Realtime Stats: ${health.totalChannels} active channels`);
    }
  }, intervalMs);
  
  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log("🔍 Realtime monitoring disabled");
  };
}

