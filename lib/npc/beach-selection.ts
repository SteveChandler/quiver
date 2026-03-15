/**
 * Beach Selection Utility - 50% home, 35% secondary, 15% adventure
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
  if (roll < 0.50 || secondaryBeaches.length === 0) {
    // 50% — home beach
    return pickRandom(homeBeachIds);
  } else if (roll < 0.85) {
    // 35% — secondary/regional beach
    return pickRandom(secondaryBeaches);
  } else {
    // 15% — adventure: random from all region beaches (home + secondary combined)
    const all = [...homeBeachIds, ...secondaryBeaches];
    return pickRandom(all);
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
