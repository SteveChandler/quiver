/**
 * Content generators for persona-based E2E testing
 *
 * Generates persona-appropriate content for intel posts, session notes,
 * and other user-generated content during E2E tests.
 *
 * @see scripts/seed-npc-reviews-and-intel.ts - Source of writing style patterns
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import {
  PersonaType,
  PERSONAS,
  getRandomPhrase,
  getPersonaRating,
  IntelTag,
  PERSONA_PREFERRED_TAGS,
} from '../fixtures/personas';

/**
 * Beach info for content generation
 */
export interface BeachInfo {
  name: string;
  slug?: string;
  city?: string;
  state?: string;
}

/**
 * Generated intel content
 */
export interface GeneratedIntelContent {
  title: string;
  description: string;
  tag: IntelTag;
}

/**
 * Generated session content
 */
export interface GeneratedSessionContent {
  notes: string;
  rating: number;
  waveHeight?: string;
  crowdLevel?: number;
}

/**
 * Intel title templates by persona and tag
 */
const INTEL_TITLE_TEMPLATES: Record<PersonaType, Record<IntelTag, string[]>> = {
  rookie: {
    conditions: [
      '{beach} looking amazing today!',
      'First time checking {beach} - wow!',
      '{beach} is perfect right now!',
    ],
    parking: [
      'Parking tips for {beach}',
      'Found parking at {beach}!',
      'Easy parking today at {beach}',
    ],
    crowd: [
      '{beach} crowd is so friendly!',
      'Everyone at {beach} was super nice',
      'Great vibes at {beach} today',
    ],
    hazards: [
      'Safety heads up for {beach}',
      'Learned something at {beach}',
      'Watch out at {beach}!',
    ],
    access: [
      'Getting to {beach} is easy!',
      'Found the path to {beach}',
      '{beach} access tips for newbies',
    ],
  },

  local: {
    conditions: [
      '{beach} conditions report',
      'Current update: {beach}',
      '{beach} morning assessment',
    ],
    parking: [
      '{beach} parking status',
      'Parking update for {beach}',
      '{beach} lot situation',
    ],
    crowd: [
      '{beach} crowd levels',
      'Lineup report: {beach}',
      '{beach} busy but manageable',
    ],
    hazards: [
      'Hazard alert: {beach}',
      '{beach} safety notice',
      'Watch out at {beach}',
    ],
    access: [
      '{beach} access update',
      'Path status at {beach}',
      '{beach} facilities report',
    ],
  },

  traveler: {
    conditions: [
      'First look at {beach}',
      '{beach} compared to home',
      'Scoring at {beach}!',
    ],
    parking: [
      'Parking figured out at {beach}',
      '{beach} parking for visitors',
      'Navigating {beach} parking',
    ],
    crowd: [
      '{beach} surf community vibes',
      'Meeting locals at {beach}',
      '{beach} lineup culture',
    ],
    hazards: [
      'Heads up about {beach}',
      'What to know at {beach}',
      '{beach} for first-timers',
    ],
    access: [
      'Getting to {beach} as a visitor',
      '{beach} access for travelers',
      'Finding {beach}',
    ],
  },

  photographer: {
    conditions: [
      'Perfect light at {beach}',
      '{beach} photo conditions',
      'Golden hour at {beach}',
    ],
    parking: [
      'Gear-friendly parking at {beach}',
      'Best spots for equipment at {beach}',
      '{beach} photographer parking',
    ],
    crowd: [
      '{beach} action shots today',
      'Great subjects at {beach}',
      'Capturing {beach}',
    ],
    hazards: [
      'Camera-safe zones at {beach}',
      'Equipment tips for {beach}',
      '{beach} shooting conditions',
    ],
    access: [
      'Best angles at {beach}',
      'Photo spots at {beach}',
      '{beach} vantage points',
    ],
  },

  tactical: {
    conditions: [
      '{beach} tactical assessment',
      'Mission report: {beach}',
      '{beach} operational status',
    ],
    parking: [
      '{beach} staging area status',
      'Vehicle positioning: {beach}',
      '{beach} logistics assessment',
    ],
    crowd: [
      '{beach} population density',
      'Civilian activity: {beach}',
      '{beach} crowd analysis',
    ],
    hazards: [
      '{beach} threat assessment',
      'Hazard analysis: {beach}',
      '{beach} risk factors',
    ],
    access: [
      '{beach} ingress routes',
      'Access assessment: {beach}',
      '{beach} entry/exit analysis',
    ],
  },

  competitor: {
    conditions: [
      '{beach} training conditions',
      'Performance surf at {beach}',
      '{beach} competition prep',
    ],
    parking: [
      '{beach} pre-heat logistics',
      'Quick access parking at {beach}',
      '{beach} event parking',
    ],
    crowd: [
      '{beach} lineup competition',
      'Training crowd at {beach}',
      '{beach} competitor density',
    ],
    hazards: [
      '{beach} performance risks',
      'Watch your lines at {beach}',
      '{beach} competition hazards',
    ],
    access: [
      '{beach} fastest access',
      'Heat staging at {beach}',
      '{beach} quick entry points',
    ],
  },
};

/**
 * Intel description templates by persona type
 */
const INTEL_DESCRIPTION_TEMPLATES: Record<PersonaType, Record<IntelTag, string[]>> = {
  rookie: {
    conditions: [
      "{phrase} The waves at {beach} are so fun right now! Perfect for learning. Everyone in the water is super encouraging!",
      "Just got out at {beach} and I'm still buzzing! Conditions are great for beginners like me. The water is so clear!",
      "{phrase} about my session at {beach}! Small, clean waves - exactly what I needed to practice.",
    ],
    parking: [
      "Found parking at {beach}! There's a lot right by the beach that fills up early, but I found street parking nearby.",
      "Pro tip for {beach} parking - arrive early! The main lot fills up fast but there are side streets that work.",
      "Figured out the parking situation at {beach}. Meters take cards now which is super convenient!",
    ],
    crowd: [
      "The crowd at {beach} is so welcoming! Everyone shared waves and gave tips. This is why I love surfing!",
      "Was nervous about the crowd at {beach} but everyone was super patient with me. Got encouragement after my wipeouts!",
      "{phrase} Met so many friendly surfers at {beach} today. The community vibe here is amazing!",
    ],
    hazards: [
      "Learned about some rocks on the north side of {beach}. A local pointed them out - so grateful for the heads up!",
      "Safety tip for {beach}: the current can be stronger than it looks. Stay close to shore if you're learning!",
      "Watch out for other boards in the whitewater at {beach}! It gets busy inside. Better safe than sorry!",
    ],
    access: [
      "Found the best path to {beach}! The main trail is easy to follow and there are even railings.",
      "Access to {beach} is super beginner-friendly. Good signage, clean facilities, even outdoor showers!",
      "{beach} has excellent facilities! Board rinse stations, changing rooms - everything you need as a newbie.",
    ],
  },

  local: {
    conditions: [
      "{phrase} - {beach} has consistent 3-4ft waves with light offshore winds. Classic conditions for this time of year.",
      "Solid session at {beach}. Clean waves, glassy until mid-morning. Get out early before the wind picks up.",
      "{beach} delivering as expected. Waist to chest high, period around 11 seconds. Should hold through the afternoon.",
    ],
    parking: [
      "{phrase} - main lot at {beach} fills by 9am on weekends. Try the residential streets on the south side.",
      "{beach} parking update: construction closed the overflow lot. Use street parking on Ocean Ave for now.",
      "Hidden lot behind the surf shop at {beach} - usually less crowded. $5 all day vs hourly at the main lot.",
    ],
    crowd: [
      "{phrase} - {beach} getting busy with the good conditions. About 30-40 at peak. Most folks are respectful.",
      "Crowd at {beach} is typical for a weekend. Mix of regulars and visitors. Lineup is organized.",
      "{beach} surprisingly mellow today. Maybe 25 people spread across peaks. Good wave distribution.",
    ],
    hazards: [
      "{phrase} - strong rip on the south side of {beach}. Great for getting out but watch newer surfers.",
      "{beach} hazard: low tide exposing more rocks than usual near the pier. Stay in deeper sections if unfamiliar.",
      "Current running strong at {beach} today. Factor it into your positioning - saw a few people drift.",
    ],
    access: [
      "{beach} main stairway got repaired and is solid now. New lighting for dawn patrol too.",
      "Access to {beach} running smooth. Paths clear, facilities maintained. Beach cleanup crew doing good work.",
      "{beach} facilities upgraded - new showers, more bike racks. Good to see city investing here.",
    ],
  },

  traveler: {
    conditions: [
      "{beach} conditions remind me of Indo but colder! Clean waves, perfect offshore. {phrase}",
      "First session at {beach} and I'm impressed! {phrase} my home break - wave shape is super consistent here.",
      "{beach} living up to the hype! Different from my usual spots but in the best way. Quality rivals {phrase}.",
    ],
    parking: [
      "Parking at {beach} is different from home! Downloaded the local app and it's way easier now.",
      "Compared to other surf destinations, {beach} parking is actually pretty manageable. Clear signage helps.",
      "{phrase} the parking chaos in Bali! {beach} is organized - paid lots are reasonable and save the stress.",
    ],
    crowd: [
      "The crowd at {beach} has such a different vibe from home! Way more organized lineup rotation.",
      "{phrase} the competitive crowds I'm used to. {beach} is welcoming to visitors who respect the lineup.",
      "Fascinating surf community at {beach}! Mixed ages, positive energy. Different from back home.",
    ],
    hazards: [
      "Learning the hazards at {beach} from locals - reef shelf not obvious until low tide. Always ask first-timers!",
      "{beach} has interesting currents I didn't expect. {phrase} my home break but more predictable here.",
      "Got educated about {beach} hazards today. Different challenges than I'm used to but manageable.",
    ],
    access: [
      "Access to {beach} is well set up for visitors. Clear paths, good facilities. Easy to navigate first time.",
      "{phrase} other international surf spots for accessibility. {beach} makes it easy to find your way.",
      "Finding {beach} was straightforward. Good signage from the main road. Facilities are visitor-friendly.",
    ],
  },

  photographer: {
    conditions: [
      "{phrase} at {beach}! Morning light is incredible, highlighting every wave. Both surfing and shooting were perfect.",
      "{beach} is a visual feast right now! Clean waves with amazing light penetration. Every set is photo worthy.",
      "Perfect conditions at {beach} for both activities! Great waves combined with {phrase} - photographer's dream.",
    ],
    parking: [
      "Found gear-friendly parking at {beach}. Enough space for tripods and bags. Close to good shooting angles.",
      "{beach} has decent equipment access. Main lot lets you unload before parking. Handy for the camera bag.",
      "Tip for photographers at {beach}: park on the north side for easier access to the best vantage points.",
    ],
    crowd: [
      "Great subjects at {beach} today! Skilled surfers putting on a show. Got some incredible action shots.",
      "{beach} scene is perfect for capturing the surf lifestyle. Diverse crowd, great action, beautiful setting.",
      "Spent the morning shooting at {beach}. So many {phrase} moments. The locals really charge here.",
    ],
    hazards: [
      "Note for photographers at {beach}: be careful of spray zones near the south rocks. Learned the hard way!",
      "Camera-safe zones at {beach} are clearly marked. Stay on the cliff path for dry equipment.",
      "Equipment tip for {beach}: the sand gets whipped up in afternoon wind. Morning shoots are cleanest.",
    ],
    access: [
      "Best shooting angles at {beach} are from the south overlook. Easy path, stable platforms for tripods.",
      "{beach} has great photo spots! Multiple vantage points at different heights. All accessible.",
      "Found amazing compositions at {beach}! The natural framing from the cliff path is {phrase}.",
    ],
  },

  tactical: {
    conditions: [
      "{phrase}: {beach} conditions optimal. Wave height 3-4ft, period 10-12 seconds, winds offshore at 5-8 knots.",
      "Field report from {beach}. Environmental parameters favorable. Wave patterns analyzed and documented.",
      "{beach} operational status: conditions suitable for tactical deployment. Visibility excellent.",
    ],
    parking: [
      "{beach} staging area assessment complete. Primary lot has 40 vehicle capacity. Secondary options identified.",
      "Vehicle positioning report: {beach}. Quick egress routes confirmed. Recommend early arrival.",
      "{phrase}: {beach} logistics favorable. Multiple parking vectors with clear access to target area.",
    ],
    crowd: [
      "{beach} population density: moderate. Approximately 25-30 civilians in operational area. {phrase}.",
      "Crowd analysis {beach}: distribution pattern suggests organized behavior. Minimal interference expected.",
      "{phrase} complete. {beach} civilian activity within normal parameters.",
    ],
    hazards: [
      "Threat assessment {beach}: submerged obstacles identified at low tide positions. {phrase}.",
      "{beach} risk factors catalogued. Strong lateral currents in sector 3. Recommend enhanced awareness.",
      "Environmental hazards {beach}: current vectors documented. Advise caution in approach pattern.",
    ],
    access: [
      "{beach} ingress assessment complete. Primary route shows optimal strategic positioning. {phrase}.",
      "Access control {beach}: minimal. Multiple entry points available with varying difficulty ratings.",
      "{phrase}: {beach} terrain assessment favorable. Infrastructure supports extended operations.",
    ],
  },

  competitor: {
    conditions: [
      "{beach} conditions are {phrase}! Perfect waves for performance training. Consistent sets with rippable faces.",
      "Training report from {beach}. Wave quality is competition-level. Multiple hit sections per ride.",
      "{phrase} training conditions at {beach}! Overhead sets with critical sections. Perfect for aerial practice.",
    ],
    parking: [
      "Pre-heat logistics at {beach}: main lot has quick access to water. Important for warmup timing.",
      "{beach} parking is strategic - park north side for fastest paddle out to the peak.",
      "Competition parking tip for {beach}: arrive 2 hours early for guaranteed spot near water.",
    ],
    crowd: [
      "Lineup at {beach} is competitive but respectful. Good training partners pushing each other.",
      "{phrase} training crowd at {beach}! Everyone's on their game. Raises my performance level.",
      "{beach} has a strong local competitor presence. Good for pushing limits and getting feedback.",
    ],
    hazards: [
      "Performance risk note for {beach}: shallow inside section on lower tides. Factor into line choice.",
      "{beach} competition hazards: watch for loose boards in crowded heats. Communication is key.",
      "Training hazard at {beach}: fatigue sets in quick with the paddle. Pace your sessions.",
    ],
    access: [
      "Fastest water entry at {beach} is from the main stairs. Key for heat transitions.",
      "{beach} quick access: south channel provides easiest paddle to main peak. Saves energy.",
      "{phrase} access strategy for {beach}. Main entry gives best tactical position for heat starts.",
    ],
  },
};

/**
 * Session notes templates by persona type
 */
const SESSION_NOTES_TEMPLATES: Record<PersonaType, string[]> = {
  rookie: [
    "{phrase} Had an amazing session! Caught my best wave ever. The locals were super helpful with tips.",
    "Still buzzing from this session! Made so much progress today. The conditions were perfect for learning.",
    "Best session yet! {phrase} Everything clicked. Can't wait to get back out there tomorrow.",
    "Incredible day! Finally got comfortable in the lineup. Everyone was so encouraging!",
  ],

  local: [
    "Solid dawn patrol. Waves were clean before the wind. Got some good ones on the outside peak.",
    "Classic conditions for this spot. Consistent sets, light crowd. {phrase}",
    "Another quality session. Conditions held up through the morning. Water temp felt good.",
    "Good day at the home break. Swell was hitting right. {phrase} timing worked out.",
  ],

  traveler: [
    "What a session! This spot {phrase} back home. Different wave but super fun to figure out.",
    "Incredible experience! The local surf culture here is unique. Waves were consistent all morning.",
    "Scored epic conditions on this trip! {phrase} what I expected. Worth the travel.",
    "Amazing session exploring this break. The wave has so much character. {phrase}",
  ],

  photographer: [
    "{phrase} for both surfing and shooting! Got some incredible water shots between sets.",
    "Perfect conditions for visual documentation. Morning light was stunning on the waves.",
    "Great session with camera in hand. Captured some {phrase} moments between my own waves.",
    "Dual-purpose session! Shot some epic sequences and caught solid waves myself.",
  ],

  tactical: [
    "Mission parameters achieved. Wave count: 12. Average ride duration: 8 seconds. {phrase}",
    "Operational objectives met. Conditions aligned with forecast analysis. Session efficiency: optimal.",
    "{phrase} Training session complete. Performance metrics recorded for analysis.",
    "Field operation successful. Environmental conditions favorable. All objectives accomplished.",
  ],

  competitor: [
    "{phrase} session! Hit every section hard. Working on my rail game for upcoming heats.",
    "Solid training day. Focused on power turns and finishing moves. Conditions were competition-level.",
    "Performance session complete. Wave selection was on point. {phrase}",
    "Competition prep going well. Consistent performances, improving scores. Peak form incoming.",
  ],
};

/**
 * Generate intel content appropriate for a persona
 */
export function generateIntelContent(
  personaType: PersonaType,
  beach: BeachInfo,
  tag?: IntelTag
): GeneratedIntelContent {
  // Use provided tag or pick from persona's preferred tags
  const preferredTags = PERSONA_PREFERRED_TAGS[personaType];
  const selectedTag = tag || preferredTags[Math.floor(Math.random() * preferredTags.length)];

  // Get title template and fill in beach name
  const titleTemplates = INTEL_TITLE_TEMPLATES[personaType][selectedTag];
  const titleTemplate = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
  const title = titleTemplate.replace('{beach}', beach.name);

  // Get description template and fill in placeholders
  const descTemplates = INTEL_DESCRIPTION_TEMPLATES[personaType][selectedTag];
  const descTemplate = descTemplates[Math.floor(Math.random() * descTemplates.length)];
  const phrase = getRandomPhrase(personaType);
  const description = descTemplate
    .replace(/{beach}/g, beach.name)
    .replace(/{phrase}/g, phrase);

  return {
    title,
    description,
    tag: selectedTag,
  };
}

/**
 * Generate session notes appropriate for a persona
 */
export function generateSessionNotes(personaType: PersonaType): string {
  const templates = SESSION_NOTES_TEMPLATES[personaType];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const phrase = getRandomPhrase(personaType);
  return template.replace(/{phrase}/g, phrase);
}

/**
 * Generate complete session content for a persona
 */
export function generateSessionContent(personaType: PersonaType): GeneratedSessionContent {
  const notes = generateSessionNotes(personaType);
  const rating = getPersonaRating(personaType);

  // Generate contextual wave height based on persona
  const waveHeights = {
    rookie: ['1-2 ft', '2-3 ft', 'knee to waist'],
    local: ['3-4 ft', '4-5 ft', 'waist to chest', 'chest to head'],
    traveler: ['3-4 ft', '4-6 ft', 'overhead'],
    photographer: ['3-4 ft', '4-5 ft', 'waist to head'],
    tactical: ['3-4 ft', '4-5 ft', '1.2-1.5 meters'],
    competitor: ['4-6 ft', 'overhead', 'head high+'],
  };

  const heights = waveHeights[personaType];
  const waveHeight = heights[Math.floor(Math.random() * heights.length)];

  // Crowd level (1-5)
  const crowdLevel = 1 + Math.floor(Math.random() * 5);

  return {
    notes,
    rating,
    waveHeight,
    crowdLevel,
  };
}

/**
 * Verify that content matches expected persona patterns
 */
export function verifyPersonaContent(
  personaType: PersonaType,
  content: string
): { isValid: boolean; matchedPhrases: string[] } {
  const persona = PERSONAS[personaType];
  const matchedPhrases: string[] = [];

  // Check if any characteristic phrases appear in the content
  for (const phrase of persona.phrases) {
    if (content.toLowerCase().includes(phrase.toLowerCase())) {
      matchedPhrases.push(phrase);
    }
  }

  // Also check for style-related keywords
  const styleKeywords: Record<PersonaType, string[]> = {
    rookie: ['amazing', 'incredible', 'first', 'learn', 'beginner', 'helpful', 'progress', 'buzzing'],
    local: ['conditions', 'update', 'usual', 'years', 'know', 'spot', 'dawn patrol', 'classic', 'quality', 'home break', 'swell', 'session', 'waves', 'clean', 'glassy', 'morning', 'afternoon', 'delivering', 'wind', 'current', 'positioning', 'drift', 'rip', 'rocks', 'tide'],
    traveler: ['compare', 'different', 'trip', 'travel', 'visit', 'home', 'experience', 'scored', 'worth'],
    photographer: ['light', 'shot', 'visual', 'capture', 'photo', 'stunning', 'golden', 'angles', 'composition'],
    tactical: ['tactical', 'mission', 'assessment', 'operational', 'strategic', 'field report', 'reconnaissance', 'parameters', 'field operation', 'objectives', 'environmental', 'favorable', 'debrief', 'precision', 'risk', 'threat', 'hazard', 'sector', 'awareness', 'currents', 'lateral'],
    competitor: ['training', 'performance', 'competition', 'push', 'elite', 'circuit', 'session', 'heat'],
  };

  const keywords = styleKeywords[personaType];
  for (const keyword of keywords) {
    if (content.toLowerCase().includes(keyword)) {
      matchedPhrases.push(`[keyword: ${keyword}]`);
    }
  }

  return {
    isValid: matchedPhrases.length > 0,
    matchedPhrases,
  };
}
