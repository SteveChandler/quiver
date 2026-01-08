# Sessions API - GET /api/sessions/[id]

## Overview

Retrieves a single session by ID, including all related data and forecast snapshot information.

## Authentication

**Required:** Yes - User must be authenticated and own the session.

## Endpoint

```
GET /api/sessions/[id]
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Session ID (URL parameter) |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "session": {
    "id": "session-uuid",
    "user_id": "user-uuid",
    "beach_id": "beach-uuid",
    "arrival_time": "2024-01-15T14:00:00Z",
    "wave_height_ft": 5.0,
    "wind_speed_mph": 12,
    "wind_direction": "W",
    "tide_height_ft": 3.2,
    "tide_status": "rising",
    "rating": 4,
    "notes": "Great session!",
    "beach": {
      "id": "beach-uuid",
      "name": "Blacks Beach",
      "latitude": 32.8878,
      "longitude": -117.2520
    },
    "board": {
      "id": "board-uuid",
      "name": "6'2\" Shortboard",
      "board_type": "shortboard"
    },
    "user": {
      "id": "user-uuid",
      "full_name": "John Doe"
    },
    "forecast_snapshot": {
      "forecast_snapshot": {
        "wave_height": "3.5",
        "wave_period": "12",
        "wave_direction": "270",
        "wind_speed_mph": 10,
        "wind_direction": "NW",
        "tide_height": "2.8",
        "tide_status": "rising",
        "confidence_score": 85,
        "data_source": "CDIP"
      },
      "actual_conditions": {
        "wave_height_ft": 5.0,
        "wind_speed_mph": 12,
        "wind_direction": "W",
        "tide_height_ft": 3.2,
        "tide_status": "rising",
        "rating": 4,
        "notes": "Great session!"
      },
      "forecast_vs_actual": {
        "wave_height_ft": {
          "forecast": 3.5,
          "actual": 5.0,
          "diff": 1.5
        },
        "wind_speed_mph": {
          "forecast": 10,
          "actual": 12,
          "diff": 2
        },
        "wind_direction": {
          "forecast": "NW",
          "actual": "W"
        },
        "tide_height_ft": {
          "forecast": 2.8,
          "actual": 3.2,
          "diff": 0.4
        }
      },
      "forecast_confidence_score": 85,
      "data_source": "CDIP"
    }
  }
}
```

### Session Without Forecast Snapshot

If no forecast snapshot exists (older sessions or sessions where forecast data was unavailable), the `forecast_snapshot` field will be `null`:

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "session": {
    "id": "session-uuid",
    // ... other session fields ...
    "forecast_snapshot": null
  }
}
```

## Forecast Snapshot Details

### `forecast_snapshot` Object

The forecast snapshot contains three main sections:

#### 1. `forecast_snapshot`
Complete forecast conditions at the time of the session. This is the raw forecast data from CDIP, NOAA, or other sources.

**Fields:**
- `wave_height`: String - Wave height in feet
- `wave_period`: String - Wave period in seconds
- `wave_direction`: String - Wave direction in degrees
- `wind_speed_mph`: Number - Wind speed in mph
- `wind_direction`: String - Wind direction (e.g., "NW", "SSW")
- `tide_height`: String - Tide height in feet
- `tide_status`: String - Tide status ("rising", "falling", "high", "low")
- `confidence_score`: Number - Forecast confidence (0-100)
- `data_source`: String - Data source ("CDIP", "NOAA", etc.)

#### 2. `actual_conditions`
The actual conditions as recorded by the user when they logged the session.

**Fields:**
- `wave_height_ft`: Number - Actual wave height reported
- `wind_speed_mph`: Number - Actual wind speed reported
- `wind_direction`: String - Actual wind direction reported
- `tide_height_ft`: Number - Actual tide height reported
- `tide_status`: String - Actual tide status reported
- `rating`: Number - Session rating (1-5)
- `notes`: String - User's notes

#### 3. `forecast_vs_actual`
Calculated differences between forecast and actual conditions. **Only includes fields where the user changed the prefilled forecast value.**

**Structure:**
- For numeric fields: `{ forecast: number, actual: number, diff: number }`
- For string fields: `{ forecast: string, actual: string }`

**Example:**
If the forecast predicted 3.5ft waves but the user changed it to 5.0ft, this object will include:
```json
"wave_height_ft": {
  "forecast": 3.5,
  "actual": 5.0,
  "diff": 1.5
}
```

If the user didn't change a prefilled value (it matches the forecast), that field will not appear in `forecast_vs_actual`.

## Error Responses

### 400 Bad Request
Invalid session ID format:
```json
{
  "success": false,
  "error": "Invalid session ID: must be a valid UUID",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### 401 Unauthorized
User not authenticated:
```json
{
  "success": false,
  "error": "Unauthorized",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### 404 Not Found
Session doesn't exist or user doesn't own it:
```json
{
  "success": false,
  "error": "Session not found",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

## Use Cases

### 1. Displaying Session Details
Show users their past surf sessions with complete context about conditions.

### 2. Forecast Accuracy Analysis
Compare forecast predictions to actual conditions to improve future forecasts.

### 3. Auto-fill Session Forms
Use forecast data to pre-populate session forms when users log a new session.

### 4. Personal Surf Analytics
Track how actual conditions compare to forecasts over time to identify patterns.

## Implementation Notes

- The `session_forecast_snapshots` table has a 1:1 relationship with `sessions` via `session_id`
- Snapshots are automatically created when a session is marked as "completed"
- The snapshot creation uses the closest forecast (by time) to the session's `arrival_time`
- Only numeric differences are calculated for the `diff` field; string comparisons just show both values
- Tide status fields are compared as strings (e.g., "rising" vs "falling")

## Related Endpoints

- `POST /api/sessions` - Create a new session
- `PATCH /api/sessions/[id]` - Update a session
- `DELETE /api/sessions/[id]` - Delete a session
- `GET /api/sessions` - List user's sessions

## Database Tables

- `sessions` - Main session data
- `session_forecast_snapshots` - Forecast snapshot data
- `enhanced_forecasts` - Source forecast data
- `beaches` - Beach information
- `boards` - User's surfboards
- `profiles` - User profiles

## See Also

- [Forecast Snapshot Utils](/lib/utils/forecast-snapshot-utils.ts) - Snapshot creation logic
- [Session Utils](/lib/utils/session-utils.ts) - Session transformation utilities
- [API Architecture](/app/api/ARCHITECTURE.md) - Overall API patterns
