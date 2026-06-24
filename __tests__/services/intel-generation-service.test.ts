/**
 * @jest-environment node
 */
function mockDateFnsFormat(
  dateInput: Date | string | number,
  pattern: string
): string {
  const date = new Date(dateInput);
  if (pattern === "yyyy-MM-dd") return date.toISOString().slice(0, 10);
  if (pattern === "HH:mm:ss") return date.toISOString().slice(11, 19);
  if (pattern === "HH:mm") return date.toISOString().slice(11, 16);
  return date.toISOString();
}

function mockAddDays(dateInput: Date | string | number, amount: number): Date {
  const date = new Date(dateInput);
  date.setUTCDate(date.getUTCDate() + amount);
  return date;
}

function mockParts(dateInput: Date | string | number, timeZone: string): Record<string, string> {
  const date = new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function mockFormatInTimeZone(
  dateInput: Date | string | number,
  timeZone: string,
  pattern: string
): string {
  const parts = mockParts(dateInput, timeZone);
  if (pattern === "yyyy-MM-dd") return `${parts.year}-${parts.month}-${parts.day}`;
  if (pattern === "HH:mm:ss") return `${parts.hour}:${parts.minute}:${parts.second}`;
  if (pattern === "HH:mm") return `${parts.hour}:${parts.minute}`;
  return new Date(dateInput).toISOString();
}

function mockFromZonedTime(
  dateInput: Date | string | number,
  timeZone: string
): Date {
  const local = new Date(dateInput);
  const utcGuess = Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
    local.getMilliseconds()
  );
  const zoneParts = mockParts(new Date(utcGuess), timeZone);
  const zoneAsUtc = Date.UTC(
    Number(zoneParts.year),
    Number(zoneParts.month) - 1,
    Number(zoneParts.day),
    Number(zoneParts.hour),
    Number(zoneParts.minute),
    Number(zoneParts.second)
  );
  return new Date(utcGuess - (zoneAsUtc - utcGuess));
}

jest.mock("date-fns", () => ({
  addDays: mockAddDays,
  format: mockDateFnsFormat,
  parseISO: (value: string) => new Date(value),
}));

jest.mock("date-fns/format", () => ({
  __esModule: true,
  default: mockDateFnsFormat,
  format: mockDateFnsFormat,
}));

jest.mock("date-fns/addDays", () => ({
  __esModule: true,
  default: mockAddDays,
  addDays: mockAddDays,
}));

jest.mock("date-fns-tz", () => ({
  formatInTimeZone: mockFormatInTimeZone,
  fromZonedTime: mockFromZonedTime,
  toZonedTime: (dateInput: Date | string | number) => new Date(dateInput),
}));

jest.mock("@/lib/analyzers/wind-analyzer", () => ({
  calculateOnOffshore: jest.fn(() => true),
  analyzeWindConditions: jest.fn(() => ({
    status: "optimal",
    emoji: "✅",
    message: "light winds",
  })),
  windAt: jest.fn(() => ({
    speed: 3,
    direction: 270,
    cardinal: "W",
    offshore: false,
    description: "light winds",
  })),
}));

import { IntelGenerationService } from "@/lib/services/intel-generation-service";

const mockFrom = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

interface MockQueryBuilder {
  select: jest.Mock<MockQueryBuilder, []>;
  eq: jest.Mock<MockQueryBuilder, []>;
  gte: jest.Mock<MockQueryBuilder, []>;
  lt: jest.Mock<MockQueryBuilder, []>;
  lte: jest.Mock<MockQueryBuilder, []>;
  order: jest.Mock<Promise<unknown>, []>;
  single: jest.Mock<Promise<unknown>, []>;
  maybeSingle: jest.Mock<Promise<unknown>, []>;
}

function queryBuilder(result: unknown): MockQueryBuilder {
  const builder = {} as MockQueryBuilder;
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.gte = jest.fn(() => builder);
  builder.lt = jest.fn(() => builder);
  builder.lte = jest.fn(() => builder);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  return builder;
}

describe("IntelGenerationService", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("generates local morning windows from UTC forecast rows", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "beaches") {
        return queryBuilder({
          data: {
            name: "Pacific Test Beach",
            swell_window_min_deg: null,
            swell_window_max_deg: null,
            wind_offshore_deg: null,
            wind_offshore_tol_deg: null,
            preferred_tide_ft_min: null,
            preferred_tide_ft_max: null,
            hazards: null,
            skill_level: null,
            break_type: "beach",
            aspect_deg: 270,
          },
          error: null,
        });
      }

      if (table === "enhanced_forecasts") {
        return queryBuilder({
          data: [
            {
              forecast_at: "2026-06-20T09:00:00.000Z",
              forecast_date: "2026-06-20",
              forecast_time: "09:00:00",
              wave_height: "3 ft",
              wave_period: "14s",
              wave_direction: "W",
              wind_speed: "3 mph",
              wind_direction: "W",
              tide_height: "3 ft",
              tide_status: "rising",
              next_tide_time: null,
              next_tide_type: null,
              next_tide_height: null,
              swell_1_height: "3 ft",
              swell_1_period: "14s",
              swell_1_direction: "W",
              swell_2_height: null,
              swell_2_period: null,
              swell_2_direction: null,
              confidence_score: 85,
            },
            {
              forecast_at: "2026-06-20T13:00:00.000Z",
              forecast_date: "2026-06-20",
              forecast_time: "13:00:00",
              wave_height: "3 ft",
              wave_period: "14s",
              wave_direction: "W",
              wind_speed: "3 mph",
              wind_direction: "W",
              tide_height: "3 ft",
              tide_status: "rising",
              next_tide_time: null,
              next_tide_type: null,
              next_tide_height: null,
              swell_1_height: "3 ft",
              swell_1_period: "14s",
              swell_1_direction: "W",
              swell_2_height: null,
              swell_2_period: null,
              swell_2_direction: null,
              confidence_score: 85,
            },
          ],
          error: null,
        });
      }

      if (table === "beach_water_quality") {
        return queryBuilder({ data: null, error: null });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const service = new IntelGenerationService("https://example.supabase.co", "test-key");

    const intel = await service.generateIntel(
      "beach-1",
      "06:00",
      "America/Los_Angeles"
    );

    expect(intel.bestWindow).toMatch(/^06:00/);
    expect(intel.bestWindow).not.toContain("09:00");
  });
});
