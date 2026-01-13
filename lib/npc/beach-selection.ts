/**
 * Beach Selection Utility - 70% home, 25% secondary, 5% adventure
 */

export interface NPCBeachConfig {
  homeBeachIds: string[];
  secondaryBeaches: string[];
  homeRegion: string;
}

export function selectBeachForPost(config: NPCBeachConfig): string {
  const { homeBeachIds, secondaryBeaches } = config;
  if (!homeBeachIds.length) throw new Error('NPC must have at least one home beach');

  const roll = Math.random();
  if (roll < 0.70 || secondaryBeaches.length === 0) {
    return pickRandom(homeBeachIds);
  } else if (roll < 0.95) {
    return pickRandom(secondaryBeaches);
  } else {
    return secondaryBeaches.length > 0 ? pickRandom(secondaryBeaches) : pickRandom(homeBeachIds);
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
