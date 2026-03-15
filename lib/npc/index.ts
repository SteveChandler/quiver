/**
 * NPC System
 * Exports all NPC-related utilities
 */

export * from './posting-windows';
export {
  type NPCProfile,
  type BeachRecord,
  fetchEligibleNPCs,
  selectNPCsForCurrentHour,
  getBeachesForNPC,
} from './npc-selection';
export * from './template-hydration';
export * from './forecast-formatter';
