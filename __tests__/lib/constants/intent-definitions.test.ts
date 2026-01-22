// __tests__/lib/constants/intent-definitions.test.ts
import {
  INTENT_DEFINITIONS,
  INTENTS_BY_GROUP,
  INTENT_GROUPS,
  buildStateIntentUrl,
  buildCityIntentUrl,
  buildCityHubUrl,
  parseOldCitySlug,
  type IntentKey,
  type IntentDefinitionType,
} from '@/lib/constants/intent-definitions';

describe('intent-definitions', () => {
  describe('INTENT_DEFINITIONS', () => {
    it('should have exactly 7 intents', () => {
      expect(INTENT_DEFINITIONS).toHaveLength(7);
    });

    it('should have all required intent keys', () => {
      const keys = INTENT_DEFINITIONS.map(i => i.key);
      expect(keys).toContain('beginner');
      expect(keys).toContain('least-crowded');
      expect(keys).toContain('tide');
      expect(keys).toContain('water-temp');
      expect(keys).toContain('longboard');
      expect(keys).toContain('dawn-patrol');
      expect(keys).toContain('sunset');
    });

    it('should have valid group assignments', () => {
      const validGroups = Object.keys(INTENT_GROUPS);
      INTENT_DEFINITIONS.forEach(intent => {
        expect(validGroups).toContain(intent.group);
      });
    });
  });

  describe('INTENTS_BY_GROUP', () => {
    it('should have 3 session intents', () => {
      expect(INTENTS_BY_GROUP.session).toHaveLength(3);
    });

    it('should have 4 style intents', () => {
      expect(INTENTS_BY_GROUP.style).toHaveLength(4);
    });
  });

  describe('buildStateIntentUrl', () => {
    it('should build correct state intent URL', () => {
      expect(buildStateIntentUrl('beginner', 'ca')).toBe('/beginner/ca');
      expect(buildStateIntentUrl('sunset', 'hi')).toBe('/sunset/hi');
    });
  });

  describe('buildCityIntentUrl', () => {
    it('should build correct city intent URL', () => {
      expect(buildCityIntentUrl('beginner', 'san-diego')).toBe('/beginner/san-diego');
      expect(buildCityIntentUrl('sunset', 'honolulu')).toBe('/sunset/honolulu');
    });
  });

  describe('buildCityHubUrl', () => {
    it('should build correct city hub URL', () => {
      expect(buildCityHubUrl('ca', 'san-diego')).toBe('/beaches/usa/ca/san-diego');
    });
  });

  describe('parseOldCitySlug', () => {
    it('should parse simple city slug', () => {
      expect(parseOldCitySlug('san-diego')).toEqual({ city: 'san-diego' });
    });

    it('should parse collision-aware slug with state suffix', () => {
      expect(parseOldCitySlug('oceanside-ca')).toEqual({ city: 'oceanside', state: 'ca' });
      expect(parseOldCitySlug('oceanside-or')).toEqual({ city: 'oceanside', state: 'or' });
    });

    it('should return null for empty input', () => {
      expect(parseOldCitySlug('')).toBeNull();
    });
  });
});
