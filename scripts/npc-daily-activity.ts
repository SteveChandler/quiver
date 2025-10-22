#!/usr/bin/env node

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
import {
  createIntelDedupeHash,
  DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
} from '../lib/utils/intel-dedupe';

// Load environment variables
config();

// Volume controls (env-driven with safe defaults)
function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function randomIntInclusive(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function pickRandom<T>(items: T[]): T {
  if (!items.length) {
    throw new Error('Cannot pick from empty array');
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0];
}

function describeTimeOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'pre-dawn';
  if (hour < 7) return 'dawn patrol';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'late morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'sunset session';
  return 'evening';
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '');
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours && remaining) {
    return `${hours}h ${remaining}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function approximateWaveRange(height: number): string {
  const lower = Math.max(0.5, Math.round((height - 0.7) * 10) / 10);
  const upper = Math.round((height + 0.7) * 10) / 10;
  if (Math.abs(upper - lower) < 0.3) {
    return `${upper.toFixed(1)}ft`;
  }
  return `${lower.toFixed(1)}-${upper.toFixed(1)}ft`;
}

function capitalize(sentence: string): string {
  if (!sentence) return sentence;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function describePeriod(period: number): string {
  const rounded = Math.round(period);
  if (rounded >= 14) return `${rounded}s groundswell energy`;
  if (rounded >= 10) return `${rounded}s sets with good push`;
  if (rounded >= 7) return `${rounded}s pulses rolling through`;
  return `${rounded}s windswell bumps`;
}

function describeWind(speed: number, direction: string): string {
  const rounded = Math.round(speed);
  let intensity: string;
  if (rounded <= 2) intensity = 'glassy';
  else if (rounded <= 6) intensity = 'light';
  else if (rounded <= 12) intensity = 'moderate';
  else intensity = 'breezy';
  return `${intensity} ${direction.toUpperCase()} winds around ${rounded}kts`;
}

function describeWaterTemp(temp: number): string {
  const rounded = Math.round(temp);
  if (rounded <= 58) return `Water is chilly at ~${rounded}°F (bring rubber).`;
  if (rounded <= 64) return `Water sitting around ${rounded}°F—3/2 is perfect.`;
  if (rounded <= 70) return `Water feels comfortable at ~${rounded}°F.`;
  return `Bath-warm water near ${rounded}°F.`;
}

function describeCrowd(level: number): string {
  if (level <= 1) return 'Lineup is basically empty.';
  if (level === 2) return 'Crowd is light with plenty of space.';
  if (level === 3) return 'Crowd is manageable with a respectful vibe.';
  if (level === 4) return 'Expect a busy lineup but friendly energy.';
  return 'Packed lineup—be patient and pick your moments.';
}

function estimateCrowdSize(level: number): string {
  const normalized = Math.min(5, Math.max(1, Math.round(level)));
  const ranges: Record<number, [number, number]> = {
    1: [4, 10],
    2: [12, 22],
    3: [24, 40],
    4: [40, 60],
    5: [60, 90]
  };
  const [min, max] = ranges[normalized] ?? [20, 40];
  const count = randomIntInclusive(min, max);
  return `${count} surfers`;
}

function describeRating(personality: MockUser['personality'], rating: number): string {
  if (rating >= 5) {
    const reactions = {
      rookie: [
        'Still smiling from those set waves!',
        'Caught my best waves yet.',
        'Totally hooked after that one.'
      ],
      local: [
        'One of the better days we have had lately.',
        'Classic day that reminds me why I surf here.',
        'Local crew was buzzing about how good it was.'
      ],
      traveler: [
        'Highlight session of this trip.',
        'Worth the miles to get here.',
        'Felt like a dream lineup.'
      ],
      photographer: [
        'Shot and surfed some magic moments.',
        'Every wave looked like a postcard.',
        'Light and surf lined up perfectly.'
      ],
      tactical: [
        'All mission objectives achieved.',
        'Precision conditions—minimal adjustments needed.',
        'Executed with textbook accuracy.'
      ],
      competitor: [
        'Perfect reps for comp prep.',
        'Pushed my level on every set.',
        'Could not ask for better training waves.'
      ]
    };
    return pickRandom(reactions[personality]);
  }

  if (rating === 4) {
    const reactions = {
      rookie: [
        'Learning so much every time out.',
        'Confidence keeps building.',
        'Felt really solid out there.'
      ],
      local: [
        'Reliable as always.',
        'Good enough for a few lined-up runners.',
        'Worth paddling out even with the crowd.'
      ],
      traveler: [
        'Loved getting a feel for the local rhythm.',
        'Different from home but in a good way.',
        'Would surf this spot again for sure.'
      ],
      photographer: [
        'Scored a few gallery-worthy frames.',
        'Great textures and light to play with.',
        'Balanced shooting with some fun waves.'
      ],
      tactical: [
        'Conditions aligned with the plan.',
        'Kept it efficient and controlled.',
        'Filed a solid conditions report.'
      ],
      competitor: [
        'Great day for tightening fundamentals.',
        'Banked quality training reps.',
        'Dialed in technique under pressure.'
      ]
    };
    return pickRandom(reactions[personality]);
  }

  const reactions = {
    rookie: [
      'Even the wipeouts felt like progress.',
      'Still stoked just to be out there.',
      'Every session teaches me something.'
    ],
    local: [
      'Not great but worth a paddle.',
      'Nothing special yet still fun.',
      'Worked for the good ones today.'
    ],
    traveler: [
      'Conditions were mixed but stoked to surf.',
      'Still rad to experience a new lineup.',
      'Not perfect but worth the mission.'
    ],
    photographer: [
      'Light was tricky but found some angles.',
      'Not the most photogenic day—but interesting textures.',
      'Made it work even with the flat light.'
    ],
    tactical: [
      'Logged all variables for next time.',
      'Conditions required constant adjustments.',
      'Adaptive planning kept the session on track.'
    ],
    competitor: [
      'Had to grind for the good ones.',
      'Not peak training but still valuable reps.',
      'Conditions forced focus on fundamentals.'
    ]
  };
  return pickRandom(reactions[personality]);
}

const NPC_DAILY_MIN = parseEnvInt('NPC_DAILY_MIN', 3);
const NPC_DAILY_MAX = parseEnvInt('NPC_DAILY_MAX', 5);
const NPC_INTEL_PER_NPC_MIN = parseEnvInt('NPC_INTEL_PER_NPC_MIN', 1);
const NPC_INTEL_PER_NPC_MAX = parseEnvInt('NPC_INTEL_PER_NPC_MAX', 1);
// Hard safety cap on total content pieces created per run (sessions + intel + reviews)
const NPC_RUN_MAX_TOTAL = parseEnvInt('NPC_RUN_MAX_TOTAL', 30);

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

interface SessionNarrativeContext {
  beachName: string;
  timeDescriptor: string;
  clockTime: string;
  durationText: string;
  conditionsSentence: string;
  windSentence: string;
  waterSentence: string;
  crowdSentence: string;
  ratingSentence: string;
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

const SESSION_NARRATIVE_TEMPLATES: Record<
  MockUser['personality'],
  {
    openers: Array<(ctx: SessionNarrativeContext) => string>;
    middles: Array<(ctx: SessionNarrativeContext) => string>;
    closings: Array<(ctx: SessionNarrativeContext) => string>;
  }
> = {
  rookie: {
    openers: [
      ({ beachName, timeDescriptor, clockTime }) => `Snuck in a ${timeDescriptor} session at ${beachName} around ${clockTime}.`,
      ({ beachName, timeDescriptor }) => `Took my stoke to ${beachName} for a ${timeDescriptor} paddle-out.`,
      ({ beachName }) => `Chasing progress one session at a time at ${beachName}.`
    ],
    middles: [
      ({ conditionsSentence, windSentence }) => `${conditionsSentence} ${windSentence}`,
      ({ conditionsSentence, crowdSentence }) => `${conditionsSentence} ${crowdSentence}`,
      ({ conditionsSentence, waterSentence }) => `${conditionsSentence} ${waterSentence}`
    ],
    closings: [
      ({ durationText, ratingSentence }) => `${ratingSentence} Stayed out for about ${durationText}.`,
      ({ ratingSentence }) => ratingSentence,
      ({ ratingSentence, crowdSentence }) => `${ratingSentence} ${crowdSentence}`
    ]
  },
  local: {
    openers: [
      ({ beachName, timeDescriptor, clockTime }) => `Logged the usual ${timeDescriptor} laps at ${beachName} around ${clockTime}.`,
      ({ beachName }) => `Checked our home break ${beachName} and it delivered again.`,
      ({ beachName, timeDescriptor }) => `${beachName} served up another reliable ${timeDescriptor} to remember.`
    ],
    middles: [
      ({ conditionsSentence, windSentence, crowdSentence }) => `${conditionsSentence} ${windSentence} ${crowdSentence}`,
      ({ conditionsSentence, waterSentence }) => `${conditionsSentence} ${waterSentence}`,
      ({ conditionsSentence }) => conditionsSentence
    ],
    closings: [
      ({ durationText, ratingSentence }) => `${ratingSentence} Put in ${durationText} before heading back to work.`,
      ({ ratingSentence }) => ratingSentence,
      ({ ratingSentence, crowdSentence }) => `${ratingSentence} ${crowdSentence}`
    ]
  },
  traveler: {
    openers: [
      ({ beachName, timeDescriptor, clockTime }) => `Dropped into ${beachName} for a ${timeDescriptor} session around ${clockTime}.`,
      ({ beachName }) => `Exploring ${beachName} has been a highlight of this trip.`,
      ({ beachName, timeDescriptor }) => `This ${timeDescriptor} at ${beachName} felt worlds apart from my home break.`
    ],
    middles: [
      ({ conditionsSentence, windSentence }) => `${conditionsSentence} ${windSentence}`,
      ({ conditionsSentence, waterSentence }) => `${conditionsSentence} ${waterSentence}`,
      ({ conditionsSentence, crowdSentence }) => `${conditionsSentence} ${crowdSentence}`
    ],
    closings: [
      ({ ratingSentence, durationText }) => `${ratingSentence} Logged about ${durationText} before grabbing coffee.`,
      ({ ratingSentence }) => ratingSentence,
      ({ ratingSentence, waterSentence }) => `${ratingSentence} ${waterSentence}`
    ]
  },
  photographer: {
    openers: [
      ({ beachName, timeDescriptor }) => `Split time between lens and lineup at ${beachName} during the ${timeDescriptor}.`,
      ({ beachName, clockTime }) => `Golden hour at ${beachName} around ${clockTime} was unreal.`,
      ({ beachName }) => `Framed up ${beachName} and paddled out for a few keepers.`
    ],
    middles: [
      ({ conditionsSentence, windSentence }) => `${conditionsSentence} ${windSentence}`,
      ({ conditionsSentence, waterSentence }) => `${conditionsSentence} ${waterSentence}`,
      ({ conditionsSentence }) => conditionsSentence
    ],
    closings: [
      ({ ratingSentence, durationText, waterSentence }) => `${ratingSentence} Stayed out for ${durationText}. ${waterSentence}`,
      ({ ratingSentence }) => ratingSentence,
      ({ ratingSentence, crowdSentence }) => `${ratingSentence} ${crowdSentence}`
    ]
  },
  tactical: {
    openers: [
      ({ beachName, timeDescriptor, clockTime }) => `Initiated ${timeDescriptor} operation at ${beachName} at ${clockTime}.`,
      ({ beachName }) => `Conducted field assessment at ${beachName} under favorable parameters.`,
      ({ beachName, timeDescriptor }) => `Mission window: ${timeDescriptor} at ${beachName}.`
    ],
    middles: [
      ({ conditionsSentence, windSentence, crowdSentence }) => `${conditionsSentence} ${windSentence} ${crowdSentence}`,
      ({ conditionsSentence, waterSentence }) => `${conditionsSentence} ${waterSentence}`,
      ({ conditionsSentence }) => conditionsSentence
    ],
    closings: [
      ({ durationText, ratingSentence }) => `${ratingSentence} Session duration recorded at ${durationText}.`,
      ({ ratingSentence }) => ratingSentence,
      ({ ratingSentence, crowdSentence }) => `${ratingSentence} ${crowdSentence}`
    ]
  },
  competitor: {
    openers: [
      ({ beachName, timeDescriptor, clockTime }) => `Training block at ${beachName} kicked off ${timeDescriptor} around ${clockTime}.`,
      ({ beachName }) => `Focused reps at ${beachName} to sharpen competition form.`,
      ({ beachName, timeDescriptor }) => `Kept the momentum going with a ${timeDescriptor} grind at ${beachName}.`
    ],
    middles: [
      ({ conditionsSentence, windSentence }) => `${conditionsSentence} ${windSentence}`,
      ({ conditionsSentence, crowdSentence }) => `${conditionsSentence} ${crowdSentence}`,
      ({ conditionsSentence, waterSentence }) => `${conditionsSentence} ${waterSentence}`
    ],
    closings: [
      ({ ratingSentence, durationText }) => `${ratingSentence} Logged ${durationText} of focused work.`,
      ({ ratingSentence }) => ratingSentence,
      ({ ratingSentence, crowdSentence }) => `${ratingSentence} ${crowdSentence}`
    ]
  }
};

const CONDITIONS_PERSONA_FLAIR: Record<MockUser['personality'], string[]> = {
  rookie: [
    'Perfect window for stacking confidence without getting overwhelmed.',
    'Lots of friendly faces encouraging newer surfers today.',
    'Easy to sit inside and still snag plenty of waves.'
  ],
  local: [
    'Feels like the kind of morning regulars quietly wait for.',
    'Worth clocking in before work—sets lining up like a classic day.',
    'If you know the takeoff spots, it is a conveyor belt right now.'
  ],
  traveler: [
    'Reminds me of a European beach break, but with California warmth.',
    'Such a fun contrast to my home spot—definitely session-of-the-trip energy.',
    'Writing this one down in the travel log for sure.'
  ],
  photographer: [
    'Split time between shooting and surfing because the light was unreal.',
    'Water color had this deep emerald tone that made every wave photogenic.',
    'Foam lines and reflections were making the whole scene cinematic.'
  ],
  tactical: [
    'Operational window looks stable for another hour or two.',
    'Parameters aligned neatly with the mission notes—minimal adjustments needed.',
    'Conditions held their line across the set—predictable and efficient.'
  ],
  competitor: [
    'Great ramps for linking two or three turns without forcing it.',
    'Plenty of sections for working on combo work under pressure.',
    'Perfect reps for keeping competition timing sharp.'
  ]
};

const PARKING_PERSONA_TIPS: Record<MockUser['personality'], string[]> = {
  rookie: [
    'If you are still figuring it out, aim for the side streets on the north end—easy walk and mellow vibes.',
    'Bring some quarters or enable tap-to-pay ahead of time; saved me a scramble this morning.'
  ],
  local: [
    'Locals know the drill: south lot buys you an extra 45 minutes before the rush.',
    'Worth stashing a bike lock—rolling down from a couple blocks out is faster than looping the lot.'
  ],
  traveler: [
    'Download the local parking app before you arrive so you are not fiddling curbside.',
    'Street sweeping hits Thursdays, so check the signs if you are visiting mid-week.'
  ],
  photographer: [
    'Parked near the bluff so I could stash the camera bag quickly between shoots.',
    'Golden-hour shooters: arrive a bit early so you can catch the light without sprinting from the car.'
  ],
  tactical: [
    'Recommend staging gear before peak influx—operation ran smoother starting up-current from the main lot.',
    'Executed a drop-off and park maneuver to minimize exposure to gridlock.'
  ],
  competitor: [
    'Worth investing in the permit—saves crucial minutes when you are tracking tides.',
    'Rolled in early, stretched by the car, and still saw the lot fill behind me in minutes.'
  ]
};

const CROWD_PERSONA_NOTES: Record<MockUser['personality'], string[]> = {
  rookie: [
    'Everyone was patient and calling sets for folks still figuring it out.',
    'Even with the numbers, the vibe stayed encouraging—plenty of waves for sharers.'
  ],
  local: [
    'Lineup etiquette was tight—familiar faces keeping things orderly.',
    'Worth rotating peaks to avoid the pack; the reform down the beach was wide open.'
  ],
  traveler: [
    'Great way to meet the local crew—everyone was chatting between sets.',
    'Etiquette here is clear: take turns, stay smiling, and you will slot right in.'
  ],
  photographer: [
    'Crowd added great scale to the shots—staggered lineups looked cinematic.',
    'Lots of color in the lineup today which made the photos pop.'
  ],
  tactical: [
    'Maintained position by shifting 20 yards north of the primary pack—reduced interference.',
    'Lineup rotation required constant adjustments but stayed manageable.'
  ],
  competitor: [
    'Crowd forced tight positioning—good practice for contest-style heat surfing.',
    'Made it a point to sit deeper and hunt the set waves to stay productive.'
  ]
};

const ACCESS_PERSONA_NOTES: Record<MockUser['personality'], string[]> = {
  rookie: [
    'Board-friendly handrails the entire way and even a rinse station at the bottom.',
    'Path down is steady—took it slow with the soft-top and had zero issues.'
  ],
  local: [
    'City finally patched the loose pavers—jogging back up is less sketchy now.',
    'Worth taking the south stairs if you are hauling a longboard; less wind exposure.'
  ],
  traveler: [
    'Way cleaner than most beach accesses I have seen abroad—kudos to the local crew.',
    'Signage is clear, and there are lockers by the restrooms if you are rolling solo.'
  ],
  photographer: [
    'Tripod-friendly landings at two platforms—makes sunrise shooting a breeze.',
    'Path lighting is clutch for pre-dawn missions with camera gear.'
  ],
  tactical: [
    'Multiple ingress points allow for efficient team deployment.',
    'Surface traction is solid even with gear—minimal slip risk.'
  ],
  competitor: [
    'Plenty of space to stretch and band warm-up before dropping in.',
    'Easy to hustle from car to water, so you can time the warm-up with set lulls.'
  ]
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

  // Select requested count within available profiles
  const selectedCount = Math.max(1, Math.min(count, profiles.length));
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
  const duration = randomIntInclusive(minDuration, maxDuration);
  
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
  
  const surfConditions = generateRealisticSurfConditions(beach);
  const notes = createSessionNarrative(npc, beach, sessionTime, duration, rating, surfConditions);

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

function createSessionNarrative(
  npc: MockUser,
  beach: Beach,
  sessionTime: Date,
  duration: number,
  rating: number,
  conditions: SurfConditions
): string {
  const template = SESSION_NARRATIVE_TEMPLATES[npc.personality] ?? SESSION_NARRATIVE_TEMPLATES.local;
  const waveRange = approximateWaveRange(conditions.wave_height_ft);
  const periodDescription = describePeriod(conditions.wave_period_sec);
  const conditionsSentence = `Sets in the ${waveRange} zone with ${periodDescription}.`;
  const windSentence = `${describeWind(conditions.wind_speed_kts, conditions.wind_direction)}.`;
  const waterSentence = describeWaterTemp(conditions.water_temp_f);
  const crowdSentence = describeCrowd(conditions.crowd_level);
  const context: SessionNarrativeContext = {
    beachName: beach.name,
    timeDescriptor: describeTimeOfDay(sessionTime),
    clockTime: formatClockTime(sessionTime),
    durationText: formatDuration(duration),
    conditionsSentence,
    windSentence,
    waterSentence,
    crowdSentence,
    ratingSentence: describeRating(npc.personality, rating)
  };

  const segments = [
    pickRandom(template.openers)(context),
    pickRandom(template.middles)(context),
    pickRandom(template.closings)(context)
  ];

  return segments
    .map(segment => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

function generateIntelPost(npc: MockUser, beach: Beach): any {
  const validTags = ['conditions', 'parking', 'crowd', 'access']; // No 'hazards' based on schema
  const tag = validTags[Math.floor(Math.random() * validTags.length)];
  const createdAt = generateBackdatedTime('intel');
  const baselineConditions = generateRealisticSurfConditions(beach);
  const { title, description } = generateIntelContent(npc, beach, tag, createdAt, baselineConditions);

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
    surf_conditions: tag === 'conditions' ? baselineConditions : null,
    confirmations_count: Math.floor(Math.random() * 12), // 0-11 confirmations
    is_active: true,
    created_at: createdAt.toISOString()
  };
}

function generateIntelContent(
  npc: MockUser,
  beach: Beach,
  tag: string,
  createdAt: Date,
  surfConditions: SurfConditions
): { title: string; description: string } {
  const beachName = beach.name;
  const timeDescriptor = describeTimeOfDay(createdAt);
  const clockTime = formatClockTime(createdAt);

  switch (tag) {
    case 'conditions':
      return generateConditionsIntel(npc.personality, beachName, timeDescriptor, clockTime, surfConditions);
    case 'parking':
      return generateParkingIntel(npc.personality, beachName, timeDescriptor, clockTime);
    case 'crowd':
      return generateCrowdIntel(npc.personality, beachName, timeDescriptor, clockTime, surfConditions);
    case 'access':
      return generateAccessIntel(npc.personality, beachName, timeDescriptor, clockTime);
    default:
      return {
        title: `Update from ${beachName}`,
        description: `Quick check-in from ${beachName}: ${capitalize(timeDescriptor)} window around ${clockTime} had good energy.`
      };
  }
}

function generateConditionsIntel(
  personality: MockUser['personality'],
  beachName: string,
  timeDescriptor: string,
  clockTime: string,
  surfConditions: SurfConditions
): { title: string; description: string } {
  const waveRange = approximateWaveRange(surfConditions.wave_height_ft);
  const periodDescription = describePeriod(surfConditions.wave_period_sec);
  const windSpeed = surfConditions.wind_speed_kts;
  const windMood =
    windSpeed <= 3 ? 'glassy' : windSpeed <= 7 ? 'clean' : windSpeed <= 11 ? 'textured' : 'windy';

  const personaTitles: Record<MockUser['personality'], string[]> = {
    rookie: [
      `${beachName} looking friendly (${waveRange})`,
      `${capitalize(timeDescriptor)} stoke at ${beachName}`
    ],
    local: [
      `${beachName} running ${waveRange} and ${windMood}`,
      `${capitalize(timeDescriptor)} report for ${beachName} locals`
    ],
    traveler: [
      `Travel diary: ${beachName} feels ${windMood}`,
      `${beachName} delivering ${waveRange} runners`
    ],
    photographer: [
      `${beachName} glowing in ${capitalize(timeDescriptor)} light`,
      `Textures & lines at ${beachName}`
    ],
    tactical: [
      `${beachName} conditions assessment`,
      `Operational window: ${beachName} ${capitalize(timeDescriptor)}`
    ],
    competitor: [
      `${beachName} training read`,
      `${waveRange} with drive at ${beachName}`
    ]
  };

  const fallbackTitles = [
    `${beachName}: ${waveRange} and ${windMood}`,
    `${capitalize(timeDescriptor)} read at ${beachName}`
  ];

  const title = pickRandom([
    ...(personaTitles[personality] ?? []),
    ...fallbackTitles
  ]);

  const personaFlair = CONDITIONS_PERSONA_FLAIR[personality] ?? CONDITIONS_PERSONA_FLAIR.local;

  const lines = [
    `Checked ${beachName} during the ${timeDescriptor} window (${clockTime}).`,
    `Sets in the ${waveRange} zone with ${periodDescription}.`,
    `${capitalize(describeWind(surfConditions.wind_speed_kts, surfConditions.wind_direction))}.`,
    `Tide hovering around ${surfConditions.tide_height_ft.toFixed(1)}ft with ${surfConditions.visibility.toLowerCase()} visibility.`,
    describeWaterTemp(surfConditions.water_temp_f),
    describeCrowd(surfConditions.crowd_level),
    pickRandom(personaFlair)
  ];

  const description = lines.filter(Boolean).map(line => line.trim()).join(' ');
  return { title, description };
}

function generateParkingIntel(
  personality: MockUser['personality'],
  beachName: string,
  timeDescriptor: string,
  clockTime: string
): { title: string; description: string } {
  const titleOptions: Record<MockUser['personality'], string[]> = {
    rookie: [
      `Parking tips for ${beachName}`,
      `Found an easy spot near ${beachName}`
    ],
    local: [
      `${beachName} parking intel`,
      `Lot status update: ${beachName}`
    ],
    traveler: [
      `${beachName} parking breakdown`,
      `Visitor notes: parking at ${beachName}`
    ],
    photographer: [
      `Gear-friendly parking at ${beachName}`,
      `Sunrise parking game plan`
    ],
    tactical: [
      `Logistics briefing: ${beachName} parking`,
      `Deployment plan for ${beachName} lot`
    ],
    competitor: [
      `Beat the clock parking at ${beachName}`,
      `Warm-up friendly parking setup`
    ]
  };

  const title = pickRandom([
    ...(titleOptions[personality] ?? []),
    `${beachName} parking update`
  ]);

  const minutesToPark = randomIntInclusive(2, 8);
  const fillWindow = randomIntInclusive(15, 45);
  const backupDistance = randomIntInclusive(2, 5);
  const personaTips = PARKING_PERSONA_TIPS[personality] ?? PARKING_PERSONA_TIPS.local;

  const lines = [
    `Rolled up around ${clockTime} for the ${timeDescriptor} window and found a spot in about ${minutesToPark} minutes.`,
    `Main lot started filling roughly ${fillWindow} minutes later, so plan ahead if you are rolling in after.`,
    `Side streets about ${backupDistance} blocks out were still wide open.`,
    pickRandom(personaTips)
  ];

  const description = lines.filter(Boolean).map(line => line.trim()).join(' ');
  return { title, description };
}

function generateCrowdIntel(
  personality: MockUser['personality'],
  beachName: string,
  timeDescriptor: string,
  clockTime: string,
  surfConditions: SurfConditions
): { title: string; description: string } {
  const titleOptions: Record<MockUser['personality'], string[]> = {
    rookie: [
      `${beachName} crowd vibes`,
      `Friendly faces at ${beachName}`
    ],
    local: [
      `${beachName} crowd report`,
      `Lineup density at ${beachName}`
    ],
    traveler: [
      `Surf community check: ${beachName}`,
      `${beachName} lineup culture`
    ],
    photographer: [
      `Crowd scene at ${beachName}`,
      `Lineup aesthetics: ${beachName}`
    ],
    tactical: [
      `Crowd assessment for ${beachName}`,
      `Lineup dynamics briefing`
    ],
    competitor: [
      `Heat-style lineup at ${beachName}`,
      `Crowd pressure read`
    ]
  };

  const title = pickRandom([
    ...(titleOptions[personality] ?? []),
    `${beachName} crowd update`
  ]);

  const crowdSentence = describeCrowd(surfConditions.crowd_level);
  const headcount = estimateCrowdSize(surfConditions.crowd_level);
  const personaNotes = CROWD_PERSONA_NOTES[personality] ?? CROWD_PERSONA_NOTES.local;

  const lines = [
    `Checked the lineup during the ${timeDescriptor} window around ${clockTime}.`,
    `${capitalize(crowdSentence.replace(/\.$/, ''))}—roughly ${headcount} in the water.`,
    `Plenty of rotation between peaks, so drifting ${randomIntInclusive(15, 40)} yards can change the vibe.`,
    pickRandom(personaNotes)
  ];

  const description = lines.filter(Boolean).map(line => line.trim()).join(' ');
  return { title, description };
}

function generateAccessIntel(
  personality: MockUser['personality'],
  beachName: string,
  timeDescriptor: string,
  clockTime: string
): { title: string; description: string } {
  const titleOptions: Record<MockUser['personality'], string[]> = {
    rookie: [
      `Best way down to ${beachName}`,
      `${beachName} access tips`
    ],
    local: [
      `${beachName} access update`,
      `Trail check: ${beachName}`
    ],
    traveler: [
      `Visitor guide: getting into ${beachName}`,
      `Access intel for ${beachName}`
    ],
    photographer: [
      `Gear-friendly access at ${beachName}`,
      `Light-chasing route into ${beachName}`
    ],
    tactical: [
      `Ingress/egress notes for ${beachName}`,
      `Access logistics brief`
    ],
    competitor: [
      `Race-ready path into ${beachName}`,
      `Warm-up route intel`
    ]
  };

  const title = pickRandom([
    ...(titleOptions[personality] ?? []),
    `${beachName} access overview`
  ]);

  const stairCount = randomIntInclusive(40, 90);
  const surface = pickRandom(['paved', 'packed sand', 'boardwalk', 'concrete']);
  const amenities = pickRandom([
    'showers running',
    'restrooms open',
    'rinse stations operational',
    'bike racks available'
  ]);
  const personaNotes = ACCESS_PERSONA_NOTES[personality] ?? ACCESS_PERSONA_NOTES.local;

  const lines = [
    `Dropped in via the main path for the ${timeDescriptor} slot around ${clockTime}.`,
    `Expect about ${stairCount} stairs with a ${surface} surface—totally manageable with gear.`,
    `Facilities check: ${amenities}.`,
    pickRandom(personaNotes)
  ];

  const description = lines.filter(Boolean).map(line => line.trim()).join(' ');
  return { title, description };
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
  
  // Determine number of NPCs to use today from configured range
  const npcCount = randomIntInclusive(NPC_DAILY_MIN, Math.max(NPC_DAILY_MIN, NPC_DAILY_MAX));
  console.log(`⚙️  Volume config: NPCs=${npcCount}, intel per NPC=${NPC_INTEL_PER_NPC_MIN}-${NPC_INTEL_PER_NPC_MAX}, run cap=${NPC_RUN_MAX_TOTAL}`);
  const selectedNPCs = await fetchRandomNPCs(supabase, npcCount);
  const beaches = await fetchRandomBeaches(supabase, selectedNPCs.length);
  
  let sessionCount = 0;
  let intelCount = 0;
  let reviewCount = 0;
  let totalCreated = 0;
  const errors: string[] = [];
  const runIntelHashes = new Set<string>();

  for (let i = 0; i < selectedNPCs.length; i++) {
    const npc = selectedNPCs[i];
    const beach = beaches[i % beaches.length]; // Cycle through beaches if fewer than NPCs
    
    console.log(`📝 Creating content for ${npc.full_name} (${npc.personality}) at ${beach.name}...`);
    
    try {
      // Enforce hard cap
      if (totalCreated >= NPC_RUN_MAX_TOTAL) {
        console.log('⛔ Per-run content cap reached. Stopping early to protect volume limits.');
        break;
      }
      // Create session
      const sessionData = generateSessionFromPersonality(npc, beach);
      const { error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionData);
      
      if (sessionError) {
        errors.push(`Session for ${npc.full_name}: ${sessionError.message}`);
      } else {
        sessionCount++;
        totalCreated++;
        console.log(`  ✅ Session created`);
      }

      // Create 1..N intel posts per NPC within configured range, respecting cap
      const intelForThisNpc = randomIntInclusive(
        Math.max(1, NPC_INTEL_PER_NPC_MIN),
        Math.max(NPC_INTEL_PER_NPC_MIN, NPC_INTEL_PER_NPC_MAX)
      );
      for (let j = 0; j < intelForThisNpc; j++) {
        if (totalCreated >= NPC_RUN_MAX_TOTAL) {
          console.log('⛔ Per-run content cap reached during intel creation. Stopping.');
          break;
        }
        let intelData: any | null = null;
        let dedupeHash = "";
        let duplicateReason: "run" | "existing" | null = null;
        let shouldInsert = false;

        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          intelData = generateIntelPost(npc, beach);
          const { user_id: userId, tag: intelTag, beach_id: beachId } = intelData;

          dedupeHash = createIntelDedupeHash({
            userId,
            tag: intelTag,
            beachId,
            title: intelData.title,
            description: intelData.description,
            latitude: intelData.latitude,
            longitude: intelData.longitude,
          });

          const runKey = `${userId}:${dedupeHash}`;
          if (runIntelHashes.has(runKey)) {
            duplicateReason = "run";
            continue;
          }

          const createdAt = intelData.created_at
            ? new Date(intelData.created_at)
            : new Date();
          const dedupeWindowStart = new Date(
            createdAt.getTime() - DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES * 60 * 1000
          ).toISOString();

          const { data: existingIntel, error: existingIntelError } = await supabase
            .from('intel_posts')
            .select('id, title, description, latitude, longitude, created_at')
            .eq('user_id', userId)
            .eq('tag', intelTag)
            .eq('beach_id', beachId)
            .gte('created_at', dedupeWindowStart)
            .order('created_at', { ascending: false })
            .limit(5);

          if (existingIntelError) {
            console.error(
              `  ⚠️ Failed to check for duplicates for ${npc.full_name}:`,
              existingIntelError
            );
            shouldInsert = true;
            break;
          }

          const existingMatch = existingIntel?.find((existing) => {
            const existingHash = createIntelDedupeHash({
              userId,
              tag: intelTag,
              beachId,
              title: existing.title,
              description: existing.description,
              latitude: existing.latitude,
              longitude: existing.longitude,
            });
            return existingHash === dedupeHash;
          });

          if (existingMatch) {
            duplicateReason = "existing";
            continue;
          }

          shouldInsert = true;
          break;
        }

        if (!shouldInsert || !intelData) {
          const reasonText =
            duplicateReason === "existing"
              ? "matched existing intel in window"
              : duplicateReason === "run"
                ? "duplicate generated within current run"
                : "unable to produce unique intel";
          console.log(
            `  ⚠️ Skipped duplicate intel for ${npc.full_name} at ${beach.name} (${reasonText})`
          );
          continue;
        }

        intelData.dedupe_hash = dedupeHash;

        const runKey = `${intelData.user_id}:${dedupeHash}`;
        runIntelHashes.add(runKey);

        const { error: intelError } = await supabase
          .from('intel_posts')
          .insert(intelData);
        if (intelError) {
          errors.push(`Intel post for ${npc.full_name}: ${intelError.message}`);
        } else {
          intelCount++;
          totalCreated++;
          console.log(`  ✅ Intel post created (${intelData.tag})`);
        }
      }

      // Create beach review
      if (totalCreated >= NPC_RUN_MAX_TOTAL) {
        console.log('⛔ Per-run content cap reached before review creation. Stopping.');
        break;
      }
      const reviewData = generateBeachReview(npc, beach);
      const { error: reviewError } = await supabase
        .from('beach_reviews')
        .insert(reviewData);
      
      if (reviewError) {
        errors.push(`Beach review for ${npc.full_name}: ${reviewError.message}`);
      } else {
        reviewCount++;
        totalCreated++;
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
