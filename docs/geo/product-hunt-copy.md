# Product Hunt Launch Copy

## Tagline

**Your forecast says 6ft. The waves are 3ft. Here's why — and how we fixed it.**

## Description

Surf forecasts are built on NOAA's WaveWatch III — a 30-mile ocean grid designed for shipping routes. Great for open water, but it can't see your beach. Refraction, local bathymetry, and coastal sheltering mean the waves at the sand rarely match the offshore prediction.

Quiver fixes this with per-beach machine learning. We train XGBoost models on 30,000+ buoy observations from CDIP, NDBC, and IOOS to learn how each of our 185+ beaches transforms incoming swell. The model analyzes 72 directional bins to capture how different swell angles interact with local geography — a south swell at Blacks Beach hits very differently than a northwest swell.

The result: bias-corrected forecasts updated every 3 hours, a personalized Match Score (0-100) that rates conditions against your skill level and preferences, tide charts, live buoy data, session tracking, and a surf community — all free.

## Maker Comment

Hey PH! I'm the maker of Quiver. Here's the technical story behind it:

Every surf forecast app shows you the same NOAA data. The problem is that WaveWatch III models the ocean on a ~30-mile grid — it literally cannot resolve your beach. A south swell at 15 seconds might produce head-high waves at one beach and waist-high mush 2 miles down the coast.

So we built a correction layer. For each of our 185+ beaches, we train an XGBoost model on historical buoy observations. The model uses 72 directional swell bins (5-degree increments) because swell direction is the biggest factor in how a beach performs. A beach facing southwest might fire on 200° swells but be completely flat on 280° swells from the same height and period.

The models retrain weekly with automated validation gates — we compare against held-out buoy readings and only deploy if accuracy improves. If it doesn't, the previous model stays.

We also built personalized Match Scores. Instead of reading 6 data points and deciding "should I go?", you get a single 0-100 number based on your preferences (wave size tolerance, wind sensitivity, crowd aversion, skill level).

The whole stack is Next.js 16, Supabase/PostGIS, and Python edge functions for the ML pipeline. Forecasts, session tracking, community — it's all free.

Would love feedback on the approach. Is the directional binning granularity right at 72 bins? Should we expose the raw model confidence intervals?

## First Comment

"Hi everyone! Happy to answer any questions about the ML pipeline, the directional binning approach, or how we handle edge cases (beach breaks vs. point breaks vs. reef breaks). Also curious if anyone has ideas for features that would make the forecast more useful for your specific area."

## Gallery Image Suggestions

1. **Hero shot**: Split screen — offshore forecast (6ft) vs. actual beach conditions (3ft) with Quiver's corrected prediction
2. **Match Score**: Phone screenshot showing the 0-100 Match Score with condition breakdown
3. **Map view**: Interactive surf map with color-coded forecast overlays
4. **Before/after**: Raw NOAA prediction vs. Quiver's bias-corrected forecast for the same beach
5. **ML pipeline**: Simple diagram showing buoy data → XGBoost → corrected forecast
6. **Session tracking**: Screenshot of the surf journal with session details and conditions

## Recommended Hashtags

`#SurfTech` `#MachineLearning` `#WeatherTech` `#Surfing` `#OpenData` `#FreeTool`
