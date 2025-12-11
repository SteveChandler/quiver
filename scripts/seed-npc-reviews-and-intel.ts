#!/usr/bin/env node

/**
 * NPC Reviews and Intel Seeding Script
 * 
 * Seeds realistic beach reviews and intel posts from mock users (NPCs) to create
 * a lively, authentic-feeling community experience in Quiver.
 * 
 * Usage:
 *   npm run seed:npc-content:dev    # Development seeding
 *   npm run seed:npc-content:prod   # Production seeding
 * 
 * Environment Variables Required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *   - CONFIRM_TARGET: Either "DEV" or "PROD" to confirm environment
 *   - RATING_COLS: 5 comma-separated rating column names for beach reviews
 *   
 * Optional:
 *   - CONFIRM_PROD: Required "YES" for production runs
 *   - RESEED: Set to "1" to clear existing NPC content first
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import {
  createIntelDedupeHash,
  DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
} from '../lib/utils/intel-dedupe';

// Load environment variables
config();

interface MockUser {
  id: string;
  full_name: string;
  personality: 'rookie' | 'local' | 'traveler' | 'photographer' | 'tactical' | 'competitor';
}

interface Beach {
  id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
  description?: string;
  skill_level?: string;
  location?: string;
}

interface SurfConditions {
  wave_height_ft: number;
  wave_period_sec: number;
  wind_speed_kts: number;
  wind_direction: string;
  tide_height_ft: number;
  water_temp_f: number;
  visibility: string;
  crowd_level: number;
}

// NPC writing style patterns by personality type
const WRITING_STYLES = {
  rookie: {
    style: 'enthusiastic and grateful',
    phrases: [
      'OMG!', 'So stoked!', 'Amazing!', 'Can\'t believe it!', 'Best day ever!',
      'This is incredible!', 'Mind blown!', 'Still buzzing!', 'What a rush!',
      'Totally rad!', 'Beyond excited!', 'This is the dream!'
    ],
    typical_posts: ['First time experiences', 'Learning progress', 'Gratitude to community']
  },
  local: {
    style: 'knowledgeable and helpful',
    phrases: [
      'Heads up', 'Pro tip', 'Been coming here for years', 'Just a FYI',
      'Fair warning', 'Quick update', 'For those wondering', 'Local knowledge',
      'Real talk', 'From experience', 'Worth mentioning', 'Friendly reminder'
    ],
    typical_posts: ['Condition updates', 'Crowd reports', 'Local knowledge']
  },
  traveler: {
    style: 'comparative and adventurous',
    phrases: [
      'Reminds me of', 'Different from', 'Never seen anything like', 'Worth the trip',
      'Similar to', 'Compares well to', 'Unique compared to', 'Unlike anywhere else',
      'First time experiencing', 'Not what I expected', 'Pleasantly surprised'
    ],
    typical_posts: ['Beach comparisons', 'Travel insights', 'New discoveries']
  },
  photographer: {
    style: 'aesthetic and technical',
    phrases: [
      'Perfect lighting', 'Great composition', 'Amazing colors', 'Photo worthy',
      'Beautiful framing', 'Stunning visuals', 'Epic backdrop', 'Golden hour magic',
      'Picture perfect', 'Incredible scenery', 'Visual paradise'
    ],
    typical_posts: ['Visual conditions', 'Light quality', 'Action shots']
  },
  tactical: {
    style: 'military precision and analysis',
    phrases: [
      'Tactical assessment', 'Mission parameters', 'Strategic advantage', 'Optimal conditions',
      'Field report', 'Reconnaissance complete', 'Operational status', 'Threat assessment',
      'Strategic position', 'Mission critical', 'Tactical superiority'
    ],
    typical_posts: ['Detailed analysis', 'Strategic updates', 'Precision reports']
  },
  competitor: {
    style: 'performance focused and intense',
    phrases: [
      'Training session', 'Performance analysis', 'Competitive advantage', 'Next level',
      'Pushing limits', 'Peak performance', 'Competition ready', 'Maximum effort',
      'Elite conditions', 'Championship form', 'Performance metrics'
    ],
    typical_posts: ['Training conditions', 'Performance metrics', 'Competitive intel']
  }
};

// Beach-specific content templates
const BEACH_CHARACTERISTICS = {
  beginner: {
    review_themes: ['safe learning environment', 'gentle waves', 'forgiving conditions', 'perfect for progression'],
    intel_themes: ['parking for beginners', 'calm conditions', 'surf school activity', 'safety updates']
  },
  intermediate: {
    review_themes: ['consistent waves', 'good for practice', 'varied conditions', 'skill development'],
    intel_themes: ['condition changes', 'crowd dynamics', 'equipment recommendations', 'technique spots']
  },
  advanced: {
    review_themes: ['challenging conditions', 'powerful waves', 'expert territory', 'serious surf'],
    intel_themes: ['hazard warnings', 'swell direction', 'expert-only conditions', 'big wave updates']
  },
  popular: {
    review_themes: ['busy but fun', 'great atmosphere', 'social scene', 'iconic spot'],
    intel_themes: ['crowd management', 'parking challenges', 'best times to avoid crowds', 'social updates']
  }
};

// Rating column names (will be validated from env)
let RATING_COLUMNS: string[] = [];

// Initialize Supabase client
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CONFIRM_TARGET', 'RATING_COLS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const target = process.env.CONFIRM_TARGET;
  if (target !== 'DEV' && target !== 'PROD') {
    throw new Error('CONFIRM_TARGET must be either "DEV" or "PROD"');
  }

  if (target === 'PROD' && process.env.CONFIRM_PROD !== 'YES') {
    throw new Error('Production seeding requires CONFIRM_PROD=YES');
  }

  // Validate and parse rating columns
  const ratingCols = process.env.RATING_COLS!.split(',').map(col => col.trim());
  if (ratingCols.length !== 5) {
    throw new Error('RATING_COLS must contain exactly 5 comma-separated column names');
  }
  RATING_COLUMNS = ratingCols;

  console.log(`Environment validated for ${target} seeding`);
  console.log(`Rating columns: ${RATING_COLUMNS.join(', ')}`);
  if (process.env.RESEED === '1') {
    console.log('RESEED enabled - will clear existing NPC content first');
  }
}

async function fetchMockUsers(supabase: any): Promise<MockUser[]> {
  console.log('Fetching mock users...');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_mock', true);

  if (error) {
    throw new Error(`Failed to fetch mock users: ${error.message}`);
  }

  if (!profiles || profiles.length === 0) {
    throw new Error('No mock users found. Please create mock users first with is_mock=true');
  }

  // Assign personalities based on names (simple heuristic)
  const users = profiles.map((profile: any) => ({
    id: profile.id,
    full_name: profile.full_name,
    personality: inferPersonality(profile.full_name)
  }));

  console.log(`Found ${users.length} mock users`);
  return users;
}

function inferPersonality(fullName: string): MockUser['personality'] {
  const name = fullName.toLowerCase();
  
  if (name.includes('rookie') || name.includes('riley')) return 'rookie';
  if (name.includes('local') || name.includes('larry')) return 'local';
  if (name.includes('travel') || name.includes('tina')) return 'traveler';
  if (name.includes('photo') || name.includes('paul')) return 'photographer';
  if (name.includes('snake') || name.includes('boss')) return 'tactical';
  if (name.includes('pro') || name.includes('competitive')) return 'competitor';
  
  // Default assignment based on name patterns
  const personalities: MockUser['personality'][] = ['local', 'traveler', 'photographer', 'rookie'];
  return personalities[Math.abs(fullName.length) % personalities.length];
}

async function fetchBeaches(supabase: any): Promise<Beach[]> {
  console.log('Fetching beaches...');
  
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('id, name, city, lat, lon, skill_level');

  if (error) {
    throw new Error(`Failed to fetch beaches: ${error.message}`);
  }

  if (!beaches || beaches.length === 0) {
    throw new Error('No beaches found in database');
  }

  console.log(`Found ${beaches.length} beaches`);
  return beaches;
}

async function cleanupExistingNPCContent(supabase: any, mockUserIds: string[]) {
  if (process.env.RESEED !== '1') {
    return;
  }

  console.log('Cleaning up existing NPC content...');

  // Delete existing beach reviews from NPCs
  const { error: reviewsError } = await supabase
    .from('beach_reviews')
    .delete()
    .in('user_id', mockUserIds);

  if (reviewsError) {
    throw new Error(`Failed to delete existing NPC reviews: ${reviewsError.message}`);
  }

  // Delete existing intel posts from NPCs
  const { error: intelError } = await supabase
    .from('intel_posts')
    .delete()
    .in('user_id', mockUserIds);

  if (intelError) {
    throw new Error(`Failed to delete existing NPC intel posts: ${intelError.message}`);
  }

  console.log('Cleanup completed');
}

function generateReviewContent(user: MockUser, beach: Beach): { title: string; content: string } {
  const style = WRITING_STYLES[user.personality];
  const beachType = inferBeachType(beach);
  const themes = BEACH_CHARACTERISTICS[beachType].review_themes;
  
  const titles = generateReviewTitles(user.personality, beach, beachType);
  const title = titles[Math.floor(Math.random() * titles.length)];
  
  const content = generateReviewText(user, beach, beachType, themes);
  
  return { title, content };
}

function inferBeachType(beach: Beach): keyof typeof BEACH_CHARACTERISTICS {
  const name = beach.name.toLowerCase();
  const location = (beach.location || '').toLowerCase();
  const description = (beach.description || '').toLowerCase();
  
  // Popular beaches
  if (name.includes('huntington') || name.includes('malibu') || name.includes('pipeline') || 
      name.includes('ocean beach') || location.includes('venice')) {
    return 'popular';
  }
  
  // Beginner beaches
  if (name.includes('shores') || name.includes('cowell') || description.includes('beginner') ||
      beach.skill_level === 'beginner') {
    return 'beginner';
  }
  
  // Advanced beaches
  if (name.includes('mavericks') || name.includes('pipeline') || description.includes('expert') ||
      beach.skill_level === 'expert' || beach.skill_level === 'advanced') {
    return 'advanced';
  }
  
  return 'intermediate';
}

// Detect specific beach break characteristics for contextual content
function detectBeachCharacteristics(beach: Beach): {
  breakType: 'reef' | 'beach' | 'point' | 'pier' | 'jetty' | 'mixed';
  hasParking: boolean;
  hasStairs: boolean;
  isUrban: boolean;
  isPier: boolean;
} {
  const name = beach.name.toLowerCase();
  const location = (beach.location || '').toLowerCase();
  const description = (beach.description || '').toLowerCase();
  const combined = `${name} ${location} ${description}`;
  
  // Detect break type
  let breakType: 'reef' | 'beach' | 'point' | 'pier' | 'jetty' | 'mixed' = 'beach';
  if (combined.includes('reef')) breakType = 'reef';
  else if (combined.includes('point')) breakType = 'point';
  else if (combined.includes('pier') || name.includes('pier')) breakType = 'pier';
  else if (combined.includes('jetty')) breakType = 'jetty';
  else if (combined.includes('mixed') || (combined.includes('reef') && combined.includes('sand'))) breakType = 'mixed';
  
  const hasParking = !combined.includes('no parking') && !combined.includes('limited parking');
  const hasStairs = combined.includes('stair') || combined.includes('cliff') || combined.includes('steep');
  const isUrban = location.includes('city') || name.includes('city') || 
                  location.includes('beach, ca') || location.includes('beach, california');
  const isPier = name.includes('pier') || combined.includes('pier break');
  
  return { breakType, hasParking, hasStairs, isUrban, isPier };
}

function generateReviewTitles(personality: MockUser['personality'], beach: Beach, beachType: string): string[] {
  const beachName = beach.name;
  
  switch (personality) {
    case 'rookie':
      return [
        `First time at ${beachName} - Mind blown!`,
        `${beachName} exceeded all expectations!`,
        `Finally made it to ${beachName}!`,
        `So grateful for ${beachName}`,
        `${beachName} made my week!`
      ];
    
    case 'local':
      return [
        `${beachName} conditions update`,
        `Another solid day at ${beachName}`,
        `${beachName} delivering as usual`,
        `Why I love ${beachName}`,
        `${beachName} local perspective`
      ];
    
    case 'traveler':
      return [
        `${beachName} vs other spots I've surfed`,
        `${beachName} worth the journey`,
        `Hidden gem: ${beachName}`,
        `${beachName} travel review`,
        `Why ${beachName} should be on your list`
      ];
    
    case 'photographer':
      return [
        `${beachName} photo conditions`,
        `Perfect light at ${beachName}`,
        `${beachName} visual feast`,
        `Capturing ${beachName}`,
        `${beachName} through my lens`
      ];
    
    case 'tactical':
      return [
        `${beachName} tactical assessment`,
        `Strategic analysis: ${beachName}`,
        `${beachName} mission report`,
        `Operational assessment of ${beachName}`,
        `${beachName} field report`
      ];
    
    case 'competitor':
      return [
        `${beachName} training session`,
        `Performance analysis: ${beachName}`,
        `${beachName} competitive edge`,
        `Training at ${beachName}`,
        `${beachName} performance metrics`
      ];
    
    default:
      return [`Great session at ${beachName}`];
  }
}

function generateReviewText(user: MockUser, beach: Beach, beachType: string, themes: string[]): string {
  const style = WRITING_STYLES[user.personality];
  const theme = themes[Math.floor(Math.random() * themes.length)];
  
  const templates = {
    rookie: [
      `${style.phrases[0]} Had the most amazing time at ${beach.name}! This place is ${theme} and everyone was so welcoming. Still can't believe I actually caught some waves here. The locals were super helpful and gave me great tips. Already planning my next visit!`,
      `Just had my first real session at ${beach.name} and I'm absolutely hooked! The conditions were ${theme} which was perfect for someone still learning like me. ${style.phrases[2]} The whole experience was incredible and I learned so much today.`,
      `${style.phrases[1]} about my session at ${beach.name}! This spot is definitely ${theme} and I felt safe the whole time. Met some awesome people in the water who were so encouraging. This is why I love the surf community!`
    ],
    
    local: [
      `${style.phrases[0]} everyone - ${beach.name} has been ${theme} lately. Been surfing here for over a decade and it's always reliable. Great spot for all levels and the community is solid. Water temp has been perfect and parking isn't too bad if you know where to go.`,
      `Another solid session at ${beach.name}. Conditions were ${theme} as expected this time of year. ${style.phrases[1]}: best waves are usually early morning before the wind picks up. This place never disappoints if you know what to expect.`,
      `${beach.name} delivering the goods again! Love how this spot is ${theme} but still accessible. Been watching the conditions here for years and it's consistently one of the better breaks in the area. Perfect for building confidence and skills.`
    ],
    
    traveler: [
      `Finally made it to ${beach.name} after hearing so much about it! This place is definitely ${theme} compared to my home break. ${style.phrases[3]} to experience such a unique spot. The vibe here is different from anywhere else I've surfed - really special place.`,
      `${beach.name} was a highlight of my surf trip! ${style.phrases[0]} the waves at my local spot, but in the best possible way. The whole area has such a unique character and the surfing is ${theme}. Will definitely be back on my next visit to the area.`,
      `What an incredible experience at ${beach.name}! ${style.phrases[2]} this anywhere else I've traveled. The combination of ${theme} and the local culture makes this a must-surf destination. Already recommending it to friends planning surf trips.`
    ],
    
    photographer: [
      `${style.phrases[0]} at ${beach.name} today! The waves were ${theme} and the light was absolutely stunning. Got some incredible shots of locals charging the waves. The whole scene has such a photogenic quality - from the water color to the surrounding landscape.`,
      `Spent the morning capturing ${beach.name} in action. Conditions were ${theme} which made for some beautiful compositions. ${style.phrases[2]} reflecting off the water and the wave action was perfect for photography. This spot has endless visual possibilities.`,
      `${beach.name} never fails to deliver visually! Today's session was ${theme} and I managed to capture some really dynamic shots. The natural lighting here is incredible and every angle offers something different. Perfect spot for both surfing and photography.`
    ],
    
    tactical: [
      `${style.phrases[0]} of ${beach.name} complete. Location demonstrates ${theme} under current conditions. Wave patterns analyzed and documented for future operations. Recommend this position for training exercises due to predictable conditions and strategic advantages.`,
      `Field report: ${beach.name} operations successful. Conditions assessed as ${theme} with optimal parameters for mission execution. Environmental factors favorable for sustained activity. ${style.phrases[3]} identified for future tactical deployments.`,
      `${beach.name} reconnaissance mission accomplished. Target area shows ${theme} characteristics suitable for operational requirements. Security assessment: minimal hostile elements observed. Recommend for continued tactical utilization.`
    ],
    
    competitor: [
      `Solid training session at ${beach.name} today! Conditions were ${theme} which pushed my performance to the next level. Working on my competitive edge here - the waves demand precision and power. ${style.phrases[2]} training ground for serious surfers.`,
      `${beach.name} delivered another intense training session! This spot is ${theme} and perfect for performance analysis. Every wave here teaches you something new about technique and strategy. The competitive environment really brings out your best surfing.`,
      `Performance metrics from ${beach.name} today: exceptional! The waves were ${theme} which allowed for high-level maneuvers and skill development. ${style.phrases[0]} that challenges every aspect of your surfing. Perfect preparation for competition season.`
    ]
  };

  const personalityTemplates = templates[user.personality] || templates.local;
  return personalityTemplates[Math.floor(Math.random() * personalityTemplates.length)];
}

function generateRatings(personality: MockUser['personality'], beachType: string): Record<string, number> {
  // Base ratings influenced by beach type and personality
  const baseRatings: Record<string, number> = {};
  
  // NPCs are generally positive (3-5 rating range)
  const minRating = 3;
  const maxRating = 5;
  
  // Generate ratings for each column
  RATING_COLUMNS.forEach(column => {
    let rating = minRating + Math.floor(Math.random() * (maxRating - minRating + 1));
    
    // Personality adjustments
    if (personality === 'rookie') {
      // Rookies are more enthusiastic, tend to rate higher
      rating = Math.min(5, rating + (Math.random() < 0.6 ? 1 : 0));
    } else if (personality === 'local') {
      // Locals are more discerning but fair
      if (Math.random() < 0.3) rating = Math.max(3, rating - 1);
    } else if (personality === 'tactical') {
      // Tactical users are precise, tend toward middle ratings
      rating = 4 + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 1 : 0);
    }
    
    baseRatings[column] = rating;
  });
  
  return baseRatings;
}

function generateIntelContent(user: MockUser, beach: Beach): {
  title: string;
  description: string;
  tag: string;
  surf_conditions?: SurfConditions;
} {
  const beachType = inferBeachType(beach);
  const tags = ['conditions', 'parking', 'crowd', 'hazards', 'access'];
  const tag = tags[Math.floor(Math.random() * tags.length)];
  
  const content = generateIntelByTag(user, beach, tag, beachType);
  const surf_conditions = tag === 'conditions' ? generateSurfConditions(beachType) : undefined;
  
  return {
    ...content,
    tag,
    surf_conditions
  };
}

function generateIntelByTag(
  user: MockUser, 
  beach: Beach, 
  tag: string, 
  beachType: string
): { title: string; description: string } {
  const style = WRITING_STYLES[user.personality];
  const beachName = beach.name;
  
  switch (tag) {
    case 'conditions':
      return {
        title: generateConditionTitle(user.personality, beachName),
        description: generateConditionDescription(user, beachName, beachType)
      };
    
    case 'parking':
      return {
        title: generateParkingTitle(user.personality, beachName),
        description: generateParkingDescription(user, beachName, beachType)
      };
    
    case 'crowd':
      return {
        title: generateCrowdTitle(user.personality, beachName),
        description: generateCrowdDescription(user, beachName, beachType)
      };
    
    case 'hazards':
      return {
        title: generateHazardTitle(user.personality, beachName),
        description: generateHazardDescription(user, beachName, beachType)
      };
    
    case 'access':
      return {
        title: generateAccessTitle(user.personality, beachName),
        description: generateAccessDescription(user, beachName, beachType)
      };
    
    default:
      return {
        title: `Update from ${beachName}`,
        description: `General update from ${beachName}. Conditions and access look good!`
      };
  }
}

function generateConditionTitle(personality: string, beachName: string): string {
  switch (personality) {
    case 'rookie': return `${beachName} looking amazing!`;
    case 'local': return `${beachName} conditions update`;
    case 'traveler': return `First impressions of ${beachName}`;
    case 'photographer': return `Perfect conditions at ${beachName}`;
    case 'tactical': return `${beachName} tactical conditions report`;
    case 'competitor': return `${beachName} performance conditions`;
    default: return `Current conditions at ${beachName}`;
  }
}

function generateConditionDescription(user: MockUser, beachName: string, beachType: string): string {
  const style = WRITING_STYLES[user.personality];
  const phraseIdx = Math.floor(Math.random() * style.phrases.length);
  
  const descriptions = {
    rookie: [
      `${style.phrases[phraseIdx]} The waves at ${beachName} are perfect right now! Clean faces and super manageable size. Water feels amazing and everyone out there is so friendly. This is exactly what I dreamed surfing would be like!`,
      `Just got out of the water at ${beachName} and I'm still buzzing! Conditions are incredible - gentle waves with crystal clear water. Perfect for someone still learning like me. ${style.phrases[(phraseIdx + 1) % style.phrases.length]}`,
      `${beachName} is firing today! Okay maybe not firing like the pros say, but perfect for me. Small, clean waves with no scary currents. Even managed to catch a few on the inside. ${style.phrases[(phraseIdx + 2) % style.phrases.length]}`,
      `Had the most epic morning at ${beachName}! Conditions were so beginner-friendly with these soft rolling waves. Water was warmer than I expected too. Still can't believe I'm actually surfing now!`,
      `The ocean at ${beachName} was like a dream today! Waist-high waves with no intimidating sets. Got encouragement from so many people in the lineup. This spot is perfect for building confidence!`,
      `Incredible session at ${beachName} just now! The waves were consistent and super forgiving. Even when I fell, it felt safe. This is definitely becoming my go-to learning spot!`,
      `${beachName} delivered the perfect conditions for progression today! Got more rides than ever before and the water was so clear you could see the bottom. Feeling so grateful for this spot!`,
      `Just wrapped up an awesome session at ${beachName}! Mellow waves with glassy faces - exactly what I needed. Every local I talked to was super welcoming. Love this surf community!`
    ],
    
    local: [
      `${style.phrases[phraseIdx]} - ${beachName} has consistent 3-4ft waves with light offshore winds. Water temp is around 65-66°F. Good conditions should hold through the afternoon before the usual wind picks up. Classic setup for this time of year.`,
      `Solid session at ${beachName} this morning. Clean 2-3ft waves with glassy conditions until about 10am. ${style.phrases[(phraseIdx + 1) % style.phrases.length]}: get out early before the afternoon onshore kicks in. Water clarity is excellent right now.`,
      `${beachName} delivering reliable waves as usual. Current conditions show 3-5ft sets with 12-second intervals. Offshore breeze keeping it clean. Should be good for all skill levels through mid-morning.`,
      `${style.phrases[(phraseIdx + 2) % style.phrases.length]} for ${beachName} - swell picked up overnight to a solid shoulder-high. Wind is calm now but forecast shows increase by noon. Dawn patrol was absolutely worth it today.`,
      `Checking in from ${beachName} - conditions are textbook right now. 4ft sets on the outside, smaller reform on the inside. Light crowds and water temp holding steady at 67°F. This is why I surf here year-round.`,
      `${beachName} showing why it's a local favorite today. Waist to chest high with clean lines. Tide is mid-incoming which is the sweet spot for this break. Should be solid for another 2-3 hours.`,
      `Current report from ${beachName}: offshore breeze grooming 3-4ft waves perfectly. Period around 11 seconds giving nice push. If you're in the area, now's the time. Won't last past early afternoon.`,
      `${beachName} conditions update - overhead sets coming through on the outside peak. Water clarity is exceptional, you can see the sand bottom even in deeper sections. Classic autumn conditions here.`,
      `Another quality day at ${beachName}. Consistent chest-high waves with 10-second intervals. NW swell hitting the break at the right angle. This spot never disappoints when conditions align like this.`
    ],
    
    traveler: [
      `${beachName} conditions remind me of Indo but with colder water! Clean 4ft waves with perfect offshore winds. ${style.phrases[phraseIdx]} - this place has such a unique character. Wave quality is surprisingly good for this region.`,
      `First session at ${beachName} and the conditions are stellar! ${style.phrases[(phraseIdx + 1) % style.phrases.length]} the reefs back home, but the wave shape is incredibly consistent here. Long rides and forgiving sections - perfect for exploring a new break.`,
      `${beachName} absolutely delivering today! Conditions are different from my usual spots but in the best way. Consistent sets with beautiful blue water. ${style.phrases[(phraseIdx + 2) % style.phrases.length]} this quality at a beach break.`,
      `Scoring perfect conditions at ${beachName}! ${style.phrases[(phraseIdx + 3) % style.phrases.length]} the breaks in Portugal - similar power but with warmer vibes. This might be my favorite discovery on this California trip!`,
      `${beachName} is blowing my mind! The wave quality here rivals spots in Bali I've paid big money to surf. And the local scene is so much more welcoming than I expected. Definitely extending my stay to surf here more.`,
      `Finally made it to ${beachName} after hearing about it for years. Living up to the hype! Shoulder-high peelers with long walls. Different from the heavy barrels at my home break but super fun and rippable.`,
      `${beachName} session was everything I hoped for! Conditions are way more consistent than the beachbreaks I'm used to. The wave shape here is so predictable - makes it easy to find your rhythm even on your first visit.`,
      `Incredible surf at ${beachName} today! The setup here is unique - not like anything I've surfed in Australia or Hawaii. Fun overhead waves with workable faces. This area is definitely underrated internationally.`
    ],
    
    photographer: [
      `${style.phrases[phraseIdx]} at ${beachName} today for both surfing and shooting! Morning light is incredible, highlighting every wave perfectly. Conditions are clean with beautiful color contrast between the water and sky. ${style.phrases[(phraseIdx + 1) % style.phrases.length]} moments everywhere.`,
      `${beachName} conditions are visually stunning right now! Clean waves with amazing light penetration through the water. ${style.phrases[(phraseIdx + 2) % style.phrases.length]} reflecting off the wave faces creating incredible photo opportunities. Both the action and scenery are perfect.`,
      `Perfect storm of conditions at ${beachName}! Great waves combined with ${style.phrases[(phraseIdx + 3) % style.phrases.length]} make this a photographer's dream. Every set offers something different to capture. The natural beauty here is unmatched.`,
      `The light at ${beachName} this morning was absolutely magical! Offshore spray creating rainbows in every barrel section. Got some incredible shots and the surfing was phenomenal too. This place is a visual paradise.`,
      `${beachName} delivered epic photo conditions today! Clean waist-to-head high waves with dramatic cloud formations in the background. The golden hour light made every spray explosion look otherworldly. Both my camera and quiver got a workout!`,
      `Spent sunrise at ${beachName} capturing the action - what a show! Crystal clear water allowed for amazing underwater angles, and the wave faces were glassy perfection. Best shooting conditions I've had in months.`,
      `${beachName} looking absolutely photogenic today! Azure blue water contrasting with the white foam, plus perfectly shaped waves. Even the crowd looks good out there. This is why I always bring my camera to surf sessions here.`
    ],
    
    tactical: [
      `${style.phrases[phraseIdx]}: ${beachName} conditions optimal for aquatic operations. Wave height 3-4 feet, period 10-12 seconds, winds 5-8 knots offshore. Water temperature 65°F. ${style.phrases[(phraseIdx + 1) % style.phrases.length]} identified for extended operations.`,
      `${style.phrases[(phraseIdx + 2) % style.phrases.length]}: ${beachName} environmental conditions suitable for tactical deployment. Swell direction northwest at optimal angle. Minimal civilian interference observed. ${style.phrases[(phraseIdx + 3) % style.phrases.length]} for mission execution.`,
      `${beachName} reconnaissance complete. Current conditions show strategic advantages with consistent wave patterns. ${style.phrases[(phraseIdx + 4) % style.phrases.length]}: approach from south side for optimal positioning. Mission parameters met.`,
      `Operational assessment ${beachName}: wave height holding at 1.2 meters, period 9-11 seconds. Wind speed 6 knots from 280 degrees. Visibility excellent. Tidal conditions favorable for insertion and extraction. All systems go.`,
      `${beachName} mission status: environmental factors optimal. Swell consistency at 85%, crowd density minimal in northern sector. Water temperature 18 degrees celsius. Recommend immediate deployment while conditions remain favorable.`,
      `Field intelligence ${beachName}: wave intervals precisely timed at 10-second marks. Strategic positioning on south peak provides tactical advantage. Recommend this location for future operations. Mission accomplished successfully.`
    ],
    
    competitor: [
      `${beachName} conditions are next level today! Perfect waves for performance training - consistent sets with rippable faces. This is exactly what I need for competition prep. ${style.phrases[phraseIdx]} training ground right now.`,
      `Training session at ${beachName} exceeded expectations! Wave quality is competition-level with multiple maneuver sections. Conditions are pushing my performance to new heights. ${style.phrases[(phraseIdx + 1) % style.phrases.length]} for serious surfers.`,
      `${beachName} delivering high-performance waves! Clean conditions with powerful sections perfect for working on competition maneuvers. This spot is becoming essential to my training regimen.`,
      `Solid training day at ${beachName}! Overhead sets with critical sections - exactly what I need for contest prep. Got some serious reps in on my aerials and the wave faces were perfect for it. Performance metrics off the charts today!`,
      `${beachName} is firing for competition training! Clean shoulder-high waves with multiple hit sections per ride. Working on my power carves and the conditions are ideal. This is championship-level surf right here.`,
      `Elite conditions at ${beachName} this morning! Consistent waves with long walls perfect for linking maneuvers. Put in a solid 2-hour training session focused on turns and speed generation. This spot is becoming my secret weapon.`,
      `${beachName} delivering competition-quality waves! Fast, hollow sections with rippable shoulders. Got multiple waves over 8 on my mental scoring system. Training here is definitely elevating my performance level.`
    ]
  };

  const personalityDescriptions = descriptions[user.personality] || descriptions.local;
  return personalityDescriptions[Math.floor(Math.random() * personalityDescriptions.length)];
}

function generateParkingTitle(personality: string, beachName: string): string {
  switch (personality) {
    case 'rookie': return `Parking tips for ${beachName}`;
    case 'local': return `${beachName} parking update`;
    case 'traveler': return `Parking situation at ${beachName}`;
    case 'photographer': return `Equipment parking at ${beachName}`;
    case 'tactical': return `${beachName} staging area assessment`;
    case 'competitor': return `${beachName} logistics update`;
    default: return `Parking at ${beachName}`;
  }
}

function generateParkingDescription(user: MockUser, beachName: string, beachType: string): string {
  const style = WRITING_STYLES[user.personality];
  const phraseIdx = Math.floor(Math.random() * style.phrases.length);
  
  const parkingDescriptions = {
    rookie: [
      `Just figured out the parking situation at ${beachName}! There's a lot right by the beach but it fills up super early. Found street parking about 2 blocks away that's free. Such a relief to finally understand how this works!`,
      `Parking at ${beachName} was so confusing at first! But now I know to arrive before 8am for the main lot. There are also some side streets that locals showed me. Everyone's been so helpful with directions!`,
      `Finally mastered parking at ${beachName}! The trick is having backup spots ready. Main lot is convenient but pricey. Free street parking is totally doable with a short walk. Getting easier every time!`,
      `${style.phrases[phraseIdx]} Figured out the best parking strategy for ${beachName}! Early morning is key - after 9am it's a nightmare. But there's also free parking after 6pm if you're into sunset sessions!`,
      `Learning the parking ropes at ${beachName}! A local showed me the secret spots on the back streets. Takes a 5-minute walk but totally worth not circling for 30 minutes. So grateful for helpful people here!`,
      `Parking at ${beachName} is getting easier each time. Downloaded that parking app everyone uses and it's been a game-changer. Can check availability before I even leave home now!`
    ],
    
    local: [
      `${style.phrases[phraseIdx]} - ${beachName} main lot is full by 9am on weekends. Try the residential streets on the south side, about a 3-minute walk to the beach. Meters take cards now which is convenient. Peak season parking is always tough here.`,
      `${beachName} parking update: construction has closed off the north overflow lot temporarily. Stick to street parking on Ocean Ave or the paid structure one block inland. Should reopen next month according to city notices.`,
      `${style.phrases[(phraseIdx + 1) % style.phrases.length]} for ${beachName} parking: there's a hidden lot behind the surf shop that's usually less crowded. $5 all day vs $2/hour at the main lot. Plus they validate if you buy anything from the shop.`,
      `${beachName} parking situation: arrive before 7:30am for guaranteed spots in the main lot. After that, your best bet is the side streets off the main road. Free parking but 2-hour limit, so plan accordingly.`,
      `Parking update for ${beachName} - they just added more meters on the west side streets. Takes credit cards which is nice. About a 4-minute walk to the beach but usually available even mid-morning.`,
      `${style.phrases[(phraseIdx + 2) % style.phrases.length]}: ${beachName} has free street parking after 6pm and all day Sunday. Weekday mornings are your best bet for easy parking. Avoid weekends after 8am unless you enjoy circling.`,
      `${beachName} parking hack: there's an unpaved lot about 6 blocks south that most tourists don't know about. It's free and rarely full. Slightly longer walk but worth it to avoid the stress.`
    ],
    
    traveler: [
      `Parking at ${beachName} is way different from my home break! Had to download a parking app and everything. Street parking is free but super competitive. Reminds me of parking challenges in other surf cities I've visited.`,
      `${beachName} parking situation took some getting used to! Much more organized than the chaotic free-for-all at my local spot. The paid lots are actually pretty reasonable and save a lot of stress circling around.`,
      `Compared to other surf destinations, ${beachName} parking is pretty manageable. Street parking requires some patience but the beach access is excellent once you find a spot. Much better than some places I've surfed!`,
      `${style.phrases[phraseIdx]} parking at ${beachName} to other surf towns I've visited - way more organized! Clear signage, multiple options, and reasonable prices. Not like that nightmare in Bali or the chaos in Morocco.`,
      `The parking at ${beachName} actually impressed me! Coming from places with zero parking infrastructure, having marked lots and meters feels luxury. Yeah it costs money, but at least you know where to go.`,
      `${beachName} parking is easier than I expected for a popular surf spot. ${style.phrases[(phraseIdx + 1) % style.phrases.length]} the parking situations in Australia - similar challenges but better solutions here.`
    ]
  };

  const personalityDescriptions = parkingDescriptions[user.personality as keyof typeof parkingDescriptions] || parkingDescriptions.local;
  return personalityDescriptions[Math.floor(Math.random() * personalityDescriptions.length)];
}

function generateCrowdTitle(personality: string, beachName: string): string {
  switch (personality) {
    case 'rookie': return `${beachName} crowd vibes`;
    case 'local': return `${beachName} crowd report`;
    case 'traveler': return `${beachName} surf community`;
    case 'photographer': return `${beachName} scene update`;
    case 'tactical': return `${beachName} population density assessment`;
    case 'competitor': return `${beachName} competitive environment`;
    default: return `Crowd levels at ${beachName}`;
  }
}

function generateCrowdDescription(user: MockUser, beachName: string, beachType: string): string {
  const style = WRITING_STYLES[user.personality];
  const phraseIdx = Math.floor(Math.random() * style.phrases.length);
  
  const crowdDescriptions = {
    rookie: [
      `The crowd at ${beachName} is so welcoming! Even though it's busy, everyone's been super patient with beginners like me. Got great advice from several locals and even some encouragement when I wiped out. This community is amazing!`,
      `Was worried about the crowds at ${beachName} but everyone's so cool! Lots of different skill levels out there and the vibe is really supportive. Someone even helped me fix my leash when it broke. Love the surf community here!`,
      `${beachName} gets busy but in a good way! So many friendly faces and everyone's just stoked to be surfing. Learned a lot just watching others and got some great tips. The energy here is infectious!`,
      `${style.phrases[phraseIdx]} The lineup at ${beachName} was so friendly today! Maybe 20-25 people out but nobody was aggressive. A few experienced surfers gave me pointers on positioning. This is what surfing should be like!`,
      `Not gonna lie, I was intimidated by the crowd at ${beachName} at first. But everyone was super respectful and welcoming! Even got a few waves shared with me by locals. The community vibe here is incredible!`,
      `Surprised by how chill the crowd is at ${beachName}! Busy but not chaotic. Everyone seems to look out for each other, especially beginners. Already planning to come back tomorrow!`
    ],
    
    local: [
      `${style.phrases[phraseIdx]} - ${beachName} getting pretty crowded this week with the good conditions. About 30-40 people out at peak times. Most folks are respectful but heads up for some newer faces who might not know the lineup yet. Overall vibe is still good though.`,
      `Crowd levels at ${beachName} are typical for weekend morning - busy but manageable. Seeing a good mix of regulars and visitors. Lineup is organized and everyone's been pretty good about taking turns. Just be patient out there.`,
      `${beachName} has been attracting bigger crowds lately, probably due to the consistent surf. If you want less crowded sessions, try early morning before 7am or late afternoon after 4pm. Peak times are definitely busier than usual.`,
      `${style.phrases[(phraseIdx + 1) % style.phrases.length]}: ${beachName} was packed today. Counted at least 50+ surfers at mid-morning. Lineup etiquette breaking down a bit with all the visitors. Be extra aware and respectful out there.`,
      `${beachName} crowd report: light this morning with only 10-15 people at dawn patrol. Perfect conditions if you want space to surf. Forecast shows it picking up later so early is key.`,
      `Decent crowd at ${beachName} today but vibe was excellent. Everyone sharing waves and communicating well. This is why I love surfing here - even when busy, the community keeps it positive.`,
      `${beachName} surprisingly mellow today for a weekend. Maybe 25 people spread across multiple peaks. Good wave distribution and respectful lineup. Seems like the swell scared off some of the less experienced crew.`
    ],
    
    traveler: [
      `The surf crowd at ${beachName} has such a different vibe from my home break! Much more diverse group of surfers and everyone seems to respect each other's space. Really interesting to observe the local surf culture and etiquette here.`,
      `${beachName} crowd is way more organized than what I'm used to! Clear lineup rotation and everyone seems to know the unwritten rules. As a visitor, I'm trying to observe and respect the local dynamics. Pretty cool to see how different communities operate.`,
      `Fascinating surf community at ${beachName}! The crowd includes everyone from groms to older surfers, and there's a really positive energy in the water. Different from the competitive vibe at some of the spots I've traveled to.`,
      `${style.phrases[phraseIdx]} the crowd dynamics at ${beachName} to other international surf spots - really balanced! Not too aggressive but not totally passive either. Everyone gets waves if they're patient and respectful.`,
      `The lineup at ${beachName} is so much friendlier than I expected! Coming from some of the more localized breaks I've surfed, this place feels welcoming to visitors. Definitely earned some respect by waiting my turn though.`,
      `${beachName} crowd scene is interesting - good mix of locals and travelers like me. ${style.phrases[(phraseIdx + 1) % style.phrases.length]} the surf communities in Indo where everyone's just stoked to be there. Really positive energy!`
    ]
  };

  const personalityDescriptions = crowdDescriptions[user.personality as keyof typeof crowdDescriptions] || crowdDescriptions.local;
  return personalityDescriptions[Math.floor(Math.random() * personalityDescriptions.length)];
}

function generateHazardTitle(personality: string, beachName: string): string {
  switch (personality) {
    case 'rookie': return `Safety reminder for ${beachName}`;
    case 'local': return `${beachName} hazard update`;
    case 'traveler': return `${beachName} safety awareness`;
    case 'photographer': return `${beachName} safety for photographers`;
    case 'tactical': return `${beachName} threat assessment`;
    case 'competitor': return `${beachName} performance hazards`;
    default: return `Hazards at ${beachName}`;
  }
}

function generateHazardDescription(user: MockUser, beachName: string, beachType: string): string {
  const style = WRITING_STYLES[user.personality];
  const phraseIdx = Math.floor(Math.random() * style.phrases.length);
  
  const hazardDescriptions = {
    rookie: [
      `Learned something important about ${beachName} today - there are some rocks on the north side that are hard to see at high tide. A local pointed them out to me and probably saved me from a bad situation. Always good to ask locals about hazards!`,
      `Safety tip for other beginners at ${beachName}: the current can be stronger than it looks, especially near the jetty. Stay close to shore until you're more confident. Several experienced surfers gave me this advice and I'm grateful!`,
      `Just a heads up for fellow newbies at ${beachName} - watch out for other people's boards in the whitewater! It gets pretty chaotic inside and runaway boards are no joke. Better to be overly cautious while learning.`,
      `${style.phrases[phraseIdx]} Got some important safety advice at ${beachName} today. Apparently there's a channel with strong current that can pull you south. Locals say to paddle north to avoid it. So glad people shared this with me!`,
      `PSA for other beginners at ${beachName}: the waves can be bigger than they look from shore! I got caught inside a few times. Take it slow and watch a full set cycle before paddling out. Safety first!`,
      `Important lesson learned at ${beachName} - watch the tide! At low tide some sections get really shallow. An experienced surfer warned me before I found out the hard way. This community really looks out for newbies!`
    ],
    
    local: [
      `${style.phrases[phraseIdx]} - strong rip current on the south side of ${beachName} today. It's actually great for getting out back but be aware of less experienced surfers who might get caught. As always, use it to your advantage but keep an eye on others.`,
      `${beachName} hazard update: low tide is exposing more rocks than usual near the pier. Saw a few close calls today with people not familiar with the spot. If you don't know the bottom, stay in the deeper sections.`,
      `Reminder about ${beachName} - marine layer is super thick this morning which means low visibility. Be extra careful of other surfers and watch for boats that might not see you. Conditions should clear by mid-morning.`,
      `${style.phrases[(phraseIdx + 1) % style.phrases.length]}: ${beachName} has active rip currents today due to the big swell. They're running straight out from the main peak. Use them to get out but know how to escape laterally if needed.`,
      `Safety notice for ${beachName} - submerged reef section about 50 yards north of the main peak is extra shallow today. Several fins have met their end there. Give it wide berth at low tide.`,
      `${beachName} conditions report: current is running strong south to north today. Factor this in for your positioning. Saw a few people end up way north of where they started. Stay aware out there.`,
      `Hazard alert at ${beachName}: larger sets are closing out the inside section. Don't get caught there - the rip back out is intense. Stick to deeper water if you're not comfortable with the size.`
    ],
    
    traveler: [
      `Learning about the hazards at ${beachName} from locals - apparently there's a reef shelf that's not obvious until low tide. ${style.phrases[phraseIdx]} some of the sneaky reef breaks in Hawaii. Always worth asking about local hazards when surfing somewhere new!`,
      `${beachName} has some interesting currents I didn't expect. ${style.phrases[(phraseIdx + 1) % style.phrases.length]} my home break but way more predictable. Just need to understand the pattern and they're actually helpful for positioning.`,
      `Got educated about ${beachName} hazards today. The locals were super helpful pointing out the problem areas. Way different hazards than what I'm used to but nothing too scary if you know what to watch for.`
    ],
    
    tactical: [
      `Threat assessment ${beachName}: identified submerged obstacles at coordinates marked. Recommend approach vector from southwest to avoid hazardous terrain. Environmental conditions show increased risk factors during current tidal phase. Mission parameters adjusted accordingly.`,
      `${beachName} operational hazards catalogued: strong lateral currents detected in sector 3. Advise tactical teams to maintain enhanced situational awareness. Civilian population density may complicate extraction procedures if required.`,
      `${style.phrases[phraseIdx]}: ${beachName} shows elevated risk factors due to equipment hazards from inexperienced operators. Recommend maintaining safe operational distance and continuous threat assessment. Mission success requires adaptive tactical response.`,
      `Environmental hazard report ${beachName}: submerged rock formations identified at low tide positions. Depth readings show minimal clearance in approach zones. Recommend abort procedures if tidal phase reaches critical thresholds.`
    ]
  };

  const personalityDescriptions = hazardDescriptions[user.personality as keyof typeof hazardDescriptions] || hazardDescriptions.local;
  return personalityDescriptions[Math.floor(Math.random() * personalityDescriptions.length)];
}

function generateAccessTitle(personality: string, beachName: string): string {
  switch (personality) {
    case 'rookie': return `Getting to ${beachName}`;
    case 'local': return `${beachName} access update`;
    case 'traveler': return `${beachName} access info`;
    case 'photographer': return `${beachName} equipment access`;
    case 'tactical': return `${beachName} ingress/egress routes`;
    case 'competitor': return `${beachName} facility access`;
    default: return `Beach access at ${beachName}`;
  }
}

function generateAccessDescription(user: MockUser, beachName: string, beachType: string): string {
  const accessDescriptions = {
    rookie: [
      `Finally figured out the best way to get to ${beachName}! The main path is a bit steep but there are railings and it's totally manageable with a board. There's also a longer but easier path on the south side. Facilities are clean and convenient too!`,
      `Access to ${beachName} is way easier than I expected! Good parking, clear paths to the beach, and even outdoor showers for after your session. As a beginner, having good facilities really makes the whole experience more enjoyable.`,
      `${beachName} has excellent beach access! Wide paths, good signage, and even a board rinse station. Makes it so much easier when you're still figuring out all the gear and logistics of surfing. Really well set up for everyone.`
    ],
    
    local: [
      `${beachName} access update: the main stairway got repaired last week and is in great shape now. Much safer than it was with those loose boards. Also added some new lighting for early morning and evening sessions. City actually did a good job on this one.`,
      `Access to ${beachName} is running smoothly. All paths are clear and facilities are well-maintained. Beach cleanup crew has been doing excellent work keeping everything tidy. One of the better-maintained beach accesses in the area.`,
      `${beachName} facilities update: they upgraded the outdoor showers and added more bike racks. Also improved the lighting on the main path which is great for dawn patrol. Good to see the city investing in beach infrastructure.`
    ],
    
    tactical: [
      `${beachName} ingress routes evaluated and confirmed operational. Primary access point Alpha shows excellent strategic positioning with multiple egress options. Infrastructure assessment: facilities adequate for sustained operations. Perimeter security minimal.`,
      `Access assessment ${beachName}: multiple infiltration routes identified with varying difficulty levels. Primary staging area offers clear sight lines and rapid deployment capabilities. Recommend route Charlie for equipment-heavy operations.`,
      `${beachName} access control minimal, multiple entry/exit points available. Terrain assessment shows favorable conditions for rapid movement. Infrastructure supports extended operations with adequate resupply capabilities identified.`
    ]
  };

  const personalityDescriptions = accessDescriptions[user.personality as keyof typeof accessDescriptions] || accessDescriptions.local;
  return personalityDescriptions[Math.floor(Math.random() * personalityDescriptions.length)];
}

function generateSurfConditions(beachType: string): SurfConditions {
  const baseConditions = {
    wave_height_ft: 2 + Math.random() * 4, // 2-6 ft
    wave_period_sec: 8 + Math.random() * 6, // 8-14 sec
    wind_speed_kts: Math.random() * 15, // 0-15 kts
    wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'OFFSHORE', 'ONSHORE'][Math.floor(Math.random() * 10)],
    tide_height_ft: -1 + Math.random() * 8, // -1 to 7 ft
    water_temp_f: 60 + Math.random() * 15, // 60-75°F
    visibility: ['Poor', 'Fair', 'Good', 'Excellent'][Math.floor(Math.random() * 4)],
    crowd_level: 1 + Math.floor(Math.random() * 5) // 1-5
  };

  // Adjust based on beach type
  if (beachType === 'beginner') {
    baseConditions.wave_height_ft = Math.min(baseConditions.wave_height_ft, 4); // Max 4ft for beginners
    baseConditions.crowd_level = Math.min(baseConditions.crowd_level, 3); // Less crowded
  } else if (beachType === 'advanced') {
    baseConditions.wave_height_ft = Math.max(baseConditions.wave_height_ft, 4); // Min 4ft for advanced
  } else if (beachType === 'popular') {
    baseConditions.crowd_level = Math.max(baseConditions.crowd_level, 3); // More crowded
  }

  return baseConditions;
}

function randomDateInRange(daysBack: number): Date {
  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  const randomDays = Math.random() * daysBack;
  return new Date(now.getTime() - (randomDays * msInDay));
}

function addRandomOffset(coordinate: number, maxOffset: number = 0.001): number {
  return coordinate + (Math.random() - 0.5) * 2 * maxOffset;
}

async function seedBeachReviews(
  supabase: any, 
  mockUsers: MockUser[], 
  beaches: Beach[]
): Promise<number> {
  console.log('Seeding beach reviews...');
  
  let totalReviews = 0;
  
  for (const beach of beaches) {
    // Generate 2-4 reviews per beach from random NPCs (increased from 1-3)
    const reviewCount = 2 + Math.floor(Math.random() * 3);
    
    // Select random users for this beach (avoid duplicates)
    const selectedUsers = [...mockUsers]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(reviewCount, mockUsers.length));
    
    for (const user of selectedUsers) {
      const { title, content } = generateReviewContent(user, beach);
      const ratings = generateRatings(user.personality, inferBeachType(beach));
      const visitDate = randomDateInRange(30); // Within last month (increased from 3 weeks)
      const createdAt = randomDateInRange(30); // Within last month (increased from 3 weeks)
      
      const reviewData = {
        beach_id: beach.id,
        user_id: user.id,
        title,
        content,
        visit_date: visitDate.toISOString().split('T')[0],
        created_at: createdAt.toISOString(),
        ...ratings
      };
      
      const { error } = await supabase
        .from('beach_reviews')
        .insert(reviewData);
      
      if (error) {
        console.error(`Failed to insert review for ${beach.name} by ${user.full_name}:`, error);
      } else {
        totalReviews++;
      }
    }
  }
  
  console.log(`Created ${totalReviews} beach reviews`);
  return totalReviews;
}

async function seedIntelPosts(
  supabase: any, 
  mockUsers: MockUser[], 
  beaches: Beach[]
): Promise<number> {
  console.log('Seeding intel posts...');
  
  let totalPosts = 0;
  
  for (const beach of beaches) {
    // Generate 2-5 intel posts per beach from random NPCs (increased from 1-3)
    const postCount = 2 + Math.floor(Math.random() * 4);
    
    // Select random users for this beach
    const selectedUsers = [...mockUsers]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(postCount, mockUsers.length));
    
    for (const user of selectedUsers) {
      const { title, description, tag, surf_conditions } = generateIntelContent(user, beach);
      const createdAt = randomDateInRange(14); // Within last 2 weeks (increased from 10 days)
      
      // Add slight offset to beach coordinates for realistic intel posting
      const latitude = addRandomOffset(beach.lat ?? 0);
      const longitude = addRandomOffset(beach.lon ?? 0);
      
      const intelData: Record<string, any> = {
        user_id: user.id,
        beach_id: beach.id,
        latitude,
        longitude,
        tag,
        title,
        description,
        confirmations_count: Math.floor(Math.random() * 15), // Random confirmations
        is_active: true,
        created_at: createdAt.toISOString(),
        // Add surf conditions if it's a conditions post
        ...(surf_conditions && {
          wave_height: surf_conditions.wave_height_ft,
          wind_speed: surf_conditions.wind_speed_kts,
          wind_direction: surf_conditions.wind_direction,
          water_temp: Math.round(surf_conditions.water_temp_f),
          crowd_level: surf_conditions.crowd_level,
          wave_types: ['clean', 'peaky', 'powerful'].filter(() => Math.random() < 0.3),
          forecast_accuracy: ['accurate', 'somewhat', 'inaccurate'][Math.floor(Math.random() * 3)]
        })
      };

      const dedupeHash = createIntelDedupeHash({
        userId: user.id,
        tag,
        beachId: beach.id,
        title,
        description,
        latitude,
        longitude,
      });

      const dedupeTime = intelData.created_at
        ? new Date(intelData.created_at)
        : new Date();
      const dedupeWindowStart = new Date(
        dedupeTime.getTime() - DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES * 60 * 1000
      ).toISOString();

      const { data: existingIntel, error: dedupeError } = await supabase
        .from('intel_posts')
        .select('id, title, description, lat, lon, beach_id, created_at')
        .eq('user_id', user.id)
        .eq('tag', tag)
        .eq('beach_id', beach.id)
        .gte('created_at', dedupeWindowStart)
        .order('created_at', { ascending: false })
        .limit(5);

      if (dedupeError) {
        console.error(
          `Failed to check duplicates for ${beach.name} by ${user.full_name}:`,
          dedupeError
        );
      } else {
        const existingMatch = existingIntel?.find((existing: any) => {
          const existingHash = createIntelDedupeHash({
            userId: user.id,
            tag,
            beachId: existing.beach_id ?? beach.id,
            title: existing.title,
            description: existing.description,
            latitude: existing.latitude,
            longitude: existing.longitude,
          });
          return existingHash === dedupeHash;
        });

        if (existingMatch) {
          console.log(
            `Skipping duplicate intel for ${beach.name} by ${user.full_name} (matches ${existingMatch.id})`
          );
          continue;
        }
      }

      intelData.dedupe_hash = dedupeHash;
      
      const { error } = await supabase
        .from('intel_posts')
        .insert(intelData);
      
      if (error) {
        console.error(`Failed to insert intel post for ${beach.name} by ${user.full_name}:`, error);
      } else {
        totalPosts++;
      }
    }
  }
  
  console.log(`Created ${totalPosts} intel posts`);
  return totalPosts;
}

async function generateSummary(supabase: any): Promise<void> {
  console.log('\n=== SEEDING SUMMARY ===');
  
  // Get final counts
  const [reviewsResult, intelResult, usersResult, beachesResult] = await Promise.all([
    supabase.from('beach_reviews').select('id', { count: 'exact', head: true }),
    supabase.from('intel_posts').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_mock', true),
    supabase.from('beaches').select('id', { count: 'exact', head: true })
  ]);
  
  console.log(`Total beach reviews: ${reviewsResult.count || 0}`);
  console.log(`Total intel posts: ${intelResult.count || 0}`);
  console.log(`Mock users used: ${usersResult.count || 0}`);
  console.log(`Beaches covered: ${beachesResult.count || 0}`);
  
  // Verification queries
  console.log('\n=== VERIFICATION QUERIES ===');
  console.log('-- Check beach review distribution:');
  console.log('SELECT b.name, COUNT(br.id) as review_count FROM beaches b LEFT JOIN beach_reviews br ON b.id = br.beach_id GROUP BY b.id, b.name ORDER BY review_count DESC;');
  
  console.log('\n-- Check intel post distribution by tag:');
  console.log('SELECT tag, COUNT(*) as post_count FROM intel_posts GROUP BY tag ORDER BY post_count DESC;');
  
  console.log('\n-- Check NPC activity:');
  console.log('SELECT p.full_name, COUNT(br.id) as reviews, COUNT(ip.id) as intel_posts FROM profiles p LEFT JOIN beach_reviews br ON p.id = br.user_id LEFT JOIN intel_posts ip ON p.id = ip.user_id WHERE p.is_mock = true GROUP BY p.id, p.full_name;');
  
  console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===');
}

async function main() {
  try {
    console.log('Starting NPC Reviews and Intel seeding...\n');
    
    // Validate environment
    validateEnvironment();
    
    // Initialize Supabase
    const supabase = createSupabaseClient();
    
    // Fetch data
    const [mockUsers, beaches] = await Promise.all([
      fetchMockUsers(supabase),
      fetchBeaches(supabase)
    ]);
    
    // Optional cleanup
    await cleanupExistingNPCContent(supabase, mockUsers.map(u => u.id));
    
    // Seed content
    const [reviewCount, intelCount] = await Promise.all([
      seedBeachReviews(supabase, mockUsers, beaches),
      seedIntelPosts(supabase, mockUsers, beaches)
    ]);
    
    // Generate summary
    await generateSummary(supabase);
    
    console.log(`\nSUCCESS: Created ${reviewCount} reviews and ${intelCount} intel posts`);
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { main };
