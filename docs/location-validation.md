# School Location Validation System

## Overview

The enhanced school location validation system provides comprehensive GPS coordinate validation, address standardization, and location accuracy checking for the Schools-In application. This system ensures that school locations are accurately recorded and validated before being saved to the database.

## Features

### 1. **GPS Coordinate Validation**

- Range validation (latitude: -90 to 90, longitude: -180 to 180)
- Precision assessment (high/medium/low based on decimal places)
- Coordinate normalization (6 decimal places for optimal accuracy)
- Detection of unset coordinates (0, 0)

### 2. **Address Validation**

- Format validation and completeness checking
- Confidence assessment (high/medium/low)
- Component detection (street number, city, state, ZIP)
- Address standardization suggestions

### 3. **Location Matching**

- Cross-validation between address and coordinates
- Distance calculation between geocoded and provided coordinates
- Tolerance-based matching (configurable distance threshold)

### 4. **Enhanced School Form**

- Real-time validation feedback
- Visual validation indicators (badges, alerts)
- Coordinate precision display
- Address standardization suggestions
- Interactive geocoding and reverse geocoding

### 5. **Check-in Radius Validation**

- Optimal radius recommendations (25m - 500m)
- Visual feedback for radius sizing
- Warnings for extreme values

### 6. **Automatic Geofence Check-in/Check-out**

- Continuous GPS monitoring with adaptive polling intervals
- Automatic check-in when entering a school's geofence
- Automatic check-out when leaving a school's geofence
- Debouncing and grace periods to prevent false triggers
- User-controlled countdowns with cancellation option

## API Reference

### Core Validation Functions

#### `validateCoordinates(latitude: number, longitude: number): CoordinateValidationResult`

Validates GPS coordinates for range, precision, and accuracy.

```typescript
const result = validateCoordinates(41.8781, -87.6298);
// Returns:
// {
//   isValid: true,
//   precision: "high",
//   errors: [],
//   normalizedLat: 41.878100,
//   normalizedLng: -87.629800
// }
```

#### `validateAddress(address: string): AddressValidationResult`

Validates address format and completeness.

```typescript
const result = validateAddress("1034 N Wells St, Chicago, IL 60610");
// Returns:
// {
//   isValid: true,
//   confidence: "high",
//   errors: [],
//   standardizedAddress: "1034 N Wells St, Chicago, IL 60610",
//   components: {
//     streetName: "1034 N Wells St",
//     city: "Chicago",
//     state: "IL",
//     postalCode: "60610"
//   }
// }
```

#### `validateLocation(address: string, latitude: number, longitude: number, radius?: number): LocationValidationResult`

Comprehensive location validation combining address, coordinates, and radius.

```typescript
const result = validateLocation(
  "1034 N Wells St, Chicago, IL 60610",
  41.8781,
  -87.6298,
  100
);
// Returns validation results with errors, warnings, and suggestions
```

### Geocoding Functions

#### `geocodeAddress(address: string): Promise<GeocodeResult>`

Converts address to GPS coordinates.

```typescript
const result = await geocodeAddress("Chicago, IL");
// Returns:
// {
//   success: true,
//   coordinates: { lat: 41.8781, lng: -87.6298 },
//   standardizedAddress: "Chicago, IL",
//   confidence: "high"
// }
```

#### `reverseGeocode(latitude: number, longitude: number): Promise<{success: boolean; address?: string; error?: string}>`

Converts GPS coordinates to address.

```typescript
const result = await reverseGeocode(41.8781, -87.6298);
// Returns:
// {
//   success: true,
//   address: "Chicago, IL"
// }
```

### Utility Functions

#### `calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number`

Calculates distance in meters between two coordinate points.

```typescript
const distance = calculateDistance(41.8781, -87.6298, 41.9742, -87.6553);
// Returns: distance in meters
```

#### `validateCoordinateAddressMatch(address: string, latitude: number, longitude: number, toleranceMeters?: number): Promise<{isMatch: boolean; distance?: number; error?: string}>`

Validates that coordinates and address refer to the same location.

```typescript
const result = await validateCoordinateAddressMatch(
  "Chicago, IL",
  41.8781,
  -87.6298,
  1000 // 1km tolerance
);
// Returns: { isMatch: true, distance: 234 }
```

## School Form Enhancements

The SchoolForm component now includes:

### Visual Validation Indicators

- **Green badges/alerts**: Successful validation
- **Yellow badges/alerts**: Warnings (location works but could be improved)
- **Red badges/alerts**: Errors that prevent submission

### Real-time Feedback

- Coordinate precision assessment
- Address standardization suggestions
- Radius size recommendations
- Distance calculations between address and coordinates

### Interactive Features

- **"Get Coords" button**: Geocode address to coordinates
- **"Get Address from Coords" button**: Reverse geocode coordinates to address
- **"Validate Match" button**: Check if address and coordinates match
- **Address suggestion acceptance**: Use standardized address format

### Validation States

#### Coordinate Precision

- **High precision**: 6+ decimal places (±0.11m accuracy)
- **Medium precision**: 4-5 decimal places (±11m accuracy)
- **Low precision**: <4 decimal places (±1.1km accuracy)

#### Address Confidence

- **High confidence**: Complete address with street number, city, state, ZIP
- **Medium confidence**: Address with basic components
- **Low confidence**: Incomplete or improperly formatted address

#### Radius Recommendations

- **Very Small** (<25m): May cause check-in difficulties
- **Good Size** (25m-500m): Recommended range
- **Very Large** (>500m): May allow distant check-ins

## Implementation Example

```typescript
// In a school creation form
const handleCreateSchool = async (formData: SchoolFormData) => {
  // Validate the complete location
  const locationValidation = validateLocation(
    formData.address,
    formData.latitude,
    formData.longitude,
    formData.radius
  );

  if (!locationValidation.isValid) {
    throw new Error(
      `Location validation failed: ${locationValidation.errors.join(", ")}`
    );
  }

  // Normalize coordinates
  const coordinateValidation = validateCoordinates(
    formData.latitude,
    formData.longitude
  );

  const schoolData = {
    ...formData,
    latitude: coordinateValidation.normalizedLat || formData.latitude,
    longitude: coordinateValidation.normalizedLng || formData.longitude,
  };

  // Save to database
  await createSchool(schoolData);
};
```

## Testing

The system includes comprehensive tests covering:

- Coordinate validation edge cases
- Address format validation
- Distance calculations
- Geocoding functionality
- Integration scenarios

Run tests with:

```bash
npm test -- locationValidationService.test.ts
```

## Automatic Check-in/Check-out System

### Overview

The automatic geofence system continuously monitors provider location and automatically triggers check-in/check-out actions when entering or leaving school geofences. This feature is opt-in and can be enabled/disabled by providers in their settings.

### How It Works

#### Polling Mechanism

When auto-geofence is enabled, the app polls the device's GPS location at adaptive intervals based on proximity to geofences:

- **12 seconds**: During active countdowns (check-in/check-out in progress)
- **30 seconds**: Near geofence boundaries (<250m or 2× radius)
- **90 seconds**: Far from any geofence (>500m or 4× radius)
- **180 seconds**: When app is backgrounded (except periodic-sync strategy)

The adaptive polling minimizes battery consumption while maintaining responsiveness.

#### Geofence Validation

Each location poll:

1. Obtains current GPS coordinates with accuracy requirements (≤50m)
2. Calculates distance to all assigned school locations using Haversine formula
3. Compares distance against each location's radius (default 100m, configurable 25-500m)
4. Determines geofence state: `idle`, `outside`, `entering`, `inside`, or `exiting`

### Auto Check-in Process

When a provider approaches a school location:

1. **Detection**: System detects GPS position is within the school's geofence radius
2. **Debouncing**: Requires **3 consecutive polls** confirming "inside" status (prevents GPS jitter)
3. **Countdown**: Displays 15-second toast notification:
   - Title: "Auto check-in"
   - Description: "Arrived at [School Name] • [distance] away"
   - Action: "Cancel" button
4. **User Control**:
   - Provider can tap "Cancel" to prevent auto check-in
   - Cancelled location is blocked for 5 minutes (cooldown period)
5. **Completion**: If countdown expires without cancellation:
   - Automatically checks in to the location
   - Records GPS coordinates with the check-in
   - Starts grace period timer

#### Check-in Safeguards

- **Cooldown period**: 5 minutes after cancellation before re-attempting at same location
- **Single countdown**: Only one check-in countdown active at a time (atomic state management)
- **Accuracy threshold**: Requires GPS accuracy ≤50m; pauses after 3 consecutive poor readings
- **Location locking**: Once entering a specific location, system commits to that location until debounce threshold met

### Auto Check-out Process

When a provider leaves a school location:

1. **Grace Period**: System ignores "outside" detections for **60 seconds** after check-in
   - Prevents immediate check-out from GPS fluctuations/signal loss
   - Applies to both auto and manual check-ins
2. **Detection**: After grace period, detects GPS position is outside the geofence
3. **Debouncing**: Requires **3 consecutive polls** confirming "outside" status
4. **Countdown**: Displays 15-second toast notification:
   - Title: "Auto check-out"
   - Description: "Leaving [School Name] • Session: [duration]"
   - Action: "Stay Checked In" button
5. **User Control**: Provider can tap "Stay Checked In" to cancel auto check-out
6. **Completion**: If countdown expires without cancellation:
   - Automatically checks out from the location
   - Records GPS coordinates with the check-out
   - Calculates final session duration

#### Check-out Safeguards

- **60-second grace period**: Prevents premature check-out after arrival
- **Streak reset**: Any poll showing provider back inside cancels the outside streak
- **Single countdown**: Only one check-out countdown active at a time
- **Session tracking**: Displays accurate session duration in countdown

### GPS Accuracy Management

#### Accuracy Requirements

- **Actionable accuracy**: GPS accuracy ≤50 meters
- **Poor accuracy handling**:
  - Tracks consecutive poor accuracy readings
  - After 3 consecutive poor readings, pauses auto-check feature
  - Displays platform-specific guidance:
    - **iOS**: Enable Precise Location in Settings > Privacy & Security > Location Services
    - **Android/Other**: Move outside, enable Wi-Fi, wait for stabilization
- **Automatic resume**: When accuracy improves, feature automatically resumes

#### Location Options

The system adjusts GPS request parameters based on context:

**High Accuracy Mode** (near boundaries or active countdown):
- `enableHighAccuracy: true`
- `maximumAge: 15000ms`
- `timeout: 10000ms`

**Standard Mode** (mid-range distance):
- `enableHighAccuracy: true`
- `maximumAge: 60000ms`
- `timeout: 5000ms`

**Power Saving Mode** (far from locations or backgrounded):
- `enableHighAccuracy: false`
- `maximumAge: 180000ms`
- `timeout: 5000ms`

### Platform Strategies

The system adapts to browser capabilities using different strategies:

1. **Periodic Sync Strategy** (Chrome/Edge with Background Sync API):
   - Registers service worker periodic background sync
   - Continues geofence checks when app is closed
   - Best user experience

2. **Foreground Strategy** (Safari, Firefox):
   - Active polling when app is visible
   - Reduced polling when backgrounded
   - Standard functionality

3. **Background Geolocation Strategy** (PWA with background permissions):
   - Uses experimental background geolocation APIs
   - Limited platform support

### State Management

The auto-geofence system maintains several state variables:

- `geofenceState`: Current state (idle/outside/entering/inside/exiting)
- `isPolling`: Whether a location poll is in progress
- `lastDistanceMeters`: Distance to nearest/active location
- `lastAccuracyMeters`: GPS accuracy of last reading
- `pausedReason`: Why auto-check is paused (e.g., "poor-accuracy")
- `activeCountdown`: Active check-in/check-out countdown details
- `locationPermission`: Geolocation permission status
- `strategy`: Current geofencing strategy being used

### Wake Lock Management

During active countdowns, the system:

- Acquires screen wake lock to prevent device sleep
- Ensures countdown completes without interruption
- Releases wake lock after countdown completion or cancellation
- Gracefully handles platforms without wake lock support

### Background Sync Integration

For supported platforms:

- Geofence configuration synced to IndexedDB
- Service worker can perform geofence checks when app is closed
- User location periodically updated in IndexedDB
- Active session state synchronized for background access

### User Experience Features

#### Toast Notifications

- **Live countdown**: Updates every second showing remaining time
- **Clear actions**: Single prominent button to cancel auto-action
- **Context information**: Shows school name, distance, or session duration
- **Auto-dismiss**: Toast dismisses after countdown completes

#### Visual Indicators

- Geofence state displayed in UI
- Distance to nearest location shown
- GPS accuracy status visible
- Active countdown indicator

#### Settings Control

- Toggle auto-geofence on/off in provider settings
- Feature respects user preference across app restarts
- Clear explanation of how feature works

### Performance Optimization

- **Adaptive polling**: Longer intervals when far from locations
- **In-flight protection**: Prevents overlapping location polls
- **Debounced persistence**: Batches IndexedDB writes
- **Conditional high accuracy**: Only requests high accuracy when needed
- **Visibility handling**: Reduces activity when app is backgrounded

### Security & Privacy

- Location access requires explicit user permission
- GPS coordinates stored only with check-in/check-out records
- No continuous location tracking (only periodic polls)
- User can disable feature at any time
- Location data never shared with third parties

### Testing

Comprehensive test coverage includes:

- Debouncing logic (streak tracking)
- Grace period enforcement
- Countdown lifecycle management
- GPS accuracy handling
- Platform strategy selection
- State transitions

Run auto-geofence tests:

```bash
npm test -- useAutoGeofenceCheck.test.tsx
```

### Configuration Constants

Key tuning parameters defined in `useAutoGeofenceCheck.ts`:

```typescript
const GEOFENCE_TUNING = {
  accuracyThresholdMeters: 50,      // Maximum acceptable GPS error
  nearDistanceMeters: 250,           // Distance considered "near" boundary
  farDistanceMeters: 500,            // Distance considered "far" from location
  countdownPollIntervalMs: 12_000,   // Poll interval during countdown
  nearPollIntervalMs: 30_000,        // Poll interval near boundary
  farPollIntervalMs: 90_000,         // Poll interval far from location
};

const COUNTDOWN_MS = 15_000;                    // Countdown duration
const CANCEL_COOLDOWN_MS = 5 * 60_000;          // Cancellation cooldown
const CHECK_IN_GRACE_PERIOD_MS = 60_000;        // Post check-in grace period
const DEBOUNCE_POLLS = 3;                       // Required consecutive polls
const POOR_ACCURACY_LIMIT = 3;                  // Poor accuracy tolerance
```

### Troubleshooting

#### Auto check-in not triggering

1. Check that auto-geofence is enabled in settings
2. Verify location permissions are granted
3. Ensure GPS accuracy is ≤50m
4. Check that location hasn't been cancelled recently (5-min cooldown)
5. Confirm provider is within school geofence radius

#### Immediate check-out after check-in

- Should not occur due to 60-second grace period
- If happening, check GPS accuracy and stability
- Verify geofence radius is appropriate for location (minimum 25m)

#### Auto-check paused

- Usually due to poor GPS accuracy
- Follow platform-specific guidance to improve accuracy
- Feature will auto-resume when accuracy improves

#### Battery drain concerns

- Adaptive polling reduces battery impact when far from locations
- Consider disabling when not actively working
- Backgrounded apps use longer poll intervals

## Future Enhancements

### Integration with Real Geocoding Services

Replace mock geocoding with real services:

- Google Maps Geocoding API
- MapBox Geocoding API
- Azure Maps

### Enhanced Map Integration

- Interactive map for coordinate selection
- Visual radius display
- Address verification through map clicks

### Batch Validation

- Validate multiple school locations
- Import validation for bulk school data
- Export validation reports

### Advanced Location Features

- School boundary validation
- Accessibility checking
- Parking area validation
- Multiple entrance point support

## Error Handling

The validation system provides detailed error messages and recovery suggestions:

```typescript
// Example error handling
try {
  const result = await geocodeAddress(address);
  if (!result.success) {
    // Handle geocoding failure
    setError(result.error);
    // Suggest manual coordinate entry
  }
} catch (error) {
  // Handle service unavailability
  setError("Geocoding service temporarily unavailable");
}
```

## Performance Considerations

- Validation runs client-side for immediate feedback
- Geocoding is throttled to prevent API abuse
- Results are cached for repeated validations
- Background validation doesn't block form submission

## Security Notes

- All coordinate data is validated and sanitized
- Address data is cleaned before geocoding
- API keys for geocoding services should be secured
- Input validation prevents injection attacks

## Accessibility

The validation UI includes:

- Screen reader compatible alerts
- Color-blind friendly status indicators
- Keyboard navigation support
- Clear error message descriptions
