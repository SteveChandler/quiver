# 19-03 Summary: Methodology, Limits, And SEO Copy

**Completed:** 2026-06-02
**Status:** passed

## What Changed

- Removed hardcoded "100+ beaches" and "Updated daily" claims from
  `/forecast-accuracy` metadata.
- Added `ForecastAccuracyDatasetSchema`, with live measured values when present
  and a minimal building-state Dataset when metrics are unavailable.
- Expanded `MethodologySection` to explain MAE, NOAA baseline MAE, Quiver MAE,
  trusted buoy matching, the claim gate, known limits, and last-updated
  behavior.
- Updated `AccuracyFaq` to use building-safe copy and avoid duplicate
  direct FAQ schema calls.

## Verification

| Command | Result |
| --- | --- |
| `yarn test:unit __tests__/components/seo/forecast-accuracy-dataset-schema.test.tsx --runInBand` | passed |
| `npx eslint --max-warnings=0 app/forecast-accuracy/page.tsx components/forecast-accuracy/methodology-section.tsx components/forecast-accuracy/accuracy-faq.tsx components/seo/forecast-accuracy-dataset-schema.tsx __tests__/components/seo/forecast-accuracy-dataset-schema.test.tsx` | passed |
| `rg -n "buildPageMetadata|WebPageSchema|forecast accuracy|NOAA baseline|buoy-validated|100\\+|Updated daily" app/forecast-accuracy/page.tsx` | passed |
| `rg -n "MAE|NOAA baseline|Quiver MAE|IOOS|buoy|matched|known limits|last updated|rolling" components/forecast-accuracy/methodology-section.tsx` | passed |
| `rg -n "Mean Absolute Error|NOAA baseline|IOOS|rolling|sparse|Dataset|ForecastAccuracyDatasetSchema" components/forecast-accuracy/accuracy-faq.tsx components/seo/forecast-accuracy-dataset-schema.tsx __tests__/components/seo/forecast-accuracy-dataset-schema.test.tsx` | passed |

## Notes

- No rendering-mode change was made; `/forecast-accuracy` still uses the
  existing runtime behavior.
- Dataset schema does not publish fake measurements in building state.
