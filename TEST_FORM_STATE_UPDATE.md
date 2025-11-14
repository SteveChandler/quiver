# Form State Update - Manual Testing Guide

## Testing Checklist

### 1. Test New Field Type Definitions

**Verify SessionFormState includes new fields:**

```typescript
import type { SessionFormState } from '@/hooks/use-session-form';

// This should compile without errors
const testFormState: SessionFormState = {
  selectedBeach: "Malibu",
  selectedBeachId: "123",
  selectedDate: "2025-11-13",
  selectedTime: "06:00",
  selectedBoard: "9'0 Longboard",
  boardId: "board-123",
  duration: "90m",
  waveQuality: "4",
  waterTemp: "68",
  crowdLevel: "3",
  parkingEase: "4",
  overallRating: "5",
  notes: "Epic session!",
  photos: [], // Now File[] instead of string[]
  waveTypes: ["point-break"],

  // NEW FIELDS - should not cause type errors
  waveHeight: 4.5,
  windSpeed: 10,
  windDirection: "OFFSHORE",
  forecastAccuracy: "accurate",
};
```

### 2. Test Form State Initialization

**Check hook initialization:**

```typescript
import { useSessionForm } from '@/hooks/use-session-form';

function TestComponent() {
  const { formState, updateField } = useSessionForm('log');

  // Verify new fields are initialized as undefined
  console.log(formState.waveHeight); // Should be undefined
  console.log(formState.windSpeed); // Should be undefined
  console.log(formState.windDirection); // Should be undefined
  console.log(formState.forecastAccuracy); // Should be undefined
}
```

### 3. Test updateField Function

**Update new fields:**

```typescript
const { formState, updateField } = useSessionForm('log');

// Update wave height
updateField('waveHeight', 5.5);

// Update wind speed
updateField('windSpeed', 12);

// Update wind direction
updateField('windDirection', 'NE');

// Update forecast accuracy
updateField('forecastAccuracy', 'somewhat');

// Verify updates
console.log(formState.waveHeight); // Should be 5.5
console.log(formState.windSpeed); // Should be 12
console.log(formState.windDirection); // Should be 'NE'
console.log(formState.forecastAccuracy); // Should be 'somewhat'
```

### 4. Test Form → Database Transformation

**Test transformSessionFormStateToDbSchema:**

```typescript
import { transformSessionFormStateToDbSchema } from '@/lib/utils/session-utils';

const testFormState: SessionFormState = {
  selectedBeach: "Malibu",
  selectedBeachId: "beach-123",
  selectedDate: "2025-11-13",
  selectedTime: "06:00",
  selectedBoard: "9'0 Longboard",
  boardId: "board-123",
  duration: "90m",
  waveQuality: "4",
  waterTemp: "68",
  crowdLevel: "3",
  parkingEase: "4",
  overallRating: "5",
  notes: "Epic session!",
  photos: [],
  waveTypes: ["point-break", "beach-break"],

  // NEW FIELDS
  waveHeight: 4.5,
  windSpeed: 10,
  windDirection: "OFFSHORE",
  forecastAccuracy: "accurate",
};

const dbData = transformSessionFormStateToDbSchema(testFormState);

// Verify transformations
console.log(dbData.beach_id); // Should be "beach-123"
console.log(dbData.board_id); // Should be "board-123"
console.log(dbData.duration_minutes); // Should be 90
console.log(dbData.wave_quality); // Should be 4 (number)
console.log(dbData.water_temp); // Should be 68 (number)
console.log(dbData.crowd_level); // Should be 3 (number)
console.log(dbData.parking_ease); // Should be 4 (number)
console.log(dbData.rating); // Should be 5 (number)
console.log(dbData.notes); // Should be "Epic session!"
console.log(dbData.goals); // Should be ["point-break", "beach-break"]

// NEW FIELD TRANSFORMATIONS
console.log(dbData.wave_height_ft); // Should be 4.5
console.log(dbData.wind_speed_mph); // Should be 10
console.log(dbData.wind_direction); // Should be "OFFSHORE"
console.log(dbData.forecast_accuracy); // Should be "accurate"
console.log(dbData.wave_types); // Should be ["point-break", "beach-break"]
```

**Expected Output:**
```json
{
  "beach_id": "beach-123",
  "board_id": "board-123",
  "arrival_time": "2025-11-13T06:00:00.000Z",
  "duration_minutes": 90,
  "wave_quality": 4,
  "water_temp": 68,
  "crowd_level": 3,
  "parking_ease": 4,
  "rating": 5,
  "notes": "Epic session!",
  "goals": ["point-break", "beach-break"],
  "wave_height_ft": 4.5,
  "wind_speed_mph": 10,
  "wind_direction": "OFFSHORE",
  "forecast_accuracy": "accurate",
  "wave_types": ["point-break", "beach-break"],
  "is_public": true
}
```

### 5. Test Database → Form Transformation

**Test sessionToFormState:**

```typescript
import { sessionToFormState } from '@/lib/utils/session-utils';

const mockSession = {
  id: "session-123",
  beach_id: "beach-123",
  beach_name: "Malibu Surfrider Beach",
  board_id: "board-123",
  arrival_time: "2025-11-13T06:00:00.000Z",
  duration_minutes: 90,
  wave_quality: 4,
  water_temp: 68,
  crowd_level: 3,
  parking_ease: 4,
  rating: 5,
  notes: "Epic session!",
  goals: ["point-break", "beach-break"],

  // NEW FIELDS
  wave_height_ft: 4.5,
  wind_speed_mph: 10,
  wind_direction: "OFFSHORE",
  forecast_accuracy: "accurate",
  wave_types: ["point-break", "beach-break"],
};

const formState = sessionToFormState(mockSession);

// Verify transformations
console.log(formState.selectedBeach); // Should be "Malibu Surfrider Beach"
console.log(formState.selectedBeachId); // Should be "beach-123"
console.log(formState.selectedDate); // Should be "2025-11-13"
console.log(formState.selectedTime); // Should be "06:00"
console.log(formState.boardId); // Should be "board-123"
console.log(formState.duration); // Should be "1h 30m"
console.log(formState.waveQuality); // Should be "4"
console.log(formState.waterTemp); // Should be "68"
console.log(formState.crowdLevel); // Should be "3"
console.log(formState.parkingEase); // Should be "4"
console.log(formState.overallRating); // Should be "5"
console.log(formState.notes); // Should be "Epic session!"
console.log(formState.waveTypes); // Should be ["point-break", "beach-break"]

// NEW FIELD TRANSFORMATIONS
console.log(formState.waveHeight); // Should be 4.5
console.log(formState.windSpeed); // Should be 10
console.log(formState.windDirection); // Should be "OFFSHORE"
console.log(formState.forecastAccuracy); // Should be "accurate"
```

### 6. Test Edge Cases

**Test with undefined/null new fields:**

```typescript
const formStateWithoutNewFields: SessionFormState = {
  selectedBeach: "Malibu",
  selectedBeachId: "beach-123",
  selectedDate: "2025-11-13",
  selectedTime: "06:00",
  selectedBoard: "9'0 Longboard",
  boardId: "board-123",
  duration: "90m",
  waveQuality: "4",
  waterTemp: "68",
  crowdLevel: "3",
  parkingEase: "4",
  overallRating: "5",
  notes: "",
  photos: [],
  waveTypes: [],

  // NEW FIELDS - all undefined
  waveHeight: undefined,
  windSpeed: undefined,
  windDirection: undefined,
  forecastAccuracy: undefined,
};

const dbData = transformSessionFormStateToDbSchema(formStateWithoutNewFields);

// Verify new fields are NOT included in output (cleaned up)
console.log('wave_height_ft' in dbData); // Should be false
console.log('wind_speed_mph' in dbData); // Should be false
console.log('wind_direction' in dbData); // Should be false
console.log('forecast_accuracy' in dbData); // Should be false
```

### 7. Test resetForm Function

**Verify reset clears new fields:**

```typescript
const { formState, updateField, resetForm } = useSessionForm('log');

// Set some values
updateField('waveHeight', 5.5);
updateField('windSpeed', 12);
updateField('windDirection', 'NE');
updateField('forecastAccuracy', 'somewhat');

console.log(formState.waveHeight); // Should be 5.5

// Reset
resetForm();

// Verify all new fields are reset to undefined
console.log(formState.waveHeight); // Should be undefined
console.log(formState.windSpeed); // Should be undefined
console.log(formState.windDirection); // Should be undefined
console.log(formState.forecastAccuracy); // Should be undefined
```

### 8. Test Integration with Session Actions

**Test createLoggedSession with new fields:**

```typescript
import { createLoggedSession } from '@/actions/session-actions';

const sessionData: SessionFormState = {
  selectedBeach: "Malibu Surfrider Beach",
  selectedBeachId: "beach-123",
  selectedDate: "2025-11-13",
  selectedTime: "06:00",
  selectedBoard: "9'0 Longboard",
  boardId: "board-123",
  duration: "90m",
  waveQuality: "4",
  waterTemp: "68",
  crowdLevel: "3",
  parkingEase: "4",
  overallRating: "5",
  notes: "Epic session with clean overhead sets!",
  photos: [],
  waveTypes: ["point-break"],

  // NEW FIELDS
  waveHeight: 4.5,
  windSpeed: 10,
  windDirection: "OFFSHORE",
  forecastAccuracy: "accurate",
};

// This should create a session with all new fields properly saved
const result = await createLoggedSession(sessionData);

console.log(result.success); // Should be true
console.log(result.data.wave_height_ft); // Should be 4.5
console.log(result.data.wind_speed_mph); // Should be 10
console.log(result.data.wind_direction); // Should be "OFFSHORE"
console.log(result.data.forecast_accuracy); // Should be "accurate"
```

## Success Criteria

✅ All type definitions compile without errors
✅ Form state initializes with new fields as undefined
✅ updateField works for all new fields
✅ transformSessionFormStateToDbSchema correctly maps new fields
✅ sessionToFormState correctly maps database fields back to form
✅ Edge cases (undefined values) handled properly
✅ resetForm clears all new fields
✅ Integration with createLoggedSession works

## Common Issues & Troubleshooting

### Issue: TypeScript complains about `wave_height_ft`

**Solution:** This is expected until database migration is run. We're using type assertions `(dbData as any).wave_height_ft` temporarily. After migration and type regeneration, update to properly typed access.

### Issue: Photos type mismatch

**Solution:** Photos changed from `string[]` to `File[]`. Update any component that directly accesses `formState.photos` to handle File objects instead of strings.

### Issue: Data not persisting to database

**Check:**
1. Is the database migration run?
2. Did you regenerate types with `yarn db:types`?
3. Are you using the latest session-actions.ts?
4. Check server logs for errors

### Issue: Edit mode doesn't load new fields

**Check:**
1. Is `sessionToFormState()` being used?
2. Does the session have the new database fields?
3. Check that field names match exactly

## Next Steps After Testing

1. ✅ Verify all tests pass
2. Create database migration
3. Run migration in development
4. Regenerate types: `yarn db:types`
5. Update UI components to use formState
6. Test end-to-end with real UI
7. Deploy to staging
8. Full QA testing
9. Deploy to production

---

**Test Status:** Ready for testing
**Last Updated:** 2025-11-13
