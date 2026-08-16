# Show HN Post

## Title

Show HN: Quiver – ML-corrected surf forecasts (XGBoost + 30K buoy observations)

## Post Body

I built Quiver because every surf forecast app displays raw NOAA WaveWatch III output — a model designed for shipping routes on a ~30-mile ocean grid. It's accurate offshore, but at the beach, local bathymetry, refraction, and coastal sheltering can make predictions off by 50%+. Your forecast says 6ft, the waves are 3ft.

**The fix: per-beach bias correction**

For each of our 185+ beaches, we train an XGBoost model on historical buoy observations from CDIP, NDBC, and IOOS (30,000+ data points total). The key insight is that swell direction matters enormously at the beach level — a south swell at 195° produces completely different conditions than one at 220° at the same spot. So we bin incoming swell into 72 directional bins (5° increments) as model features, alongside period, height, wind speed/direction, and tide state.

**How the pipeline works:**

1. Every 3 hours, we pull the latest NOAA WaveWatch III forecast + real-time buoy readings
2. For each beach, the trained XGBoost model predicts the bias (predicted - observed)
3. We subtract the predicted bias from the raw forecast → corrected prediction
4. Models retrain weekly with validation gates: deploy only if RMSE improves on held-out data

> **Monetization note — 2026-08-13:** This draft's “no paywalled tiers” line is stale as a
> current-product claim. The core surf forecast and session log remain free, while the
> native app has optional Quiver Pro features and a 14-day trial configured in source.

**What users see:**

- Corrected wave height, period, and direction forecasts
- A "Match Score" (0-100) personalized to your skill level and preferences
- Tide charts, live buoy conditions, wind data
- Session tracking and a surf community

**Stack:** Next.js 16 (App Router), Supabase/PostGIS, Python edge functions for the ML pipeline, XGBoost for per-beach models.

**The core surf forecast is free.** Optional Quiver Pro features are available in the app.

**Feedback I'd love:**

1. Is 72 directional bins the right granularity? We tried 36 (10°) and 72 (5°) — 72 showed meaningful accuracy gains for point breaks with narrow swell windows, but diminishing returns for wide-open beach breaks. Curious if anyone in oceanography/meteorology has thoughts.

2. We retrain weekly. Should we move to continuous online learning with each new buoy reading, or does batch retraining with validation gates provide better stability?

3. The Match Score is a heuristic blend of forecast quality and user preferences. Would users prefer a more transparent scoring breakdown, or does a single number work better?

4. We're debating open-sourcing the per-beach model training pipeline. Any interest?

**Try it:** https://www.quiversurf.app

**Accuracy tracking:** https://www.quiversurf.app/forecast-accuracy

## Anticipated Questions & Responses

**"How does this compare to Surfline/Magic Seaweed?"**

Surfline and MSW display corrected forecasts too, but their corrections are largely manual (forecasters adjust predictions by region). Quiver's corrections are automated and per-beach — each beach has its own trained model rather than a regional adjustment. Trade-off: we don't have the editorial layer (human forecaster notes), but our corrections are more granular and update every 3 hours without human intervention.

**"Why XGBoost and not a neural network?"**

XGBoost handles the feature set well (72 direction bins + continuous variables), trains fast enough for weekly retraining across 185+ beaches, and is interpretable — we can see which directional bins matter most for each beach. A neural net might squeeze out marginal accuracy gains but at the cost of interpretability and training time. We may experiment with LightGBM or neural approaches in the future.

**"30K observations doesn't sound like a lot"**

It's 30K matched observation-prediction pairs (buoy reading at time T paired with the WaveWatch III forecast for that location and time). For per-beach models, each beach typically has 200-2000 matched pairs depending on buoy proximity. The directional binning creates a structured feature space that XGBoost handles efficiently even with moderate sample sizes.

**"What about spots without nearby buoys?"**

We use the nearest CDIP/NDBC/IOOS station. For beaches far from any buoy, the model has less correction power and the Match Score reflects lower confidence. We're transparent about this — the forecast accuracy page shows per-beach model performance.

## Timing & Strategy

- Post on a weekday morning (Tue-Thu, 9-10am ET)
- Reply genuinely to every comment within the first 2 hours
- Don't be defensive about limitations — acknowledge trade-offs openly
- If it gains traction, follow up with a blog post about the technical details
