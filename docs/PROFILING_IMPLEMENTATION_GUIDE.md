# Performance Profiling Patch Documentation

## Overview
Add detailed query timing to beach-recommendation-service.ts to identify bottlenecks.

## Helper Function to Add

Add this after imports, before the class definition:

```typescript
function logQueryTiming(
  operationId: string,
  queryName: string,
  startTime: number,
  resultCount?: number,
  error?: any
): number {
  const duration = performance.now() - startTime;
  const status = error ? 'FAILED' : 'SUCCESS';
  const countInfo = resultCount !== undefined ? ' | ' + resultCount + ' rows' : '';
  const emoji = error ? 'X' : duration > 1000 ? 'WARN' : 'OK';
  
  console.log(
    '[PERF-' + operationId + '] ' + emoji + ' ' + status + ' ' + queryName + ': ' + Math.round(duration) + 'ms' + countInfo,
    error ? { error: String(error) } : {}
  );
  
  return duration;
}
```

## Query Logging Examples

### For nearby beaches RPC (line ~205):
```typescript
const rpcStart = performance.now();
let nearbyBeachesResult = await supabase.rpc("get_nearby_beaches", {
  // ... params
});
logQueryTiming(operationId, 'nearby_beaches_rpc', rpcStart, nearbyBeachesResult.data?.length, nearbyBeachesResult.error);
```

### For forecasts query (line ~455):
```typescript
const forecastStart = performance.now();
const { data: forecastRows, error: forecastError } = await supabase
  .from("enhanced_forecasts")
  // ... query
logQueryTiming(operationId, 'forecasts_query', forecastStart, forecastRows?.length, forecastError);
```

## Expected Output

Vercel logs will show timing for each query, making it easy to spot bottlenecks:

```
[PERF-abc123] OK SUCCESS nearby_beaches_rpc: 156ms | 12 rows
[PERF-abc123] WARN SUCCESS forecasts_query: 1234ms | 72 rows  <-- BOTTLENECK!
```
