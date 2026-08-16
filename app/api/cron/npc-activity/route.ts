/**
 * NPC Activity Cron Job
 *
 * Runs hourly (5am-8pm PT) to generate authentic-looking intel posts from NPCs.
 * Each NPC has personality-specific posting windows and activity levels.
 *
 * Schedule: 0 5-20 * * * (hourly from 5am-8pm PT)
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from '@/lib/middleware/api-wrappers';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseServiceClient } from '@/types/supabase';
import {
  fetchEligibleNPCs,
  selectNPCsForCurrentHour,
  getBeachesForNPC,
} from '@/lib/npc/npc-selection';
import {
  fetchSurfConditions,
  buildTemplateVariables,
  hydrateTemplate,
  fetchRandomTemplate,
} from '@/lib/npc/template-hydration';
import type { Database } from '@/types/database';
import { withObservedCron } from '@/lib/cron/observability';
import { withCronOutcome } from '@/lib/cron/outcome';
import { isPersonaPostingEnabled } from '@/lib/npc/system-card-config';

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum posts to create per cron run (to avoid rate limiting)
const MAX_POSTS_PER_RUN = 10;

/**
 * Generate jittered timestamps with burst grouping for natural post distribution.
 * Posts are grouped into bursts of 2-3, spread across ~50 minutes of the hour.
 */
function generateJitteredTimestamps(count: number, baseTime: Date): Date[] {
  if (count === 0) return [];
  if (count === 1) {
    // Single post: random offset 5-50 min into the hour
    const offset = 5 + Math.floor(Math.random() * 45);
    return [new Date(baseTime.getTime() + offset * 60 * 1000)];
  }

  // Group into bursts of 2-3
  const bursts: number[][] = [];
  let remaining = count;
  while (remaining > 0) {
    const burstSize = remaining >= 4 ? (Math.random() < 0.5 ? 2 : 3) : remaining;
    bursts.push(Array(burstSize).fill(0));
    remaining -= burstSize;
  }

  // Space bursts across 50 minutes (5-55 min mark)
  const burstAnchors = bursts.map((_, i) =>
    5 + Math.floor((i + Math.random()) * (50 / bursts.length))
  );

  // Assign timestamps within each burst (2-8 min apart)
  const timestamps: Date[] = [];
  bursts.forEach((burst, burstIdx) => {
    let offset = burstAnchors[burstIdx];
    burst.forEach(() => {
      timestamps.push(new Date(baseTime.getTime() + offset * 60 * 1000));
      offset += 2 + Math.floor(Math.random() * 6); // 2-8 min gap
    });
  });

  return timestamps;
}

// Content type weights for post selection
const CONTENT_TYPE_WEIGHTS = {
  intel: 0.7, // 70% intel posts (conditions, crowd, parking, etc.)
  session_note: 0.2, // 20% session notes
  review: 0.1, // 10% reviews (less frequent)
};

interface PostResult {
  npcId: string;
  npcName: string;
  beachId: string;
  beachName: string;
  contentType: 'intel' | 'session_note' | 'review';
  success: boolean;
  error?: string;
}

/**
 * GET /api/cron/npc-activity
 *
 * Generates NPC posts based on personality posting windows and activity levels.
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse('Unauthorized', 'Invalid cron authentication', 401);
    }

    if (!isPersonaPostingEnabled()) {
      return createSuccessResponse(
        await withCronOutcome(
          {
            job: '/api/cron/npc-activity',
            unit: 'posts_published',
            expectedMin: 1,
            getProduced: (value) => value.summary.successful,
            legitimatelyZero: () => ({ reason: 'NPC_PERSONA_POSTING_ENABLED is not true' }),
          },
          async () => ({
            summary: {
              paused: true,
              reason: 'NPC_PERSONA_POSTING_ENABLED is not true',
              successful: 0,
              failed: 0,
            },
            results: [],
          }),
        ),
      );
    }

    const startMs = Date.now();
    const supabase = await createSupabaseServiceRoleClient();

    // Get current time info for Pacific timezone
    const now = new Date();
    const ptOffset = -8; // PST (TODO: handle PDT)
    const ptHour = (now.getUTCHours() + 24 + ptOffset) % 24;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    console.log(`[npc-activity] Starting run at PT hour ${ptHour}, weekend: ${isWeekend}`);

    // Fetch all eligible NPCs
    const allNpcs = await fetchEligibleNPCs(supabase);
    console.log(`[npc-activity] Found ${allNpcs.length} eligible NPCs`);

    // Select NPCs that should post this hour
    const selectedNpcs = selectNPCsForCurrentHour(allNpcs, ptHour, isWeekend);
    console.log(`[npc-activity] Selected ${selectedNpcs.length} NPCs to post this hour`);

    // Limit posts per run
    const npcsToProcess = selectedNpcs.slice(0, MAX_POSTS_PER_RUN);
    const results: PostResult[] = [];

    // Generate staggered timestamps for natural post distribution
    const postTimestamps = generateJitteredTimestamps(npcsToProcess.length, now);

    for (let i = 0; i < npcsToProcess.length; i++) {
      const npc = npcsToProcess[i];
      const postTime = postTimestamps[i];
      try {
        // Get a weighted beach selection for this NPC
        const beach = await getBeachesForNPC(supabase, npc);
        if (!beach) {
          console.warn(`[npc-activity] No beaches found for NPC ${npc.full_name}`);
          continue;
        }

        // Determine content type based on weights
        const contentType = selectContentType();

        // Try to create the post with staggered timestamp
        const result = await createNpcPost(
          supabase,
          npc,
          beach,
          contentType,
          postTime
        );

        results.push({
          npcId: npc.id,
          npcName: npc.full_name,
          beachId: beach.id,
          beachName: beach.name,
          contentType,
          ...result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[npc-activity] Error processing NPC ${npc.full_name}:`, message);
        results.push({
          npcId: npc.id,
          npcName: npc.full_name,
          beachId: '',
          beachName: '',
          contentType: 'intel',
          success: false,
          error: message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    console.log(`[npc-activity] Completed: ${successful} posts created, ${failed} failed`);

    return createSuccessResponse(
      await withCronOutcome(
        {
          job: '/api/cron/npc-activity',
          unit: 'posts_published',
          expectedMin: 1,
          getProduced: (value) => value.summary.successful,
          legitimatelyZero: (value) =>
            value.summary.selectedNpcs === 0
              ? { reason: 'No NPCs were scheduled to post during this hour' }
              : undefined,
        },
        async () => ({
          summary: {
            ptHour,
            isWeekend,
            totalNpcs: allNpcs.length,
            selectedNpcs: selectedNpcs.length,
            processed: results.length,
            successful,
            failed,
            durationMs: Date.now() - startMs,
          },
          results,
        }),
      ),
    );
  } catch (error) {
    return handleApiError(error, 'Failed to run NPC activity cron');
  }
}

export const GET = withObservedCron('/api/cron/npc-activity', _GET);

/**
 * Select content type based on weighted probability
 */
function selectContentType(): 'intel' | 'session_note' | 'review' {
  const roll = Math.random();
  if (roll < CONTENT_TYPE_WEIGHTS.intel) return 'intel';
  if (roll < CONTENT_TYPE_WEIGHTS.intel + CONTENT_TYPE_WEIGHTS.session_note) return 'session_note';
  return 'review';
}

/**
 * Create an NPC post of the specified type
 */
async function createNpcPost(
  supabase: SupabaseServiceClient,
  npc: { id: string; full_name: string; personality_type: string },
  beach: { id: string; name: string; lat: number | null; lon: number | null },
  contentType: 'intel' | 'session_note' | 'review',
  timestamp: Date
): Promise<{ success: boolean; error?: string }> {
  // Fetch a random template for this content type and personality
  const templateData = await fetchRandomTemplate(
    supabase,
    contentType,
    npc.personality_type
  );

  if (!templateData) {
    // Fall back to a simple hardcoded template if none in database
    return createFallbackPost(supabase, npc, beach, contentType, timestamp);
  }

  // Fetch current surf conditions for the beach
  const conditions = await fetchSurfConditions(supabase, beach.id);

  // Build template variables
  const variables = buildTemplateVariables(
    beach.name,
    conditions,
    npc.personality_type,
    timestamp
  );

  // Hydrate the template
  const content = hydrateTemplate(templateData.template, variables);

  // Create the post based on content type
  if (contentType === 'intel') {
    return createIntelPost(supabase, npc.id, beach, content, timestamp);
  } else if (contentType === 'review') {
    return createReview(supabase, npc.id, beach, content, timestamp);
  } else {
    // session_note - create as intel with 'conditions' tag
    return createIntelPost(supabase, npc.id, beach, content, timestamp, 'conditions');
  }
}

/**
 * Create an intel post
 */
async function createIntelPost(
  supabase: any,
  userId: string,
  beach: { id: string; name: string; lat: number | null; lon: number | null },
  content: string,
  timestamp: Date,
  tag: 'conditions' | 'parking' | 'crowd' | 'access' | 'hazard' | 'other' = 'conditions'
): Promise<{ success: boolean; error?: string }> {
  // Parse content for title (first line or first sentence)
  const lines = content.split('\n').filter((l) => l.trim());
  const title = lines[0]?.slice(0, 100) || `${beach.name} update`;
  const description = lines.slice(1).join(' ').trim() || content;

  const { error } = await supabase.from('intel_posts').insert({
    user_id: userId,
    beach_id: beach.id,
    latitude: beach.lat || 33.0,
    longitude: beach.lon || -117.0,
    tag,
    title: title.slice(0, 100),
    description: description.slice(0, 1000),
    is_active: true,
    expires_at: new Date(timestamp.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    created_at: timestamp.toISOString(),
  });

  if (error) {
    console.error(`[npc-activity] Failed to create intel post:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Create a beach review
 */
async function createReview(
  supabase: any,
  userId: string,
  beach: { id: string; name: string },
  content: string,
  timestamp: Date
): Promise<{ success: boolean; error?: string }> {
  // Generate realistic ratings
  const baseRating = 3 + Math.floor(Math.random() * 2); // 3-4 base
  const variance = () => Math.max(1, Math.min(5, baseRating + Math.floor(Math.random() * 3) - 1));

  const title = content.slice(0, 100).split('\n')[0] || `Review of ${beach.name}`;

  const { error } = await supabase.from('beach_reviews').insert({
    user_id: userId,
    beach_id: beach.id,
    overall_rating: variance(),
    wave_quality_rating: variance(),
    crowd_density_rating: variance(),
    parking_rating: variance(),
    accessibility_rating: variance(),
    title: title.slice(0, 255),
    content: content.slice(0, 2000),
    visit_date: timestamp.toISOString().split('T')[0],
    created_at: timestamp.toISOString(),
  });

  if (error) {
    console.error(`[npc-activity] Failed to create review:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Create a fallback post when no template is available
 */
async function createFallbackPost(
  supabase: any,
  npc: { id: string; personality_type: string },
  beach: { id: string; name: string; lat: number | null; lon: number | null },
  contentType: 'intel' | 'session_note' | 'review',
  timestamp: Date
): Promise<{ success: boolean; error?: string }> {
  // Simple fallback content based on personality
  const fallbackContent: Record<string, string> = {
    local: `Checked ${beach.name} this morning. Conditions looking typical for the season.`,
    rookie: `First time at ${beach.name} today! Stoked to be out here learning.`,
    traveler: `Stopped by ${beach.name} on my trip. Different vibe than back home.`,
    photographer: `Beautiful light at ${beach.name} this session. Captured some good frames.`,
    tactical: `${beach.name} recon complete. Conditions within parameters.`,
    competitor: `Training session at ${beach.name}. Solid reps today.`,
  };

  const content = fallbackContent[npc.personality_type] || `Update from ${beach.name}.`;

  if (contentType === 'review') {
    return createReview(supabase, npc.id, beach, content, timestamp);
  }

  return createIntelPost(supabase, npc.id, beach, content, timestamp);
}
