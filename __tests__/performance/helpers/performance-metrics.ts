/**
 * Performance testing utilities for measuring component and API performance
 */

export interface PerformanceMetrics {
  duration: number;
  startTime: number;
  endTime: number;
}

export interface RenderMetrics extends PerformanceMetrics {
  componentName: string;
  rerenderCount?: number;
}

export interface APIMetrics extends PerformanceMetrics {
  endpoint: string;
  statusCode?: number;
  responseSize?: number;
}

/**
 * Measures the time it takes to execute a function
 */
export async function measurePerformance<T>(
  fn: () => T | Promise<T>,
  label?: string
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();

  const metrics: PerformanceMetrics = {
    duration: endTime - startTime,
    startTime,
    endTime,
  };

  if (label) {
    console.log(`[Performance] ${label}: ${metrics.duration.toFixed(2)}ms`);
  }

  return { result, metrics };
}

/**
 * Measures render time of a component
 */
export async function measureRenderTime(
  renderFn: () => void | Promise<void>,
  componentName: string
): Promise<RenderMetrics> {
  const startTime = performance.now();
  await renderFn();
  const endTime = performance.now();

  return {
    componentName,
    duration: endTime - startTime,
    startTime,
    endTime,
  };
}

/**
 * Measures API endpoint performance
 */
export async function measureAPIPerformance(
  endpoint: string,
  fetchFn: () => Promise<Response>
): Promise<APIMetrics> {
  const startTime = performance.now();
  const response = await fetchFn();
  const endTime = performance.now();

  let responseSize: number | undefined = undefined;
  try {
    const contentLength = response.headers?.get?.('content-length');
    responseSize = contentLength ? parseInt(contentLength, 10) : undefined;
  } catch (e) {
    // Headers might not be available in test environment
  }

  return {
    endpoint,
    duration: endTime - startTime,
    startTime,
    endTime,
    statusCode: response.status,
    responseSize,
  };
}

/**
 * Asserts that a performance metric meets an SLA threshold
 */
export function assertPerformanceSLA(
  metrics: PerformanceMetrics,
  maxDuration: number,
  label?: string
): void {
  const message = label
    ? `${label} exceeded SLA (${metrics.duration.toFixed(2)}ms > ${maxDuration}ms)`
    : `Performance exceeded SLA (${metrics.duration.toFixed(2)}ms > ${maxDuration}ms)`;

  if (metrics.duration > maxDuration) {
    throw new Error(message);
  }
}

/**
 * Generate mock data for performance testing
 */
export function generateMockBeaches(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `beach-${i}`,
    name: `Beach ${i}`,
    latitude: 33.0 + (Math.random() - 0.5) * 2,
    longitude: -117.0 + (Math.random() - 0.5) * 2,
    rating: Math.random() * 5,
    conditions: {
      waveHeight: Math.random() * 10,
      windSpeed: Math.random() * 20,
      temperature: 60 + Math.random() * 30,
    },
  }));
}

/**
 * Generate mock sessions for performance testing
 */
export function generateMockSessions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${i}`,
    beachId: `beach-${i % 100}`,
    userId: `user-${i % 50}`,
    rating: Math.floor(Math.random() * 5) + 1,
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    notes: `Test session ${i}`,
    photos: Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => ({
      id: `photo-${i}-${j}`,
      url: `https://example.com/photo-${i}-${j}.jpg`,
    })),
  }));
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  checkIntervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Measure frame rate during an operation
 */
export async function measureFrameRate(
  operation: () => Promise<void>,
  durationMs: number = 1000
): Promise<{ fps: number; frames: number }> {
  let frameCount = 0;
  const startTime = performance.now();
  let lastFrameTime = startTime;

  const measureFrame = () => {
    const now = performance.now();
    if (now - lastFrameTime >= 16.67) {
      // ~60fps threshold
      frameCount++;
      lastFrameTime = now;
    }

    if (now - startTime < durationMs) {
      requestAnimationFrame(measureFrame);
    }
  };

  requestAnimationFrame(measureFrame);
  await operation();

  const actualDuration = performance.now() - startTime;
  const fps = (frameCount / actualDuration) * 1000;

  return { fps, frames: frameCount };
}

/**
 * Performance thresholds for different types of operations
 */
export const PERFORMANCE_THRESHOLDS = {
  API: {
    READ: 300, // ms
    WRITE: 500, // ms
    SEARCH: 500, // ms
    BULK: 1000, // ms
  },
  PAGE_LOAD: {
    FCP: 1500, // First Contentful Paint
    LCP: 2500, // Largest Contentful Paint
    TTI: 3500, // Time to Interactive
    FID: 100, // First Input Delay
  },
  COMPONENT: {
    RENDER: 200, // ms for initial render
    UPDATE: 50, // ms for updates
    LIST_100: 200, // ms to render 100 items
    LIST_500: 1000, // ms to render 500 items
  },
  INTERACTION: {
    CLICK: 50, // ms response to click
    INPUT: 50, // ms response to input
    NAVIGATION: 100, // ms for route navigation
  },
  WEB_VITALS: {
    CLS: 0.1, // Cumulative Layout Shift
    FID: 100, // First Input Delay (ms)
    LCP: 2500, // Largest Contentful Paint (ms)
  },
} as const;
