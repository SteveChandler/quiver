import { generateInsights, ProgressionData, ProgressionInsight } from '@/lib/progression/insight-generator';

const emptyData: ProgressionData = {
  skillTrends: [],
  forecastAccuracy: null,
  sweetSpot: null,
  sessionCount: 0,
  totalHours: 0,
};

describe('generateInsights', () => {
  it('returns empty array when no data', () => {
    expect(generateInsights(emptyData)).toEqual([]);
  });

  it('generates skill improvement insight when trend > 0.5', () => {
    const data: ProgressionData = {
      ...emptyData,
      skillTrends: [
        { skill: 'paddling', currentAvg: 7.5, previousAvg: 6.0, count: 5 },
      ],
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('skill_improvement');
    expect(insights[0].title).toBe('paddling Improving');
    expect(insights[0].description).toContain('1.5');
    expect(insights[0].description).toContain('5 sessions');
    expect(insights[0].shareableText).toContain('1.5');
    expect(insights[0].shareableText).toContain('Quiver');
  });

  it('does not generate skill insight when trend <= 0.5', () => {
    const data: ProgressionData = {
      ...emptyData,
      skillTrends: [
        { skill: 'paddling', currentAvg: 6.4, previousAvg: 6.0, count: 5 },
      ],
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(0);
  });

  it('does not generate skill insight when count < 3', () => {
    const data: ProgressionData = {
      ...emptyData,
      skillTrends: [
        { skill: 'paddling', currentAvg: 8.0, previousAvg: 6.0, count: 2 },
      ],
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(0);
  });

  it('generates forecast accuracy insight when improving', () => {
    const data: ProgressionData = {
      ...emptyData,
      forecastAccuracy: { current: 85, previous: 70 },
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('forecast_accuracy');
    expect(insights[0].title).toBe('Forecast Accuracy Up');
    expect(insights[0].description).toContain('15%');
    expect(insights[0].shareableText).toContain('15%');
    expect(insights[0].shareableText).toContain('Quiver');
    expect(insights[0].priority).toBe(8);
  });

  it('does not generate forecast accuracy insight when not improving', () => {
    const data: ProgressionData = {
      ...emptyData,
      forecastAccuracy: { current: 70, previous: 85 },
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(0);
  });

  it('generates sweet spot insight when confidence > 0.5', () => {
    const data: ProgressionData = {
      ...emptyData,
      sweetSpot: {
        waveHeight: '3-5ft',
        tide: 'mid',
        wind: 'offshore',
        confidence: 0.75,
      },
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('sweet_spot');
    expect(insights[0].title).toBe('Sweet Spot Found');
    expect(insights[0].description).toContain('75%');
    expect(insights[0].description).toContain('3-5ft');
    expect(insights[0].description).toContain('offshore');
    expect(insights[0].shareableText).toContain('3-5ft');
    expect(insights[0].shareableText).toContain('offshore');
    expect(insights[0].shareableText).toContain('Quiver');
    expect(insights[0].priority).toBe(7);
  });

  it('generates sweet spot insight with bestBeach when provided', () => {
    const data: ProgressionData = {
      ...emptyData,
      sweetSpot: {
        waveHeight: '2-3ft',
        tide: 'low',
        wind: 'light',
        confidence: 0.8,
        bestBeach: 'Blacks Beach',
      },
    };
    const insights = generateInsights(data);
    expect(insights[0].description).toContain('Blacks Beach');
  });

  it('does not generate sweet spot insight when confidence <= 0.5', () => {
    const data: ProgressionData = {
      ...emptyData,
      sweetSpot: {
        waveHeight: '3-5ft',
        tide: 'mid',
        wind: 'offshore',
        confidence: 0.5,
      },
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(0);
  });

  it('generates volume insight for milestone session counts (10, 25, 50, 100)', () => {
    const milestones = [10, 25, 50, 100, 250, 500];
    for (const count of milestones) {
      const data: ProgressionData = {
        ...emptyData,
        sessionCount: count,
        totalHours: count * 1.5,
      };
      const insights = generateInsights(data);
      expect(insights).toHaveLength(1);
      expect(insights[0].type).toBe('volume');
      expect(insights[0].title).toBe(`${count} Sessions!`);
      expect(insights[0].description).toContain(`${count} sessions`);
      expect(insights[0].shareableText).toContain(`${count}`);
      expect(insights[0].shareableText).toContain('Quiver');
      expect(insights[0].priority).toBe(6);
    }
  });

  it('does not generate volume insight for non-milestone session counts', () => {
    const data: ProgressionData = {
      ...emptyData,
      sessionCount: 11,
      totalHours: 20,
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(0);
  });

  it('sorts insights by priority descending', () => {
    const data: ProgressionData = {
      skillTrends: [
        { skill: 'paddling', currentAvg: 7.5, previousAvg: 6.0, count: 5 },
      ],
      forecastAccuracy: { current: 85, previous: 70 },
      sweetSpot: {
        waveHeight: '3-5ft',
        tide: 'mid',
        wind: 'offshore',
        confidence: 0.75,
      },
      sessionCount: 10,
      totalHours: 20,
    };
    const insights = generateInsights(data);
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i - 1].priority).toBeGreaterThanOrEqual(insights[i].priority);
    }
  });

  it('caps at max 5 insights', () => {
    const data: ProgressionData = {
      skillTrends: [
        { skill: 'paddling', currentAvg: 9.0, previousAvg: 6.0, count: 5 },
        { skill: 'popping up', currentAvg: 8.5, previousAvg: 6.0, count: 4 },
        { skill: 'cutback', currentAvg: 8.0, previousAvg: 6.0, count: 3 },
        { skill: 'duck dive', currentAvg: 7.5, previousAvg: 6.0, count: 4 },
      ],
      forecastAccuracy: { current: 85, previous: 70 },
      sweetSpot: {
        waveHeight: '3-5ft',
        tide: 'mid',
        wind: 'offshore',
        confidence: 0.75,
      },
      sessionCount: 10,
      totalHours: 20,
    };
    const insights = generateInsights(data);
    expect(insights.length).toBeLessThanOrEqual(5);
  });

  it('each insight has shareableText property', () => {
    const data: ProgressionData = {
      skillTrends: [
        { skill: 'paddling', currentAvg: 7.5, previousAvg: 6.0, count: 5 },
      ],
      forecastAccuracy: { current: 85, previous: 70 },
      sweetSpot: {
        waveHeight: '3-5ft',
        tide: 'mid',
        wind: 'offshore',
        confidence: 0.75,
      },
      sessionCount: 10,
      totalHours: 20,
    };
    const insights = generateInsights(data);
    for (const insight of insights) {
      expect(typeof insight.shareableText).toBe('string');
      expect(insight.shareableText.length).toBeGreaterThan(0);
    }
  });

  it('handles multiple skill improvements', () => {
    const data: ProgressionData = {
      ...emptyData,
      skillTrends: [
        { skill: 'paddling', currentAvg: 7.5, previousAvg: 6.0, count: 5 },
        { skill: 'popping up', currentAvg: 8.0, previousAvg: 6.5, count: 4 },
      ],
    };
    const insights = generateInsights(data);
    expect(insights).toHaveLength(2);
    const types = insights.map((i) => i.type);
    expect(types).toEqual(['skill_improvement', 'skill_improvement']);
  });
});
