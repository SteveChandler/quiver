/**
 * NPC System
 * Exports all NPC-related utilities
 */

export * from './posting-windows';
export {
  type NPCProfile,
  fetchEligibleNPCs,
  selectNPCsForCurrentHour,
  getBeachesForNPC,
  selectBeachForPost,
} from './npc-selection';
export * from './template-hydration';
export * from './forecast-formatter';
