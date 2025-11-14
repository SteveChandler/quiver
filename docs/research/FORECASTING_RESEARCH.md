# Improving Quiver's Surf Forecast — Research Summary (Oct 21, 2025)

**Status**: 📦 **ARCHIVED - Phase 4: Post-PMF Enhancement**
**Implementation Timeline**: Deferred until Q2 2026 (post-1000 users)
**Rationale**: Focus on user growth and viral features first; forecast accuracy improvements will be revisited after product-market fit is established.

---

## Executive Summary

This research identifies opportunities to improve Quiver's surf forecast accuracy by **8–25% RMSE reduction** through formal data assimilation, nearshore physics modeling, enhanced wind forcing, and ML bias correction. While technically sound, these improvements are **deferred** in favor of growth-first priorities (social sharing, community features, viral mechanics) per the product strategy outlined in `ARCHITECTURE_REVIEW.md`.

**Current Priority**: Acquire 1,000+ users through viral features
**Future Priority**: Implement forecast improvements to enhance retention and differentiation

---

## Scope

Quiver currently uses:
- **Waves:** NOAA WaveWatch III (fallback: Open‑Meteo Marine)
- **Tides:** NOAA CO‑OPS
- **Winds/Weather:** NWS hourly products
- **Observations:** NDBC + CDIP

**Current Status**: Production-ready with 10-day forecasts, confidence scoring, and data source transparency

**Goal**: Reduce **underestimation of swell height** and align forecasts with **observed data** while preserving transparency and graceful degradation.

---

## Key Findings

### 1) Formal data assimilation reduces bias
- **Ensemble Optimal Interpolation (EnOI)** and **Local Ensemble Transform Kalman Filter (LETKF)** are proven approaches to assimilate significant wave height (SWH) from buoys and satellites into WW3-style fields.
- Evidence shows **8–25% RMSE reduction** month‑to‑month when assimilating satellite SWH globally; largest gains in Pacific/Eastern Pacific; nearshore accuracy is lower due to coastal satellite error.
- LETKF prototypes for NWS/GWES indicate **substantial bias reduction within 12‑hour windows** and modular, operationally feasible pipelines.

**Implication for Quiver:** Add a lightweight post‑processing assimilation stage over San Diego: use buoy (NDBC/CDIP) SWH + optional satellite tracks to correct WW3 grids before sampling per beach.

**Implementation Estimate**: 2-3 weeks
**Dependencies**: Historical buoy data pipeline, WW3 grid storage

---

### 2) Nearshore physics matter (refraction, breaking, bathymetry)
- Global WW3 misses **local transformation** (shoaling/refraction/triads, depth‑limited breaking). Navy/SIO workflows recommend **SWAN** at 100‑200 m with high‑res bathymetry, boundary spectra from WW3, tide levels, and bias‑corrected winds.
- A 4D‑Var system for SWAN (SWANFAR) demonstrates the value of assimilating **regional observations** for nearshore predictions.

**Implication for Quiver:** Stand up small SWAN tiles for La Jolla, OB–Sunset Cliffs, and North County. Use assimilated WW3 spectra at the offshore boundary; run tiles every 6 h for 72 h horizon and store receptor outputs per beach.

**Implementation Estimate**: 6-8 weeks
**Dependencies**: SWAN infrastructure, high-res bathymetry data, computational resources

---

### 3) Better winds reduce wave-height under-calls
- Studies show higher‑resolution wind forcing and bias corrections decrease **U10 underestimation** that propagates to **Hs** underestimation. HRRR/NWS high‑res grids outperform coarse GFS along complex coasts.

**Implication for Quiver:** Prioritize HRRR/NWS‑hourly winds, normalize to 10 m, and apply rolling buoy‑based wind bias correction before nearshore runs and bias‑learning.

**Implementation Estimate**: 1-2 weeks
**Dependencies**: HRRR data access, buoy wind time series

---

### 4) ML bias correction closes residual gaps
- Modern ML (tree ensembles; ConvLSTM/transformers like **2D‑Geoformer**) can learn systematic model‑to‑obs error patterns and provide **fast, online ΔHs corrections** at each beach.

**Implication for Quiver:** Train per‑beach ΔHs models using assimilated WW3/SWAN predictors, wind, tide, and seasonality. Apply at inference; clamp and monitor with nightly verification.

**Implementation Estimate**: 4-6 weeks
**Dependencies**: Historical forecast vs. observation dataset, ML training pipeline

---

## Recommended Architecture (High Level)

1. **Ingest & Cache:** WW3 grid, tides (CO‑OPS), winds, NDBC/CDIP. ✅ **Already Implemented**
2. **Assimilation (post‑proc):** EnOI/LETKF‑lite to produce corrected SWH grids over SoCal. ⏸️ **Phase 4**
3. **Nearshore Downscaling:** SWAN tiles fed by corrected spectra, bathymetry, tides, bias‑fixed winds. ⏸️ **Phase 4**
4. **ML Bias Layer:** Per‑beach ΔHs model on top of assimilated/nearshore outputs. ⏸️ **Phase 4**
5. **Verification:** RMSE/MAE/Bias by lead time; promote only when metrics beat baseline for ≥14 days. ⏸️ **Phase 4**
6. **Transparency:** Tag forecasts with method badges (e.g., "SWAN + Assim"). ✅ **Partially Implemented** (confidence scores, data sources)

---

## Validation Plan

- Compare against nearest **NDBC/CDIP** for 0–72 h by 6‑h buckets.
- Track **Bias** (model–obs), **RMSE**, **MAE**, and **P50/P90 absolute error** per beach.
- Require ≥10% RMSE improvement and lower bias magnitude to roll forward per spot.

---

## Implementation Stages (When Revisited)

### Stage 1: Data Assimilation Pipeline (2-3 weeks)
**Prerequisites**: 1,000+ active users, forecast accuracy identified as retention issue

**Tasks**:
- Implement lightweight EnOI post-processing
- Assimilate NDBC/CDIP buoy SWH into WW3 grids
- Apply Gaussian localization (150-250km)
- Store corrected forecasts alongside raw
- A/B test with subset of users

**Database Changes**:
```sql
-- Add assimilation metadata to enhanced_forecasts
ALTER TABLE enhanced_forecasts
  ADD COLUMN assimilation_method text,
  ADD COLUMN assimilation_metadata jsonb;
```

---

### Stage 2: Enhanced Wind Forcing (1-2 weeks)
**Prerequisites**: Stage 1 validated with ≥10% RMSE improvement

**Tasks**:
- Switch to HRRR/NWS high-res winds
- Implement rolling buoy-based bias correction
- Normalize to 10m height
- Update forecast pipeline

---

### Stage 3: Per-Beach ML Bias Correction (4-6 weeks)
**Prerequisites**: Stages 1-2 deployed, historical data collected

**Tasks**:
- Collect historical forecast vs. observation data
- Train per-beach ΔHs models (start with XGBoost)
- Apply corrections at inference time
- Monitor and clamp predictions
- Nightly verification reports

---

### Stage 4: SWAN Nearshore Downscaling (6-8 weeks)
**Prerequisites**: Stages 1-3 deployed, operational demand confirmed

**Tasks**:
- Stand up SWAN tiles for key spots (La Jolla, OB, North County)
- Configure bathymetry, boundary conditions
- Run every 6h for 72h horizon
- Store receptor outputs per beach
- Integrate with existing forecast display

**Infrastructure**:
- SWAN computational resources
- High-resolution bathymetry data
- Automated tile generation pipeline

---

## Alternative: Lightweight Implementation (Completed Oct 2025) ✅ IMPLEMENTED

Instead of full data assimilation, Quiver implemented **forecast transparency and community verification** features:

**Status**: ✅ **FULLY IMPLEMENTED** (October 2024)  
**Files**:
- `components/forecast/forecast-verification-widget.tsx` - Community voting UI
- `components/forecast/forecast-data-source-indicator.tsx` - Data source badges
- `components/forecast/forecast-confidence-badge.tsx` - Confidence indicators
- `actions/forecast-verification-actions.ts` - Vote submission logic
- `supabase/migrations/20251021000000_create_forecast_accuracy_votes.sql` - Database schema

**Features Implemented**:
- ✅ Visual confidence badges (using existing `confidence_score` data)
- ✅ Community forecast verification voting (`forecast_accuracy_votes` table)
- ✅ Data source transparency (CDIP vs NOAA vs Fallback indicators)
- ✅ Buoy station links and data quality indicators
- ✅ Forecast accuracy statistics per beach
- ✅ Social sharing of verification streaks (viral mechanic!)

**Result**: Added growth-focused social engagement without 3-5 month technical investment. Provides user trust through transparency while building community engagement.

**Implementation Note**: This alternative approach achieves the transparency goals outlined in the research while deferring complex data assimilation until Phase 4 (post-1000 users).

---

## References (open-access or program docs)

- Flampouris & Penny (NOAA/NWS): *Modular LETKF for Significant Wave Height* (WGNE Blue Book).
  https://wgne.net/bluebook/uploads/2017/docs/08_Flampouris_Stylianos_data_assimilation_for_waves.pdf

- Wang et al. (2023, MDPI Atmosphere): *Impacts of EnOI in Global Ocean Wave Data Assimilation* (HY‑2A SWH; 8–25% monthly RMSE reduction; nearshore caveat).
  https://www.mdpi.com/2073-4433/14/5/818

- Veeramony et al. (2014, Oceanography / SIO‑NRL): *Navy Nearshore Ocean Prediction Systems* (SWAN nearshore + SWANFAR 4D‑Var concept).
  https://cdip.ucsd.edu/themes/media/docs/publications_references/journal_articles/Navy_Nearshore_Ocean_Prediction_Systems.pdf

- Frontiers (2024–2025+): *Transformer/Geoformer approaches for SWH error correction* (illustrates modern ML correction layer feasibility).
  https://www.frontiersin.org/articles/10.3389/feart.2024.1348471/full

---

## Notes for Future Implementation

- Start with **post‑proc EnOI** (no full ensemble infra). Use Gaussian localization (150–250 km); inflate observation errors within 25 km of coast (satellite).
- Use **CDIP** directional spectra where available to refine boundary conditions or validate transformation.
- Keep **confidence metadata** wired through UI so users can see data provenance (matches Quiver's transparency design).
- Consider API partnerships (Surfline, MagicSeaweed) vs. building from scratch if forecast accuracy becomes competitive differentiator
- Monitor user feedback: Does forecast accuracy impact retention? Do users request better forecasts?

---

## Success Metrics (When Revisited)

**Phase 4 Activation Criteria**:
- ✅ 1,000+ active users
- ✅ Product-market fit validated
- ✅ Forecast accuracy identified as retention issue OR competitive differentiator
- ✅ User feedback requesting better forecasts
- ✅ Engineering capacity available (not blocking growth features)

**Implementation Success Metrics**:
- ≥10% RMSE improvement vs. baseline
- Lower bias magnitude per beach
- User satisfaction scores increase
- Retention improvement attributable to forecast accuracy
- Competitive differentiation vs. Surfline/MagicSeaweed

---

## Related Documents

- `ARCHITECTURE_REVIEW.md` - Strategic priorities and growth roadmap
- `CLAUDE.md` - Development patterns and workflows
- `types/forecast.ts` - Current forecast type definitions
- `lib/utils/forecast-service-utils.ts` - Forecast service layer
- `components/forecast/*` - Forecast UI components

---

**Last Updated**: October 21, 2025
**Next Review**: Q2 2026 (after 1,000 user milestone)
