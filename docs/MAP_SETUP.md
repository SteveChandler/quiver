# Map Setup Guide

This guide explains how to set up map images for beach locations in the Quiver app.

## Overview

The app can display static map images for beach locations using several different map providers. By default, it will use a free OpenStreetMap service that doesn't require any API keys.

## Map Provider Options

### 1. **No API Key Required (Default)**

The app will automatically use OpenStreetMap's free static map service if no API keys are configured. This provides basic map images with location markers.

### 2. **Mapbox (Recommended for Surf Apps)**

Mapbox provides beautiful outdoor-focused maps that are perfect for surf applications.

**Setup:**

1. Sign up at [https://www.mapbox.com/](https://www.mapbox.com/)
2. Get your access token from the dashboard
3. Add to your `.env.local` file:
   ```
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here
   ```

**Free Tier:** 50,000 map loads per month

### 3. **Google Maps**

Google Maps provides familiar map styling and excellent global coverage.

**Setup:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Maps Static API"
4. Create credentials (API Key)
5. Add to your `.env.local` file:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

**Free Tier:** $200 credit per month

### 4. **Geoapify**

Alternative free option with good OpenStreetMap-based maps.

**Setup:**

1. Sign up at [https://www.geoapify.com/](https://www.geoapify.com/)
2. Get your API key from the dashboard
3. Add to your `.env.local` file:
   ```
   NEXT_PUBLIC_GEOAPIFY_API_KEY=your_api_key_here
   ```

**Free Tier:** 3,000 requests per day

## Environment Variables

Create a `.env.local` file in your project root and add the API keys for your chosen provider(s):

```bash
# Choose one or more of these:
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_api_key
NEXT_PUBLIC_GEOAPIFY_API_KEY=your_geoapify_key

# Your existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## How It Works

1. The app tries to extract coordinates from beach data
2. If coordinates are found, it generates a static map image URL
3. Map providers are tried in this order:
   - Mapbox (if token available)
   - Google Maps (if API key available)
   - Geoapify (if API key available)
   - OpenStreetMap (free fallback)

## Beach Coordinates

The app looks for beach coordinates in several places:

- Direct `latitude` and `longitude` fields on the beach object
- A `location` object with `x` (longitude) and `y` (latitude) fields
- `lat` and `lng` fields
- Hardcoded coordinates for known San Diego beaches

## Customization

You can customize map appearance by modifying the options in `lib/map-utils.ts`:

- Map zoom level
- Image dimensions
- Map style (for Mapbox)
- Marker colors

## Troubleshooting

**Maps not showing?**

1. Check browser console for errors
2. Verify API keys are correctly set in `.env.local`
3. Ensure you've restarted the development server after adding environment variables
4. Check API quotas haven't been exceeded

**Wrong location shown?**

1. Verify beach coordinates in the database
2. Check if beach name matches the hardcoded coordinates list
3. Ensure latitude/longitude are not swapped

**Performance issues?**

- Consider caching map images
- Use appropriate image dimensions
- Implement lazy loading for beach cards
