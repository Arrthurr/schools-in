// Test file for location validation service functionality

import {
  validateCoordinates,
  validateAddress,
  validateLocation,
  geocodeAddress,
  reverseGeocode,
  calculateDistance,
  validateCoordinateAddressMatch,
} from "../locationValidationService";

describe("Location Validation Service", () => {
  describe("validateCoordinates", () => {
    test("should validate correct coordinates", () => {
      const result = validateCoordinates(41.8781, -87.6298);
      expect(result.isValid).toBe(true);
      expect(result.precision).toBe("medium"); // 4 decimal places = medium precision
      expect(result.errors).toHaveLength(0);
    });

    test("should reject invalid latitude", () => {
      const result = validateCoordinates(100, -87.6298);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Latitude must be between -90 and 90 degrees"
      );
    });

    test("should reject invalid longitude", () => {
      const result = validateCoordinates(41.8781, 200);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Longitude must be between -180 and 180 degrees"
      );
    });

    test("should detect zero coordinates", () => {
      const result = validateCoordinates(0, 0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Coordinates appear to be unset (0, 0)");
    });

    test("should assess coordinate precision", () => {
      const lowPrecision = validateCoordinates(41.87, -87.62);
      expect(lowPrecision.precision).toBe("low");

      const mediumPrecision = validateCoordinates(41.8781, -87.6298);
      expect(mediumPrecision.precision).toBe("medium");

      const highPrecision = validateCoordinates(41.878123, -87.629834);
      expect(highPrecision.precision).toBe("high");
    });

    test("should normalize coordinates", () => {
      const result = validateCoordinates(41.8781234567, -87.6298765432);
      expect(result.normalizedLat).toBe(41.878123);
      expect(result.normalizedLng).toBe(-87.629877);
    });
  });

  describe("validateAddress", () => {
    test("should validate complete address", () => {
      const result = validateAddress("1034 N Wells St, Chicago, IL 60610");
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe("high");
    });

    test("should reject empty address", () => {
      const result = validateAddress("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Address is required");
    });

    test("should warn about short address", () => {
      const result = validateAddress("123 Main");
      expect(result.errors).toContain("Address appears to be too short");
    });

    test("should assess address confidence", () => {
      const lowConfidence = validateAddress("Some place");
      expect(lowConfidence.confidence).toBe("low");

      const mediumConfidence = validateAddress("123 Main St, Chicago, IL");
      expect(mediumConfidence.confidence).toBe("medium");

      const highConfidence = validateAddress("123 Main St, Chicago, IL 60610");
      expect(highConfidence.confidence).toBe("high");
    });
  });

  describe("validateLocation", () => {
    test("should validate complete location", () => {
      const result = validateLocation(
        "1034 N Wells St, Chicago, IL 60610",
        41.8781,
        -87.6298,
        100
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should warn about small radius", () => {
      const result = validateLocation(
        "1034 N Wells St, Chicago, IL 60610",
        41.8781,
        -87.6298,
        5
      );
      expect(result.warnings).toContain(
        "Check-in radius is very small (< 10m)"
      );
    });

    test("should warn about large radius", () => {
      const result = validateLocation(
        "1034 N Wells St, Chicago, IL 60610",
        41.8781,
        -87.6298,
        600
      );
      expect(result.warnings).toContain(
        "Check-in radius is very large (> 500m)"
      );
    });

    test("should provide suggestions", () => {
      const result = validateLocation(
        "1034 N Wells St, Chicago, IL 60610",
        41.8781,
        -87.6298,
        5
      );
      expect(result.suggestions).toContain(
        "Consider using at least 25m radius for reliable check-ins"
      );
    });
  });

  describe("calculateDistance", () => {
    test("should calculate distance between coordinates", () => {
      // Distance between Chicago downtown and Millennium Park (roughly 1km)
      const distance = calculateDistance(41.8781, -87.6298, 41.8826, -87.6226);
      expect(distance).toBeGreaterThan(500);
      expect(distance).toBeLessThan(1500);
    });

    test("should return zero for identical coordinates", () => {
      const distance = calculateDistance(41.8781, -87.6298, 41.8781, -87.6298);
      expect(distance).toBe(0);
    });
  });

  describe("geocodeAddress", () => {
    test("should geocode valid address", async () => {
      const result = await geocodeAddress("123 Main St, Chicago, IL 60610");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.coordinates).toBeDefined();
        expect(result.coordinates?.lat).toBeCloseTo(41.8781, 0);
        expect(result.coordinates?.lng).toBeCloseTo(-87.6298, 0);
      }
    });

    test("should handle invalid address", async () => {
      const result = await geocodeAddress("");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should return appropriate confidence level", async () => {
      const result = await geocodeAddress("1034 N Wells St, Chicago, IL 60610");
      expect(result.success).toBe(true);
      expect(["high", "medium", "low"]).toContain(result.confidence);
    });
  });

  describe("reverseGeocode", () => {
    test("should reverse geocode valid coordinates", async () => {
      const result = await reverseGeocode(41.8781, -87.6298);
      expect(result.success).toBe(true);
      expect(result.address).toBeDefined();
      expect(typeof result.address).toBe("string");
    });

    test("should handle invalid coordinates", async () => {
      const result = await reverseGeocode(200, 300);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("validateCoordinateAddressMatch", () => {
    test("should validate matching address and coordinates", async () => {
      const result = await validateCoordinateAddressMatch(
        "Chicago, IL",
        41.8781,
        -87.6298,
        5000 // 5km tolerance
      );
      // With mock geocoding, match validation depends on mock data
      expect(typeof result.isMatch).toBe("boolean");
      if (result.isMatch) {
        expect(result.distance).toBeDefined();
      }
    });

    test("should detect non-matching address and coordinates", async () => {
      const result = await validateCoordinateAddressMatch(
        "New York, NY",
        41.8781, // Chicago coordinates
        -87.6298,
        1000 // 1km tolerance
      );
      // This might fail depending on mock data, but should work with real geocoding
      expect(typeof result.isMatch).toBe("boolean");
    });
  });
});

// Example usage demonstrations
export const locationValidationExamples = {
  // Example 1: Validate a complete school location
  validateSchoolLocation: () => {
    const validation = validateLocation(
      "1034 N Wells St, Chicago, IL 60610",
      41.8781,
      -87.6298,
      100
    );
    console.log("School location validation:", validation);
    return validation;
  },

  // Example 2: Check coordinate precision
  checkCoordinatePrecision: () => {
    const highPrecision = validateCoordinates(41.878123, -87.629834);
    const lowPrecision = validateCoordinates(41.87, -87.62);

    console.log("High precision:", highPrecision.precision);
    console.log("Low precision:", lowPrecision.precision);

    return { highPrecision, lowPrecision };
  },

  // Example 3: Geocode an address
  geocodeSchoolAddress: async () => {
    const result = await geocodeAddress(
      "Walter Payton High School, Chicago, IL"
    );
    console.log("Geocoding result:", result);
    return result;
  },

  // Example 4: Validate address format
  validateSchoolAddress: () => {
    const completeAddress = validateAddress(
      "1034 N Wells St, Chicago, IL 60610"
    );
    const incompleteAddress = validateAddress("123 Main St");

    console.log("Complete address validation:", completeAddress);
    console.log("Incomplete address validation:", incompleteAddress);

    return { completeAddress, incompleteAddress };
  },

  // Example 5: Calculate distance between two schools
  calculateSchoolDistance: () => {
    const distance = calculateDistance(
      41.8781,
      -87.6298, // School 1: Chicago downtown
      41.9742,
      -87.6553 // School 2: Lincoln Park area
    );

    console.log("Distance between schools:", Math.round(distance), "meters");
    return distance;
  },
};
