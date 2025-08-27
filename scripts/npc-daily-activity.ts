#!/usr/bin/env ts-node

/**
 * NPC Daily Activity Seeder for Quiver
 * 
 * Automatically creates daily content from mock users (NPCs) to keep production
 * feeling alive with regular activity. Randomly selects 3-5 NPCs and creates:
 * - 1 session per NPC in public.sessions
 * - 1 intel post per NPC in public.intel_posts  
 * - 1 beach review per NPC in public.beach_reviews
 * 
 * Usage:
 *   npm run npc:daily
 *   CONFIRM_TARGET=DEV npm run npc:daily
 *   CONFIRM_TARGET=PROD CONFIRM_PROD=YES npm run npc:daily
 * 
 * Environment Variables Required:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *   - CONFIRM_TARGET: Either "DEV" or "PROD" to confirm environment
 *   
 * For Production:
 *   - CONFIRM_PROD: Required "YES" for production runs
 * 
 * Designed for GitHub Actions daily scheduling to create ongoing community feel.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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
  location: string;
  latitude: number;
  longitude: number;
  description?: string;
  skill_level?: string;
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

// NPC personality-based content patterns
const WRITING_STYLES = {
  rookie: {
    session_notes: [
      'Amazing session! Still can\'t believe I\'m actually surfing now. Every wave feels like a victory!',
      'Had the best time out there today. The locals were so helpful and encouraging!',
      'Another step forward in my surfing journey. Feeling more confident each time!'
    ],
    intel_style: 'enthusiastic and grateful',
    review_style: 'excited and appreciative'
  },
  local: {
    session_notes: [
      'Solid session as always. Conditions were exactly what I expected for this time of year.',
      'Another good one in the books. Love having this consistent spot so close to home.',
      'Classic conditions today. This break never disappoints when you know what to expect.'
    ],
    intel_style: 'knowledgeable and helpful',
    review_style: 'experienced and informative'
  },
  traveler: {
    session_notes: [
      'This spot reminds me of some breaks I\'ve surfed in other countries. Unique character!',
      'What a discovery! Different from my home break but amazing in its own way.',
      'Another incredible spot to add to my surf travel journal. Worth the journey!'
    ],
    intel_style: 'comparative and adventurous',
    review_style: 'worldly and comparative'
  },
  photographer: {
    session_notes: [
      'Perfect conditions for both surfing and shooting today. The light was incredible!',
      'Amazing session with beautiful visual conditions. Got some great shots too.',
      'The aesthetic quality of this break is unmatched. Pure visual inspiration!'
    ],
    intel_style: 'aesthetic and technical',
    review_style: 'visually focused'
  },
  tactical: {
    session_notes: [
      'Mission accomplished. Optimal wave parameters and strategic positioning executed perfectly.',
      'Tactical assessment: conditions ideal for extended aquatic operations. Mission successful.',
      'Operational objectives met. Environmental conditions within acceptable parameters.'
    ],
    intel_style: 'military precision',
    review_style: 'analytical and systematic'
  },
  competitor: {
    session_notes: [
      'Excellent training session! These conditions really pushed my performance to the next level.',
      'Great prep for competition season. This spot offers everything needed for skill development.',
      'High-performance training complete. Wave quality perfect for working on competition maneuvers.'
    ],
    intel_style: 'performance focused',
    review_style: 'competitive and intense'
  }
};

// Session timing patterns based on personality
const SESSION_TIMING = {
  rookie: { 
    preferred_times: ['morning', 'afternoon'], 
    duration_range: [45, 90],
    rating_tendency: 'high' // Rookies are enthusiastic
  },
  local: { 
    preferred_times: ['dawn', 'morning', 'sunset'], 
    duration_range: [60, 120],
    rating_tendency: 'balanced'
  },
  traveler: { 
    preferred_times: ['morning', 'afternoon'], 
    duration_range: [90, 150],
    rating_tendency: 'balanced'
  },
  photographer: { 
    preferred_times: ['dawn', 'sunset'], 
    duration_range: [120, 180],
    rating_tendency: 'high' // Love the aesthetics
  },
  tactical: { 
    preferred_times: ['dawn', 'morning'], 
    duration_range: [90, 120],
    rating_tendency: 'precise' // Exact ratings
  },
  competitor: { 
    preferred_times: ['morning', 'afternoon'], 
    duration_range: [120, 180],
    rating_tendency: 'critical' // Performance focused
  }
};

// Initialize Supabase client with safety checks
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
  console.log('🔍 Validating environment...');
  
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CONFIRM_TARGET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  }

  const target = process.env.CONFIRM_TARGET;
  if (target !== 'DEV' && target !== 'PROD') {
    throw new Error('❌ CONFIRM_TARGET must be either "DEV" or "PROD"');
  }

  if (target === 'PROD' && process.env.CONFIRM_PROD !== 'YES') {
    throw new Error('❌ Production seeding requires CONFIRM_PROD=YES');
  }

  console.log(`✅ Environment validated for ${target}`);
  if (target === 'PROD') {
    console.log('⚠️  PRODUCTION MODE - This will create real content');
  }
}

function inferPersonality(fullName: string): MockUser['personality'] {
  const name = fullName.toLowerCase();
  
  // Specific name-based mappings
  if (name.includes('rookie') || name.includes('riley')) return 'rookie';
  if (name.includes('local') || name.includes('larry')) return 'local';
  if (name.includes('travel') || name.includes('tina')) return 'traveler';
  if (name.includes('photo') || name.includes('paul')) return 'photographer';
  if (name.includes('snake') || name.includes('boss') || name.includes('tactical')) return 'tactical';
  if (name.includes('pro') || name.includes('competitive')) return 'competitor';
  
  // Default assignment based on name patterns
  const personalities: MockUser['personality'][] = ['local', 'traveler', 'photographer', 'rookie'];
  return personalities[Math.abs(fullName.length) % personalities.length];
}

async function fetchRandomNPCs(supabase: any, count: number = 5): Promise<MockUser[]> {
  console.log(`🎭 Selecting ${count} random NPCs for daily activity...`);
  
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

  // Randomly select 3-5 NPCs
  const selectedCount = Math.max(3, Math.min(count, profiles.length));
  const shuffled = [...profiles].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, selectedCount);

  const npcs = selected.map((profile: any) => ({
    id: profile.id,
    full_name: profile.full_name,
    personality: inferPersonality(profile.full_name)
  }));

  console.log(`✅ Selected ${npcs.length} NPCs:`, npcs.map(n => `${n.full_name} (${n.personality})`).join(', '));
  return npcs;
}

async function fetchRandomBeaches(supabase: any, count: number): Promise<Beach[]> {
  console.log(`🏖️  Fetching random beaches for ${count} activities...`);
  
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('id, name, location, latitude, longitude, skill_level');

  if (error) {
    throw new Error(`Failed to fetch beaches: ${error.message}`);
  }

  if (!beaches || beaches.length === 0) {
    throw new Error('No beaches found in database');
  }

  // Return random selection
  const shuffled = [...beaches].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, beaches.length));
  
  console.log(`✅ Selected beaches: ${selected.map(b => b.name).join(', ')}`);
  return selected;
}

function generateBackdatedTime(timeType: 'session' | 'intel' | 'review'): Date {
  const now = new Date();
  const msInHour = 60 * 60 * 1000;
  
  switch (timeType) {
    case 'session':
      // Sessions within last 24 hours
      const sessionHoursBack = Math.random() * 24;
      return new Date(now.getTime() - (sessionHoursBack * msInHour));
    
    case 'intel':
      // Intel posts within last 24 hours
      const intelHoursBack = Math.random() * 24;
      return new Date(now.getTime() - (intelHoursBack * msInHour));
    
    case 'review':
      // Beach reviews within last 3 days
      const reviewHoursBack = Math.random() * 72;
      return new Date(now.getTime() - (reviewHoursBack * msInHour));
    
    default:
      return new Date(now.getTime() - (Math.random() * 24 * msInHour));
  }
}

function generateSessionFromPersonality(npc: MockUser, beach: Beach): any {
  const timing = SESSION_TIMING[npc.personality];
  const sessionTime = generateBackdatedTime('session');
  
  // Generate realistic session duration
  const minDuration = timing.duration_range[0];
  const maxDuration = timing.duration_range[1];
  const duration = minDuration + Math.floor(Math.random() * (maxDuration - minDuration));
  
  // Generate rating based on personality
  let rating: number;
  switch (timing.rating_tendency) {
    case 'high':
      rating = 4 + Math.floor(Math.random() * 2); // 4-5
      break;
    case 'critical':
      rating = 3 + Math.floor(Math.random() * 2); // 3-4
      break;
    case 'precise':
      rating = 4; // Always 4 for tactical
      break;
    default:
      rating = 3 + Math.floor(Math.random() * 3); // 3-5
  }
  
  const notes = WRITING_STYLES[npc.personality].session_notes[
    Math.floor(Math.random() * WRITING_STYLES[npc.personality].session_notes.length)
  ];

  return {
    profile_id: npc.id,
    user_id: npc.id,
    beach_id: beach.id,
    arrival_time: sessionTime.toISOString(),
    duration_minutes: duration,
    rating,
    notes,
    status: 'completed',
    is_public: true,
    created_at: sessionTime.toISOString()
  };
}

function generateIntelPost(npc: MockUser, beach: Beach): any {
  const validTags = ['conditions', 'parking', 'crowd', 'access']; // No 'hazards' based on schema
  const tag = validTags[Math.floor(Math.random() * validTags.length)];
  const createdAt = generateBackdatedTime('intel');
  
  const { title, description } = generateIntelContent(npc, beach, tag);
  const surfConditions = tag === 'conditions' ? generateRealisticSurfConditions(beach) : null;
  
  // Add slight coordinate offset for realistic posting
  const latitude = beach.latitude + (Math.random() - 0.5) * 0.002; // ~200m variance
  const longitude = beach.longitude + (Math.random() - 0.5) * 0.002;

  return {
    user_id: npc.id,
    beach_id: beach.id,
    latitude,
    longitude,
    tag,
    title,
    description,
    surf_conditions: surfConditions,
    confirmations_count: Math.floor(Math.random() * 12), // 0-11 confirmations
    is_active: true,
    created_at: createdAt.toISOString()
  };
}

function generateIntelContent(npc: MockUser, beach: Beach, tag: string): { title: string; description: string } {
  const beachName = beach.name;
  
  const contentTemplates = {
    conditions: {
      rookie: {
        title: `${beachName} looking perfect!`,
        description: `OMG! The waves at ${beachName} are so clean and manageable right now! Perfect size for learning and everyone's being super encouraging. Water feels amazing too! 🏄‍♀️`
      },
      local: {
        title: `${beachName} conditions update`,
        description: `Heads up - ${beachName} has clean 3-4ft waves with light offshore winds. Good through the morning before the usual afternoon breeze kicks in. Classic conditions for this time of year.`
      },
      traveler: {
        title: `First impressions: ${beachName}`,
        description: `${beachName} conditions remind me of breaks I've surfed in Portugal! Clean waves with consistent sets. Really impressed with the wave quality here - different from my home break but in the best way.`
      },
      photographer: {
        title: `Perfect light at ${beachName}`,
        description: `Amazing conditions at ${beachName} today - both for surfing and photography! The morning light is highlighting every wave perfectly, creating incredible visual opportunities. Water color is stunning.`
      },
      tactical: {
        title: `${beachName} conditions assessment`,
        description: `Tactical assessment: ${beachName} shows optimal wave parameters. 3-4ft at 10-12 second intervals, offshore winds 5-8 knots. Environmental conditions suitable for extended operations.`
      },
      competitor: {
        title: `${beachName} training conditions`,
        description: `High-performance waves at ${beachName} today! Perfect for competition training with multiple maneuver sections. This is exactly what I need for skill development and performance improvement.`
      }
    },
    parking: {
      rookie: {
        title: `Parking help for ${beachName}`,
        description: `Finally figured out the parking at ${beachName}! Main lot fills up early but found great street parking just 2 blocks away. Free and easy walk to the beach. Such a relief to understand how this works!`
      },
      local: {
        title: `${beachName} parking update`,
        description: `Heads up - main lot at ${beachName} is full by 9am on weekends. Try the side streets on the south side, about 3-minute walk. Meters take cards now which is convenient.`
      },
      traveler: {
        title: `${beachName} parking situation`,
        description: `Parking at ${beachName} is way more organized than my home break! Had to download a parking app but it's actually pretty efficient. Much better than some surf towns I've visited.`
      }
    },
    crowd: {
      rookie: {
        title: `${beachName} crowd vibes`,
        description: `The crowd at ${beachName} is so welcoming! Even though it's busy, everyone's patient with beginners like me. Got great advice from locals and lots of encouragement. Love this community!`
      },
      local: {
        title: `${beachName} crowd report`,
        description: `${beachName} getting pretty crowded with the good conditions - about 30-40 people out at peak times. Most folks are respectful but heads up for some newer faces in the lineup.`
      },
      traveler: {
        title: `${beachName} surf community`,
        description: `Fascinating surf culture at ${beachName}! Really organized lineup with clear etiquette. Different from the competitive vibe at some spots I've traveled to - much more collaborative atmosphere.`
      }
    },
    access: {
      rookie: {
        title: `Getting to ${beachName}`,
        description: `Finally figured out the best path to ${beachName}! Main walkway is a bit steep but there are railings and it's totally manageable with a board. Clean facilities and even a board rinse station!`
      },
      local: {
        title: `${beachName} access update`,
        description: `${beachName} access is running smoothly. Main pathway got repaired last week and is in great shape. Added some new lighting for early morning sessions too. City did a good job on this one.`
      },
      traveler: {
        title: `${beachName} access info`,
        description: `Beach access at ${beachName} is excellent compared to other surf destinations. Clear paths, good facilities, and outdoor showers. Really well-maintained infrastructure here.`
      }
    }
  };

  const tagContent = contentTemplates[tag as keyof typeof contentTemplates];
  if (!tagContent) {
    return {
      title: `Update from ${beachName}`,
      description: `General update from ${beachName}. Conditions and access looking good!`
    };
  }

  const personalityContent = tagContent[npc.personality as keyof typeof tagContent];
  if (!personalityContent) {
    // Fallback to local personality
    return tagContent.local || tagContent[Object.keys(tagContent)[0] as keyof typeof tagContent];
  }

  return personalityContent;
}

function generateRealisticSurfConditions(beach: Beach): any {
  return {
    wave_height_ft: 2 + Math.random() * 4, // 2-6 ft
    wave_period_sec: 8 + Math.random() * 6, // 8-14 sec
    wind_speed_kts: Math.random() * 15, // 0-15 kts
    wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
    tide_height_ft: -1 + Math.random() * 8, // -1 to 7 ft
    water_temp_f: 60 + Math.random() * 15, // 60-75°F
    visibility: ['Fair', 'Good', 'Excellent'][Math.floor(Math.random() * 3)],
    crowd_level: 1 + Math.floor(Math.random() * 5) // 1-5
  };
}

function generateBeachReview(npc: MockUser, beach: Beach): any {
  const createdAt = generateBackdatedTime('review');
  const visitDate = new Date(createdAt.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Visit within a week before review
  
  const { title, content } = generateReviewContent(npc, beach);
  const ratings = generatePersonalityBasedRatings(npc.personality);

  return {
    beach_id: beach.id,
    user_id: npc.id,
    title,
    content,
    visit_date: visitDate.toISOString().split('T')[0],
    created_at: createdAt.toISOString(),
    ...ratings
  };
}

function generateReviewContent(npc: MockUser, beach: Beach): { title: string; content: string } {
  const beachName = beach.name;
  
  const reviewTemplates = {
    rookie: {
      titles: [
        `First time at ${beachName} - Amazing!`,
        `${beachName} exceeded expectations!`,
        `So grateful for ${beachName}!`
      ],
      content: [
        `Had the most incredible time at ${beachName}! This place is perfect for beginners and everyone was so welcoming. Still can't believe I caught actual waves here! The locals gave me amazing tips and I already can't wait to come back.`,
        `${beachName} is everything I dreamed surfing would be! Safe learning environment with gentle waves and such a supportive community. Made so much progress today and met awesome people. This spot has won my heart!`
      ]
    },
    local: {
      titles: [
        `Another solid day at ${beachName}`,
        `${beachName} conditions update`,
        `Why I love ${beachName}`
      ],
      content: [
        `${beachName} delivered the goods again today. Been surfing here for years and it's always reliable. Great waves for all levels and the community stays strong. Water temp was perfect and conditions held up all morning.`,
        `Love how consistent ${beachName} is. Today's session reminded me why this is my home break - predictable conditions, good vibes, and just the right amount of challenge. Never disappoints when you know what to expect.`
      ]
    },
    traveler: {
      titles: [
        `${beachName} worth the journey`,
        `Hidden gem: ${beachName}`,
        `${beachName} travel review`
      ],
      content: [
        `Finally made it to ${beachName} and it absolutely lived up to the hype! So different from my home break but in the best possible way. The whole area has such unique character and the wave quality is exceptional.`,
        `${beachName} is now on my list of must-return surf destinations. The combination of great waves and local culture makes this special. Already recommending it to friends planning surf trips to the area.`
      ]
    },
    photographer: {
      titles: [
        `${beachName} visual feast`,
        `Perfect light at ${beachName}`,
        `Capturing ${beachName}`
      ],
      content: [
        `${beachName} is absolutely stunning! The wave formations combined with incredible lighting made for both amazing surfing and photography. Every angle offers something different - from water colors to surrounding landscape.`,
        `Spent an amazing session at ${beachName} today. The natural beauty here is unmatched and the surf was photogenic perfection. Got incredible shots while enjoying world-class waves. Visual paradise!`
      ]
    },
    tactical: {
      titles: [
        `${beachName} tactical assessment`,
        `Strategic analysis: ${beachName}`,
        `${beachName} operational review`
      ],
      content: [
        `Comprehensive assessment of ${beachName} complete. Location demonstrates optimal strategic advantages with predictable wave patterns and excellent positioning. Recommend for continued tactical utilization and training operations.`,
        `${beachName} operational parameters exceeded expectations. Environmental conditions suitable for extended missions with multiple tactical advantages identified. Security assessment shows minimal hostile elements.`
      ]
    },
    competitor: {
      titles: [
        `${beachName} training analysis`,
        `Performance review: ${beachName}`,
        `Competition prep at ${beachName}`
      ],
      content: [
        `Outstanding training session at ${beachName}! Wave quality pushed my performance to new levels with perfect conditions for working on competition maneuvers. This spot offers everything needed for serious skill development.`,
        `${beachName} continues to be essential for my competition preparation. High-performance waves with multiple sections for advanced techniques. The competitive environment here really brings out peak performance.`
      ]
    }
  };

  const templates = reviewTemplates[npc.personality];
  const title = templates.titles[Math.floor(Math.random() * templates.titles.length)];
  const content = templates.content[Math.floor(Math.random() * templates.content.length)];

  return { title, content };
}

function generatePersonalityBasedRatings(personality: MockUser['personality']): Record<string, number> {
  // Rating columns from environment or default
  const ratingColumns = [
    'overall_rating',
    'wave_quality_rating', 
    'crowd_density_rating',
    'parking_rating',
    'accessibility_rating'
  ];

  const ratings: Record<string, number> = {};
  
  // NPCs are generally positive (3-5 ratings)
  ratingColumns.forEach(column => {
    let baseRating = 3 + Math.floor(Math.random() * 3); // 3-5 base
    
    // Personality adjustments
    switch (personality) {
      case 'rookie':
        // Rookies are enthusiastic, rate higher
        baseRating = Math.min(5, baseRating + (Math.random() < 0.6 ? 1 : 0));
        break;
      case 'local':
        // Locals are more discerning but fair
        if (Math.random() < 0.3) baseRating = Math.max(3, baseRating - 1);
        break;
      case 'tactical':
        // Tactical users are precise
        baseRating = 4; // Always exactly 4
        break;
      case 'competitor':
        // Competitors are critical of performance aspects
        if (column.includes('wave') || column.includes('overall')) {
          baseRating = Math.max(3, baseRating); // Never below 3 for wave quality
        }
        break;
    }
    
    ratings[column] = Math.max(3, Math.min(5, baseRating));
  });

  return ratings;
}

async function createDailyNPCActivity(supabase: any) {
  console.log('🚀 Creating daily NPC activity...\n');
  
  // Select 3-5 random NPCs
  const selectedNPCs = await fetchRandomNPCs(supabase, 3 + Math.floor(Math.random() * 3));
  const beaches = await fetchRandomBeaches(supabase, selectedNPCs.length);
  
  let sessionCount = 0;
  let intelCount = 0;
  let reviewCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < selectedNPCs.length; i++) {
    const npc = selectedNPCs[i];
    const beach = beaches[i % beaches.length]; // Cycle through beaches if fewer than NPCs
    
    console.log(`📝 Creating content for ${npc.full_name} (${npc.personality}) at ${beach.name}...`);
    
    try {
      // Create session
      const sessionData = generateSessionFromPersonality(npc, beach);
      const { error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionData);
      
      if (sessionError) {
        errors.push(`Session for ${npc.full_name}: ${sessionError.message}`);
      } else {
        sessionCount++;
        console.log(`  ✅ Session created`);
      }

      // Create intel post
      const intelData = generateIntelPost(npc, beach);
      const { error: intelError } = await supabase
        .from('intel_posts')
        .insert(intelData);
      
      if (intelError) {
        errors.push(`Intel post for ${npc.full_name}: ${intelError.message}`);
      } else {
        intelCount++;
        console.log(`  ✅ Intel post created (${intelData.tag})`);
      }

      // Create beach review
      const reviewData = generateBeachReview(npc, beach);
      const { error: reviewError } = await supabase
        .from('beach_reviews')
        .insert(reviewData);
      
      if (reviewError) {
        errors.push(`Beach review for ${npc.full_name}: ${reviewError.message}`);
      } else {
        reviewCount++;
        console.log(`  ✅ Beach review created`);
      }

    } catch (error) {
      errors.push(`Content creation for ${npc.full_name}: ${error}`);
    }
  }

  // Summary
  console.log('\n📊 Daily NPC Activity Summary:');
  console.log(`   Sessions created: ${sessionCount}`);
  console.log(`   Intel posts created: ${intelCount}`);  
  console.log(`   Beach reviews created: ${reviewCount}`);
  console.log(`   Total content pieces: ${sessionCount + intelCount + reviewCount}`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered (${errors.length}):`);
    errors.forEach(error => console.log(`   - ${error}`));
  }

  return {
    sessions: sessionCount,
    intel: intelCount, 
    reviews: reviewCount,
    errors: errors.length
  };
}

async function main() {
  const startTime = Date.now();
  
  try {
    console.log('🎭 Starting NPC Daily Activity Seeder\n');
    console.log('=' .repeat(50));
    
    // Validate environment and safety checks
    validateEnvironment();
    
    // Initialize Supabase with error handling
    const supabase = createSupabaseClient();
    
    // Test connection
    const { error: testError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Database connection failed: ${testError.message}`);
    }
    
    console.log('✅ Database connection confirmed\n');
    
    // Create daily content
    const results = await createDailyNPCActivity(supabase);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 NPC Daily Activity Completed Successfully!');
    console.log(`⏱️  Execution time: ${duration}s`);
    console.log(`📈 Created ${results.sessions + results.intel + results.reviews} pieces of content`);
    
    if (results.errors > 0) {
      console.log(`⚠️  Completed with ${results.errors} errors`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ NPC Daily Activity Failed:');
    console.error(error);
    console.log('\n🔍 Verification Steps:');
    console.log('1. Check environment variables are set correctly');
    console.log('2. Verify database connection and permissions');  
    console.log('3. Ensure mock users exist with is_mock=true');
    console.log('4. Check that beaches table has data');
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { main };