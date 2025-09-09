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
