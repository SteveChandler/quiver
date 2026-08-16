# 17-03 Summary: Regional Forecast Pilot

Status: Complete

## Delivered

- Added `bestSurfWindows` to regional forecast summaries using the existing `regionForecastMap`.
- Added `components/forecast/regional-best-surf-windows.tsx`.
- Mounted the regional pilot between the regional hero and `SevenDayOutlook` on `/forecast`.
- Hardened surf-window link construction for missing canonical paths.

## Verification

- `yarn test:unit __tests__/lib/utils/forecast-hub-utils.test.ts --runInBand` passed.
- `yarn test:unit __tests__/components/forecast/regional-best-surf-windows.test.tsx --runInBand` passed.
- Focused auth Playwright passed: `npx playwright test e2e/forecast-hub.spec.ts --project=auth --grep "best windows section and seven-day outlook both render"`.
- Utility test asserts `getBatchFreshForecastsFromCache` is called once for regional summaries.

