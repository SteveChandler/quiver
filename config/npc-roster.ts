/**
 * NPC Roster Configuration
 *
 * Defines 25 unique NPC profiles with natural names, personalities,
 * and regional assignments. Used by migration script and daily activity.
 */

export interface NPCProfile {
  oldName: string | null;
  name: string;
  personality: 'rookie' | 'local' | 'traveler' | 'photographer' | 'tactical' | 'competitor' | 'forecaster';
  homeRegion: string;
  activityLevel: 'high' | 'medium' | 'low';
  background: string;
}

export const NPC_ROSTER: NPCProfile[] = [
  { oldName: 'Larry "Local" Thompson', name: 'Marcus Chen', personality: 'local', homeRegion: 'north-san-diego', activityLevel: 'high', background: 'Software engineer, surfs Scripps before work' },
  { oldName: 'Riley "Rookie" Rodriguez', name: 'Emma Davis', personality: 'rookie', homeRegion: 'south-san-diego', activityLevel: 'medium', background: 'Just moved from Denver, learning at La Jolla Shores' },
  { oldName: 'Tina "Travel" Chen', name: 'Sofia Reyes', personality: 'traveler', homeRegion: 'socal-visitor', activityLevel: 'low', background: 'Travel nurse, chases waves between assignments' },
  { oldName: 'Paul "PhotoPro" Martinez', name: 'Kai Nakamura', personality: 'photographer', homeRegion: 'sf-bay-area', activityLevel: 'medium', background: 'Surf photographer, shoots Ocean Beach regulars' },
  { oldName: 'Dana "Dawn Patrol" Wilson', name: 'Ryan Fitzgerald', personality: 'local', homeRegion: 'south-san-diego', activityLevel: 'high', background: 'Firefighter, 20 years surfing OB Pier' },
  { oldName: 'Jake "NorCal" Anderson', name: 'Diego Santos', personality: 'local', homeRegion: 'central-coast', activityLevel: 'high', background: 'Grew up in Santa Cruz, knows every reef' },
  { oldName: 'Sofia "SoCal" Ramirez', name: 'Carmen Vega', personality: 'local', homeRegion: 'south-san-diego', activityLevel: 'medium', background: 'Restaurant owner, sunrise sessions at Sunset Cliffs' },
  { oldName: 'Kai "Hawaii" Nakamura', name: 'Ethan Brooks', personality: 'competitor', homeRegion: 'central-coast', activityLevel: 'high', background: 'Steamer Lane devotee, chasing QS points' },
  { oldName: 'Ryan "Tech" Kumar', name: 'David Kim', personality: 'local', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Accountant by day, Trestles regular since 08' },
  { oldName: 'Emma "Weather" Foster', name: 'Priya Sharma', personality: 'local', homeRegion: 'sf-bay-area', activityLevel: 'high', background: 'ER doctor, dawn patrol at Pacifica is her therapy' },
  { oldName: 'Mia "Safety" Rodriguez', name: 'Anika Patel', personality: 'rookie', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Tech PM, started surfing at 35, fully hooked' },
  { oldName: 'Marcus "East Coast" Johnson', name: 'Chris Morales', personality: 'traveler', homeRegion: 'norcal-visitor', activityLevel: 'low', background: 'Surfs globally, documenting California leg' },
  { oldName: 'Big Boss', name: 'Ben Kowalski', personality: 'tactical', homeRegion: 'north-san-diego', activityLevel: 'medium', background: 'Ex-Navy, treats every session like a mission' },
  { oldName: 'Solid Snake', name: 'Mike Patterson', personality: 'tactical', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Security consultant, precision approach to waves' },
  { oldName: 'Liquid Snake', name: 'Tyler OBrien', personality: 'competitor', homeRegion: 'north-san-diego', activityLevel: 'high', background: 'Former NSSA junior, trains at Huntington' },
  { oldName: 'Mia R.', name: 'Mia Gonzalez', personality: 'photographer', homeRegion: 'central-coast', activityLevel: 'medium', background: 'Fine art photographer, captures Morro Bay moods' },
  { oldName: 'Tina C.', name: 'Natalie Foster', personality: 'traveler', homeRegion: 'socal-visitor', activityLevel: 'low', background: 'Australian expat, comparing Cali to home' },
  { oldName: 'Dawn Patrol', name: 'Jordan Rivera', personality: 'local', homeRegion: 'north-san-diego', activityLevel: 'high', background: 'High school teacher, Cardiff Reef is his office' },
  { oldName: 'Kai N.', name: 'Andre Williams', personality: 'competitor', homeRegion: 'south-san-diego', activityLevel: 'high', background: 'Former college athlete, training for pro-am' },
  { oldName: 'Emma F.', name: 'Sarah Tanaka', personality: 'rookie', homeRegion: 'sf-bay-area', activityLevel: 'medium', background: 'Startup founder, stress relief at Bolinas' },
  { oldName: 'Riley R.', name: 'Lauren Mitchell', personality: 'rookie', homeRegion: 'central-coast', activityLevel: 'medium', background: 'Yoga instructor, finding balance in the water' },
  { oldName: 'P. Martinez', name: 'Maya Johnson', personality: 'photographer', homeRegion: 'orange-county', activityLevel: 'medium', background: 'Content creator, golden hour at San Onofre' },
  { oldName: 'M. Johnson', name: 'Nina Okonkwo', personality: 'traveler', homeRegion: 'norcal-visitor', activityLevel: 'low', background: 'Journalist writing about California surf culture' },
  { oldName: 'Ryan K.', name: 'Jasmine Wu', personality: 'local', homeRegion: 'sf-bay-area', activityLevel: 'high', background: 'Marine biologist, surfs Lindamar year-round' },
  { oldName: null, name: 'Quiver Surf Forecast', personality: 'forecaster', homeRegion: 'all-regions', activityLevel: 'high', background: 'Daily California surf conditions from the Quiver team' }
];

// Posting windows by personality type (hours in PT)
export const POSTING_WINDOWS: Record<string, { primary: [number, number]; secondary: [number, number]; weekendBoost: boolean }> = {
  local: { primary: [5, 8], secondary: [16, 19], weekendBoost: true },
  rookie: { primary: [9, 12], secondary: [14, 17], weekendBoost: true },
  traveler: { primary: [7, 11], secondary: [15, 18], weekendBoost: false },
  photographer: { primary: [5, 7], secondary: [17, 20], weekendBoost: false },
  tactical: { primary: [5, 6], secondary: [11, 13], weekendBoost: false },
  competitor: { primary: [6, 9], secondary: [15, 18], weekendBoost: true },
  forecaster: { primary: [5, 6], secondary: [5, 6], weekendBoost: false }
};
