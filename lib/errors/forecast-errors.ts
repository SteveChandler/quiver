// Custom error classes for the enhanced forecast system

export enum ForecastErrorCode {
  // Data source errors
  WAVE_DATA_UNAVAILABLE = "WAVE_DATA_UNAVAILABLE",
  TIDE_DATA_UNAVAILABLE = "TIDE_DATA_UNAVAILABLE",
  WEATHER_DATA_UNAVAILABLE = "WEATHER_DATA_UNAVAILABLE",

  // API errors
  NOAA_API_ERROR = "NOAA_API_ERROR",
  WAVEWATCH_API_ERROR = "WAVEWATCH_API_ERROR",
  COOPS_API_ERROR = "COOPS_API_ERROR",

  // Validation errors
  INVALID_LOCATION = "INVALID_LOCATION",
  INVALID_TIME_RANGE = "INVALID_TIME_RANGE",
  INVALID_BEACH_ID = "INVALID_BEACH_ID",
  INVALID_CONFIDENCE_SCORE = "INVALID_CONFIDENCE_SCORE",

  // Processing errors
  FORECAST_GENERATION_FAILED = "FORECAST_GENERATION_FAILED",
  STORAGE_FAILED = "STORAGE_FAILED",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // General errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface ForecastErrorContext {
  readonly beachId?: string;
  readonly location?: { lat: number; lng: number };
  readonly timeRange?: { start: Date; end: Date };
  readonly dataSource?: string;
  readonly apiUrl?: string;
  readonly statusCode?: number;
  readonly retryAfter?: number;
  readonly correlationId?: string;
}

export class ForecastError extends Error {
  readonly code: ForecastErrorCode;
  readonly context: ForecastErrorContext;
  readonly timestamp: Date;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: ForecastErrorCode,
    context: ForecastErrorContext = {},
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = "ForecastError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.isRetryable = isRetryable;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForecastError);
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ForecastErrorCode.WAVE_DATA_UNAVAILABLE:
        return "Wave forecast data is temporarily unavailable. Please try again later.";

      case ForecastErrorCode.TIDE_DATA_UNAVAILABLE:
        return "Tide information is temporarily unavailable. Please try again later.";

      case ForecastErrorCode.WEATHER_DATA_UNAVAILABLE:
        return "Weather forecast data is temporarily unavailable. Please try again later.";

      case ForecastErrorCode.NOAA_API_ERROR:
        return "Weather service is temporarily unavailable. Please try again later.";

      case ForecastErrorCode.INVALID_LOCATION:
        return "Invalid location provided. Please check the coordinates.";

      case ForecastErrorCode.INVALID_BEACH_ID:
        return "Beach not found. Please select a valid beach.";

      case ForecastErrorCode.RATE_LIMIT_EXCEEDED:
        return "Too many requests. Please wait before trying again.";

      case ForecastErrorCode.FORECAST_GENERATION_FAILED:
        return "Unable to generate forecast. Please try again later.";

      default:
        return "An unexpected error occurred. Please try again later.";
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      isRetryable: this.isRetryable,
      stack: this.stack,
    };
  }
}

// Specific error classes for different scenarios

export class DataSourceError extends ForecastError {
  constructor(
    dataSource: string,
    originalError: Error,
    context: ForecastErrorContext = {}
  ) {
    const code = DataSourceError.getCodeForDataSource(dataSource);
    const message = `${dataSource} data source failed: ${originalError.message}`;

    super(message, code, { ...context, dataSource }, true);
    this.name = "DataSourceError";
  }

  private static getCodeForDataSource(dataSource: string): ForecastErrorCode {
    switch (dataSource.toLowerCase()) {
      case "wavewatch":
        return ForecastErrorCode.WAVEWATCH_API_ERROR;
      case "coops":
        return ForecastErrorCode.COOPS_API_ERROR;
      case "noaa":
        return ForecastErrorCode.NOAA_API_ERROR;
      default:
        return ForecastErrorCode.UNKNOWN_ERROR;
    }
  }
}

export class ValidationError extends ForecastError {
  constructor(
    field: string,
    value: any,
    constraint: string,
    context: ForecastErrorContext = {}
  ) {
    const message = `Validation failed for ${field}: ${constraint}. Received: ${value}`;
    const code = ValidationError.getCodeForField(field);

    super(message, code, context, false);
    this.name = "ValidationError";
  }

  private static getCodeForField(field: string): ForecastErrorCode {
    switch (field.toLowerCase()) {
      case "location":
      case "latitude":
      case "longitude":
        return ForecastErrorCode.INVALID_LOCATION;
      case "beachid":
      case "beach_id":
        return ForecastErrorCode.INVALID_BEACH_ID;
      case "confidence":
      case "confidence_score":
        return ForecastErrorCode.INVALID_CONFIDENCE_SCORE;
      case "timerange":
      case "time_range":
        return ForecastErrorCode.INVALID_TIME_RANGE;
      default:
        return ForecastErrorCode.UNKNOWN_ERROR;
    }
  }
}

export class ApiError extends ForecastError {
  constructor(
    apiUrl: string,
    statusCode: number,
    responseText: string,
    context: ForecastErrorContext = {}
  ) {
    const message = `API request failed: ${statusCode} ${responseText}`;
    const code = ApiError.getCodeForStatus(statusCode);
    const isRetryable = ApiError.isRetryableStatus(statusCode);

    super(message, code, { ...context, apiUrl, statusCode }, isRetryable);
    this.name = "ApiError";
  }

  private static getCodeForStatus(statusCode: number): ForecastErrorCode {
    if (statusCode === 429) {
      return ForecastErrorCode.RATE_LIMIT_EXCEEDED;
    }
    if (statusCode >= 500) {
      return ForecastErrorCode.NOAA_API_ERROR;
    }
    return ForecastErrorCode.UNKNOWN_ERROR;
  }

  private static isRetryableStatus(statusCode: number): boolean {
    // Retry on server errors and rate limiting
    return statusCode >= 500 || statusCode === 429;
  }
}

/**
 * NOAA Weather Service can return 404 InvalidPoint when a lat/lon is outside its supported coverage.
 * We treat this as "no coverage" (non-retryable, expected for some regions) rather than a hard failure.
 */
export function isNoaaInvalidPointError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  const status = error.context?.statusCode;
  const apiUrl = error.context?.apiUrl || "";
  if (status !== 404) return false;

  // This is the NWS "points" endpoint that returns gridpoint metadata.
  if (!apiUrl.includes("api.weather.gov/points/")) return false;

  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("invalidpoint") ||
    msg.includes("data unavailable for requested point") ||
    msg.includes("https://api.weather.gov/problems/invalidpoint")
  );
}

/**
 * NOAA Weather Service sometimes returns a 404 for gridpoint hourly forecasts in marine areas:
 * "Marine Forecast Not Supported". This is expected for some coast/offshore points and should
 * be treated as "no hourly coverage" rather than a hard failure.
 */
export function isNoaaMarineForecastNotSupportedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  const status = error.context?.statusCode;
  const apiUrl = error.context?.apiUrl || "";
  if (status !== 404) return false;

  // This is the NWS gridpoints forecast endpoint (hourly OR non-hourly variant).
  // We see both in production:
  // - /gridpoints/{office}/{x},{y}/forecast/hourly
  // - /gridpoints/{office}/{x},{y}/forecast
  const urlLower = apiUrl.toLowerCase();
  if (!urlLower.includes("api.weather.gov/gridpoints/")) return false;
  const isForecastEndpoint =
    urlLower.includes("/forecast/hourly") ||
    urlLower.endsWith("/forecast") ||
    urlLower.includes("/forecast?");
  if (!isForecastEndpoint) return false;

  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("marine forecast not supported") ||
    msg.includes("marineforecastnotsupported") ||
    msg.includes("https://api.weather.gov/problems/marineforecastnotsupported")
  );
}

export class StorageError extends ForecastError {
  constructor(
    operation: string,
    originalError: Error,
    context: ForecastErrorContext = {}
  ) {
    const message = `Storage operation '${operation}' failed: ${originalError.message}`;

    super(message, ForecastErrorCode.STORAGE_FAILED, context, true);
    this.name = "StorageError";
  }
}

// Helper functions for error handling

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorContext: ForecastErrorContext = {}
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ForecastError) {
        // Add additional context to existing forecast errors
        throw new ForecastError(
          error.message,
          error.code,
          { ...error.context, ...errorContext },
          error.isRetryable
        );
      }

      // Convert unknown errors to ForecastError
      throw new ForecastError(
        error instanceof Error ? error.message : "Unknown error occurred",
        ForecastErrorCode.UNKNOWN_ERROR,
        errorContext,
        false
      );
    }
  };
}

/**
 * Create retry logic for retryable errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  // Use shorter delays and fewer retries in test environment
  const actualDelayMs = process.env.NODE_ENV === "test" ? 10 : delayMs;
  const actualMaxRetries = process.env.NODE_ENV === "test" ? 1 : maxRetries;
  let lastError: Error;

  for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a retryable error
      if (error instanceof ForecastError && !error.isRetryable) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === actualMaxRetries) {
        break;
      }

      // Wait before retrying (with exponential backoff)
      const delay = actualDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Log errors with proper context
 */
export function logError(
  error: ForecastError | Error | unknown,
  additionalContext?: Record<string, any>
) {
  if (error instanceof ForecastError) {
    const logData = {
      ...error.toJSON(),
      ...additionalContext,
    };
    console.error(`[ForecastError] ${error.code}: ${error.message}`, logData);
  } else if (error instanceof Error) {
    const logData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...additionalContext,
    };
    console.error(`[Error] ${error.message}`, logData);
  } else {
    console.error(`[UnknownError]`, { error, ...additionalContext });
  }
}
