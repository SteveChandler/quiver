import React from "react";
import { EnhancedForecastEntity, EnhancedForecast } from "@/types/database";

// Mock Forecast Table components
export const mockForecastTables = () => {
  jest.mock("@/components/forecast/forecast-table", () => ({
    MultiDayForecastTable: ({
      forecasts,
    }: {
      forecasts: EnhancedForecast[] | EnhancedForecastEntity[];
    }) => (
      <div data-testid="multi-day-forecast-table">
        Multi-day forecast table with {forecasts.length} forecasts
      </div>
    ),
    SimplifiedForecastTable: ({
      forecasts,
    }: {
      forecasts: EnhancedForecastEntity[];
    }) => (
      <div data-testid="simplified-forecast-table">
        Simplified forecast table with {forecasts.length} forecasts
      </div>
    ),
  }));
};

// Mock ForecastDataTransparency component
export const mockForecastDataTransparency = () => {
  jest.mock("@/components/ui/forecast-data-transparency", () => ({
    ForecastDataTransparency: ({
      dataSource,
      overallConfidence,
    }: {
      dataSource?: "NOAA_NWS" | "FALLBACK";
      overallConfidence?: number;
    }) => (
      <div data-testid="forecast-data-transparency">
        {dataSource && <span>Data source: {dataSource}</span>}
        {overallConfidence && (
          <span>Overall Confidence: {overallConfidence}%</span>
        )}
        <span>Data Quality</span>
      </div>
    ),
  }));
};

// Mock ForecastSection component (for landing page tests)
export const mockForecastSection = () => {
  jest.mock("@/components/landing-page/forecast-section", () => ({
    ForecastSection: () => (
      <div data-testid="forecast-section">Forecast Section</div>
    ),
  }));
};

// Mock BeachesEnhancedForecast component
export const mockBeachesEnhancedForecast = () => {
  jest.mock("@/components/beaches-enhanced-forecast", () => ({
    BeachesEnhancedForecast: ({
      beachId,
      beachName,
    }: {
      beachId?: string;
      beachName?: string;
    }) => (
      <div data-testid="beaches-enhanced-forecast">
        {beachId && beachName
          ? `Enhanced forecast for ${beachName}`
          : "Please select a beach to view enhanced forecasts"}
      </div>
    ),
  }));
};

// Mock Supabase client for components that use it
export const mockSupabaseClient = () => {
  jest.mock("@/lib/supabase/client", () => ({
    createClient: jest.fn(() => ({
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      channel: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      removeChannel: jest.fn(),
    })),
  }));
};

// Mock hooks commonly used in components
export const mockCommonHooks = () => {
  // Mock useDataFetcher hook
  jest.mock("@/hooks/use-data-fetcher", () => ({
    useDataFetcher: jest.fn(),
  }));

  // Mock useAuth hook
  jest.mock("@/context/auth-context", () => ({
    useAuth: jest.fn(),
    useOptionalAuth: jest.fn(),
  }));

  // Mock useCommentCount hook
  jest.mock("@/hooks/use-comment-count", () => ({
    useCommentCount: jest.fn(() => 0),
  }));

  // Mock useSessionLike hook
  jest.mock("@/hooks/use-session-like", () => ({
    useSessionLike: jest.fn(() => ({
      isLiked: false,
      likeCount: 0,
      handleToggleLike: jest.fn(),
    })),
  }));
};

// Mock Next.js components
export const mockNextJsComponents = () => {
  jest.mock("next/link", () => {
    return ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => <a href={href}>{children}</a>;
  });
};

// Mock session-related components
export const mockSessionComponents = () => {
  jest.mock("@/components/session-card-wrapper", () => ({
    SessionCardWrapper: ({ session, onUserClick }: any) => (
      <div data-testid="session-card" onClick={onUserClick}>
        <div>{session.beach?.name || session.beach_name}</div>
        <div>{session.rating}/5</div>
      </div>
    ),
  }));
};

// Mock journal components
export const mockJournalComponents = () => {
  jest.mock("@/components/journal/calendar-heatmap", () => ({
    CalendarHeatmap: ({
      onDateClick,
    }: {
      onDateClick: (date: string, sessions: unknown[]) => void;
    }) => (
      <div
        data-testid="calendar-heatmap"
        onClick={() => onDateClick("2024-01-15", [])}
      >
        Calendar Heatmap
      </div>
    ),
  }));

  jest.mock("@/components/journal/session-analytics", () => ({
    SessionAnalytics: ({ onRefresh }: { onRefresh: () => void }) => (
      <div data-testid="session-analytics">
        <button onClick={onRefresh} data-testid="refresh-analytics">
          Refresh Analytics
        </button>
      </div>
    ),
  }));

  jest.mock("@/components/journal/session-annotation-modal", () => ({
    SessionAnnotationModal: ({ isOpen, onClose, onSave }: any) =>
      isOpen ? (
        <div data-testid="annotation-modal">
          <button onClick={onSave} data-testid="save-annotation">
            Save
          </button>
          <button onClick={onClose} data-testid="close-annotation">
            Close
          </button>
        </div>
      ) : null,
  }));

};

// Comprehensive setup function for forecast-related tests
export const setupForecastComponentMocks = () => {
  mockForecastTables();
  mockForecastDataTransparency();
  mockBeachesEnhancedForecast();
};

// Comprehensive setup function for all common component mocks
export const setupAllComponentMocks = () => {
  setupForecastComponentMocks();
  mockSupabaseClient();
  mockCommonHooks();
  mockNextJsComponents();
  mockSessionComponents();
  mockJournalComponents();
  mockForecastSection();
};
