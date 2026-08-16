# Error Handling Library Architecture

## 🎯 **PURPOSE**

The `/lib/errors` directory provides comprehensive error handling utilities with structured error types, context management, and user-friendly error messaging for the Quiver surf community platform.

## 📁 **DIRECTORY STRUCTURE**

```
lib/errors/
└── forecast-errors.ts    # Forecast-specific error handling with comprehensive error types
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Structured Error Hierarchy**

```typescript
ErrorSystem
├── Base Error Classes
│   ├── ForecastError (Base class with context)
│   ├── DataSourceError (External API failures)
│   ├── ValidationError (Input validation failures)
│   ├── ApiError (HTTP/API specific errors)
│   └── StorageError (Database/storage failures)
├── Error Context Management
│   ├── Contextual Information (location, timeRange, dataSource)
│   ├── Correlation IDs (debugging and tracing)
│   └── Retry Logic (isRetryable flag and backoff)
└── User Experience
    ├── User-Friendly Messages
    ├── Error Recovery Suggestions
    └── Logging and Monitoring
```

### **Error Code Classification**

```typescript
ErrorClassification
├── Data Source Errors (WAVE_DATA_UNAVAILABLE, TIDE_DATA_UNAVAILABLE)
├── API Errors (NOAA_API_ERROR, WAVEWATCH_API_ERROR)
├── Validation Errors (INVALID_LOCATION, INVALID_TIME_RANGE)
├── Processing Errors (FORECAST_GENERATION_FAILED, DATA_COMBINATION_FAILED)
├── Rate Limiting (RATE_LIMIT_EXCEEDED)
└── General Errors (UNKNOWN_ERROR)
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **ForecastError** (Base Error Class)

- **Purpose**: Foundational error class with comprehensive context management
- **Features**:
  - Structured error codes and context
  - User-friendly message generation
  - Retry logic support
  - JSON serialization for logging

**Core Implementation:**

```typescript
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
  }

  getUserMessage(): string {
    switch (this.code) {
      case ForecastErrorCode.WAVE_DATA_UNAVAILABLE:
        return "Wave forecast data is temporarily unavailable. Please try again later.";
      case ForecastErrorCode.INVALID_LOCATION:
        return "The specified location is not valid. Please check the coordinates and try again.";
      case ForecastErrorCode.RATE_LIMIT_EXCEEDED:
        return `Too many requests. Please wait ${
          this.context.retryAfter || 60
        } seconds before trying again.`;
      default:
        return "An unexpected error occurred while generating the forecast. Please try again.";
    }
  }

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
```

### **Specialized Error Classes**

#### **DataSourceError**

- **Purpose**: Handles external data source failures (NOAA, CDIP, etc.)
- **Features**: Automatic error code mapping based on data source

```typescript
export class DataSourceError extends ForecastError {
  constructor(
    dataSource: string,
    originalError: Error,
    context: ForecastErrorContext = {}
  ) {
    super(
      `Data source '${dataSource}' error: ${originalError.message}`,
      DataSourceError.getCodeForDataSource(dataSource),
      { ...context, dataSource },
      true // Data source errors are usually retryable
    );
  }

  private static getCodeForDataSource(dataSource: string): ForecastErrorCode {
    switch (dataSource.toLowerCase()) {
      case "noaa":
      case "wavewatch":
        return ForecastErrorCode.WAVEWATCH_API_ERROR;
      case "coops":
      case "tides":
        return ForecastErrorCode.COOPS_API_ERROR;
      case "cdip":
      case "buoy":
        return ForecastErrorCode.BUOY_DATA_UNAVAILABLE;
      default:
        return ForecastErrorCode.UNKNOWN_ERROR;
    }
  }
}
```

#### **ValidationError**

- **Purpose**: Input validation with context-aware error messages
- **Features**: Field-specific error codes and user guidance

```typescript
export class ValidationError extends ForecastError {
  constructor(
    field: string,
    value: any,
    constraint: string,
    context: ForecastErrorContext = {}
  ) {
    super(
      `Validation failed for ${field}: ${constraint} (received: ${value})`,
      ValidationError.getCodeForField(field),
      context,
      false // Validation errors are not retryable without fixing input
    );
  }

  private static getCodeForField(field: string): ForecastErrorCode {
    switch (field.toLowerCase()) {
      case "latitude":
      case "longitude":
      case "location":
        return ForecastErrorCode.INVALID_LOCATION;
      case "time":
      case "date":
      case "timerange":
        return ForecastErrorCode.INVALID_TIME_RANGE;
      case "beachid":
        return ForecastErrorCode.INVALID_BEACH_ID;
      default:
        return ForecastErrorCode.UNKNOWN_ERROR;
    }
  }
}
```

#### **ApiError**

- **Purpose**: HTTP API error handling with status code mapping
- **Features**: Automatic retry determination based on HTTP status

```typescript
export class ApiError extends ForecastError {
  constructor(
    apiUrl: string,
    statusCode: number,
    responseText: string,
    context: ForecastErrorContext = {}
  ) {
    super(
      `API request failed: ${statusCode} - ${responseText}`,
      ApiError.getCodeForStatus(statusCode),
      { ...context, apiUrl, statusCode },
      ApiError.isRetryableStatus(statusCode)
    );
  }

  private static getCodeForStatus(statusCode: number): ForecastErrorCode {
    if (statusCode >= 500) return ForecastErrorCode.NOAA_API_ERROR;
    if (statusCode === 429) return ForecastErrorCode.RATE_LIMIT_EXCEEDED;
    return ForecastErrorCode.UNKNOWN_ERROR;
  }

  private static isRetryableStatus(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }
}
```

### **Error Context Management**

```typescript
export interface ForecastErrorContext {
  readonly beachId?: string;
  readonly location?: { lat: number; lng: number };
  readonly timeRange?: { start: Date; end: Date };
  readonly dataSource?: string;
  readonly apiUrl?: string;
  readonly statusCode?: number;
  readonly retryAfter?: number;
  readonly correlationId?: string;
}
```

## 🛠️ **UTILITY FUNCTIONS**

### **Error Handling Wrapper**

```typescript
export function withForecastErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorContext: ForecastErrorContext = {}
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ForecastError) {
        // Re-throw with additional context
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
```

### **Retry Logic Implementation**

```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof ForecastError) {
    return error.isRetryable;
  }

  // Network errors are generally retryable
  if (error instanceof Error) {
    return (
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("connection")
    );
  }

  return false;
}
```

### **Logging and Monitoring**

```typescript
export function logError(
  error: ForecastError,
  additionalContext?: Record<string, any>
) {
  const logData = {
    ...error.toJSON(),
    ...(additionalContext && { additionalContext }),
  };

  if (error.code === ForecastErrorCode.RATE_LIMIT_EXCEEDED) {
    console.warn("Rate limit exceeded:", logData);
  } else if (error.isRetryable) {
    console.warn("Retryable error occurred:", logData);
  } else {
    console.error("Non-retryable error occurred:", logData);
  }

  // In production, send to monitoring service
  if (process.env.NODE_ENV === "production") {
    // sendToMonitoringService(logData);
  }
}
```

## 🚀 **USAGE PATTERNS**

### **API Error Handling**

```typescript
// Forecast service with comprehensive error handling
async function fetchWaveData(location: { lat: number; lng: number }) {
  const operation = withForecastErrorHandling(
    async () => {
      const response = await fetch(
        `/api/waves?lat=${location.lat}&lng=${location.lng}`
      );

      if (!response.ok) {
        throw new ApiError(
          response.url,
          response.status,
          await response.text(),
          { location }
        );
      }

      return response.json();
    },
    { location, dataSource: "NOAA WaveWatch" }
  );

  return withRetry(operation, 3, 1000);
}
```

### **Validation with Context**

```typescript
function validateBeachLocation(beachId: string, lat: number, lng: number) {
  if (!beachId) {
    throw new ValidationError("beachId", beachId, "Beach ID is required", {
      location: { lat, lng },
    });
  }

  if (lat < -90 || lat > 90) {
    throw new ValidationError(
      "latitude",
      lat,
      "Latitude must be between -90 and 90",
      { beachId, location: { lat, lng } }
    );
  }

  if (lng < -180 || lng > 180) {
    throw new ValidationError(
      "longitude",
      lng,
      "Longitude must be between -180 and 180",
      { beachId, location: { lat, lng } }
    );
  }
}
```

### **User-Friendly Error Display**

```typescript
function ErrorBoundary({ error }: { error: ForecastError }) {
  return (
    <div className="error-container">
      <h3>Forecast Unavailable</h3>
      <p>{error.getUserMessage()}</p>

      {error.isRetryable && (
        <button onClick={() => window.location.reload()}>Try Again</button>
      )}

      {error.context.retryAfter && (
        <p className="retry-info">
          Please wait {error.context.retryAfter} seconds before retrying.
        </p>
      )}
    </div>
  );
}
```

## 🧪 **TESTING STRATEGIES**

### **Error Creation Testing**

- Test all error constructors with various contexts
- Verify error code mapping logic
- Test user message generation
- Validate JSON serialization

### **Error Handling Testing**

- Test retry logic with different error types
- Verify error propagation through wrappers
- Test logging functionality
- Validate error boundary behavior

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Internationalization for error messages
- Error analytics and trending
- Custom error recovery strategies
- Integration with external monitoring
- Error correlation across services

### **Performance Improvements**

- Error message caching
- Efficient error serialization
- Memory optimization for large error contexts
- Async error logging

## 🏆 **BEST PRACTICES**

### **Error Handling Guidelines**

1. **Specific Error Types**: Use specialized error classes for different scenarios
2. **Rich Context**: Include relevant context for debugging and user guidance
3. **User Experience**: Provide helpful error messages and recovery options
4. **Logging**: Comprehensive logging for monitoring and debugging
5. **Testing**: Thorough testing of error scenarios and edge cases

### **Error Recovery Guidelines**

1. **Retry Logic**: Implement intelligent retry strategies
2. **Fallback Data**: Provide fallback options when possible
3. **User Feedback**: Clear communication about error states
4. **Graceful Degradation**: Continue operation with reduced functionality
5. **Monitoring**: Track error patterns for system improvements

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive error handling  
**Next Review**: After internationalization and monitoring integration
