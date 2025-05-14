# San Diego Surf Forecast API

This module provides functionality to get surf forecasts for San Diego beaches using the Stormglass API.

## Features

- Database of 27 San Diego beaches with their coordinates
- Beach resolution by name or nearest location
- Integration with Stormglass API for surf forecasts
- TypeScript interfaces for type safety

## Setup

1. Create a `.env.local` file in the root of your project and add your Stormglass API key:

   ```
   STORMGLASS_API_KEY=your_stormglass_api_key
   ```

2. Import the functions you need:
   ```typescript
   import { resolveBeach, getSurfForecast } from "./utils";
   ```

## Usage

### API Route

The API is accessible at `/api/surf` and accepts the following query parameters:

- `beach`: Beach name (e.g., "Ocean Beach", "La Jolla Shores")
- `lat` & `lng`: Coordinates (if beach name is not provided)

Examples:

- `/api/surf?beach=Ocean%20Beach`
- `/api/surf?lat=32.7507&lng=-117.2540`

### Programmatic Usage

```typescript
// Get forecast by beach name
const forecast = await getSurfForecast({
  beach: "Ocean Beach",
});

// Get forecast by coordinates
const forecast = await getSurfForecast({
  coords: { lat: 32.7507, lng: -117.254 },
});

// Find nearest beach to a location
const beach = resolveBeach({ lat: 32.7157, lng: -117.1611 });
```

## Available Beaches

The API includes data for the following San Diego beaches:

- Oceanside Pier
- Oceanside Harbor Beach
- Carlsbad State Beach
- Carlsbad Reef
- Carlsbad Point
- Leucadia State Beach
- Grandview
- Stone Steps
- Encinitas
- Swami's
- Cardiff Reef
- Moonlight State Beach
- Solana Beach
- Del Mar Beach
- Torrey Pines State Beach
- Blacks Beach
- Windansea Beach
- La Jolla Shores
- Tourmaline Surf Park
- Crystal Pier
- Pacific Beach
- Mission Beach
- Ocean Beach
- Sunset Cliffs
- Coronado Beach
- Imperial Beach
- Silver Strand

## Response Format

```typescript
{
  "beach": "ocean beach",
  "coords": {
    "lat": 32.7507,
    "lng": -117.2540
  },
  "forecast": {
    // Stormglass API response data
    "hours": [
      {
        "time": "2023-05-01T00:00:00+00:00",
        "waveHeight": { ... },
        "wavePeriod": { ... },
        // Other surf parameters
      },
      // More forecast hours
    ]
  }
}
```
