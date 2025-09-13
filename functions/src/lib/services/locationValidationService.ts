// Location validation and GPS coordinate utilities service

export interface LocationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface CoordinateValidationResult {
  isValid: boolean;
  precision: "high" | "medium" | "low";
  errors: string[];
  normalizedLat?: number;
  normalizedLng?: number;
}

export interface AddressValidationResult {
  isValid: boolean;
  standardizedAddress?: string;
  confidence: "high" | "medium" | "low";
  errors: string[];
  components?: {
    streetNumber?: string;
    streetName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface GeocodeResult {
  success: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  standardizedAddress?: string;
  confidence: "high" | "medium" | "low";
  error?: string;
}

// Validate GPS coordinates
export const validateCoordinates = (
  latitude: number,
  longitude: number
): CoordinateValidationResult => {
  const errors: string[] = [];
  let precision: "high" | "medium" | "low" = "high";

  // Basic range validation
  if (latitude < -90 || latitude > 90) {
    errors.push("Latitude must be between -90 and 90 degrees");
  }

  if (longitude < -180 || longitude > 180) {
    errors.push("Longitude must be between -180 and 180 degrees");
  }

  // Check for zero coordinates (often indicates unset)
  if (latitude === 0 && longitude === 0) {
    errors.push("Coordinates appear to be unset (0, 0)");
  }

  // Check coordinate precision
  const latDecimals = countDecimals(latitude);
  const lngDecimals = countDecimals(longitude);

  if (latDecimals < 4 || lngDecimals < 4) {
    precision = "low";
  } else if (latDecimals < 6 || lngDecimals < 6) {
    precision = "medium";
  }

  // Normalize coordinates (remove excessive precision)
  const normalizedLat = Math.round(latitude * 1000000) / 1000000; // 6 decimal places
  const normalizedLng = Math.round(longitude * 1000000) / 1000000;

  return {
    isValid: errors.length === 0,
    precision,
    errors,
    normalizedLat,
    normalizedLng,
  };
};

// Validate address format and completeness
export const validateAddress = (address: string): AddressValidationResult => {
  const errors: string[] = [];
  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    errors.push("Address is required");
    return {
      isValid: false,
      confidence: "low",
      errors,
    };
  }

  if (trimmedAddress.length < 10) {
    errors.push("Address appears to be too short");
  }

  // Basic address component detection
  const hasNumbers = /\d/.test(trimmedAddress);
  const hasCommas = /,/.test(trimmedAddress);
  const hasState = /\b[A-Z]{2}\b/.test(trimmedAddress); // Basic state code detection
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(trimmedAddress); // Basic ZIP code detection

  let confidence: "high" | "medium" | "low" = "low";

  if (hasNumbers && hasCommas && hasState) {
    confidence = "medium";
  }
  if (hasNumbers && hasCommas && hasState && hasZip) {
    confidence = "high";
  }

  if (!hasNumbers) {
    errors.push("Address should include a street number");
  }

  // Extract basic components (very basic parsing)
  const parts = trimmedAddress.split(",").map((part) => part.trim());
  const components: AddressValidationResult["components"] = {};

  if (parts.length >= 2) {
    components.streetName = parts[0];
    if (parts.length >= 3) {
      components.city = parts[1];
      const lastPart = parts[parts.length - 1];
      const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/);
      if (stateZipMatch) {
        components.state = stateZipMatch[1];
        components.postalCode = stateZipMatch[2];
      }
    }
  }

  return {
    isValid: errors.length === 0,
    confidence,
    errors,
    components,
    standardizedAddress: trimmedAddress,
  };
};

// Validate location completeness (address + coordinates)
export const validateLocation = (
  address: string,
  latitude: number,
  longitude: number,
  radius?: number
): LocationValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Validate address
  const addressValidation = validateAddress(address);
  if (!addressValidation.isValid) {
    errors.push(...addressValidation.errors);
  } else if (addressValidation.confidence === "low") {
    warnings.push("Address format could be improved for better accuracy");
    suggestions.push("Include city, state, and ZIP code for better geocoding");
  }

  // Validate coordinates
  const coordValidation = validateCoordinates(latitude, longitude);
  if (!coordValidation.isValid) {
    errors.push(...coordValidation.errors);
  } else if (coordValidation.precision === "low") {
    warnings.push("GPS coordinates have low precision");
    suggestions.push(
      "Use more precise coordinates (at least 4 decimal places)"
    );
  }

  // Validate radius
  if (radius !== undefined) {
    if (radius < 10) {
      warnings.push("Check-in radius is very small (< 10m)");
      suggestions.push(
        "Consider using at least 25m radius for reliable check-ins"
      );
    } else if (radius > 500) {
      warnings.push("Check-in radius is very large (> 500m)");
      suggestions.push("Large radius may allow check-ins from far away");
    }
  }

  // Check if coordinates might be in a reasonable location
  if (coordValidation.isValid) {
    // Very basic sanity check for US coordinates
    if (latitude > 24 && latitude < 50 && longitude > -125 && longitude < -66) {
      // Coordinates appear to be in continental US - good
    } else if (
      latitude > 18 &&
      latitude < 72 &&
      longitude > -180 &&
      longitude < -60
    ) {
      // Coordinates might be in US territories
      warnings.push("Coordinates appear to be outside continental US");
    } else {
      warnings.push("Coordinates appear to be outside the United States");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
};

// Mock geocoding service (replace with real service in production)
export const geocodeAddress = async (
  address: string
): Promise<GeocodeResult> => {
  try {
    // Validate address first
    const addressValidation = validateAddress(address);
    if (!addressValidation.isValid) {
      return {
        success: false,
        confidence: "low",
        error: addressValidation.errors.join("; "),
      };
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock geocoding logic - in production, use Google Maps Geocoding API
    const mockCoordinates = getMockCoordinatesForAddress(address);

    if (!mockCoordinates) {
      return {
        success: false,
        confidence: "low",
        error:
          "Address could not be geocoded. Please check the address and try again.",
      };
    }

    // Validate the resulting coordinates
    const coordValidation = validateCoordinates(
      mockCoordinates.lat,
      mockCoordinates.lng
    );

    return {
      success: true,
      coordinates: {
        lat: coordValidation.normalizedLat || mockCoordinates.lat,
        lng: coordValidation.normalizedLng || mockCoordinates.lng,
      },
      standardizedAddress: addressValidation.standardizedAddress,
      confidence: addressValidation.confidence,
    };
  } catch (error) {
    return {
      success: false,
      confidence: "low",
      error:
        "Geocoding service temporarily unavailable. Please enter coordinates manually.",
    };
  }
};

// Reverse geocoding - get address from coordinates
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<{ success: boolean; address?: string; error?: string }> => {
  try {
    const coordValidation = validateCoordinates(latitude, longitude);
    if (!coordValidation.isValid) {
      return {
        success: false,
        error: coordValidation.errors.join("; "),
      };
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock reverse geocoding
    const mockAddress = getMockAddressForCoordinates(latitude, longitude);

    return {
      success: true,
      address: mockAddress,
    };
  } catch (error) {
    return {
      success: false,
      error: "Reverse geocoding failed. Please enter address manually.",
    };
  }
};

// Helper functions

function countDecimals(value: number): number {
  if (Math.floor(value) === value) return 0;
  const str = value.toString();
  if (str.indexOf(".") !== -1 && str.indexOf("e-") === -1) {
    return str.split(".")[1].length;
  } else if (str.indexOf("e-") !== -1) {
    const parts = str.split("e-");
    return parseInt(parts[1], 10);
  }
  return 0;
}

function getMockCoordinatesForAddress(
  address: string
): { lat: number; lng: number } | null {
  // Mock geocoding based on known patterns
  const addressLower = address.toLowerCase();

  // Chicago area schools (mock data)
  if (addressLower.includes("chicago") || addressLower.includes("wells")) {
    return {
      lat: 41.8781 + (Math.random() - 0.5) * 0.05,
      lng: -87.6298 + (Math.random() - 0.5) * 0.05,
    };
  }

  // Phoenix/Arizona area
  if (
    addressLower.includes("phoenix") ||
    addressLower.includes("arizona") ||
    addressLower.includes("estrella")
  ) {
    return {
      lat: 33.4484 + (Math.random() - 0.5) * 0.05,
      lng: -112.074 + (Math.random() - 0.5) * 0.05,
    };
  }

  // Generic US coordinates
  return {
    lat: 39.8283 + (Math.random() - 0.5) * 10, // Center US lat +/- 5 degrees
    lng: -98.5795 + (Math.random() - 0.5) * 20, // Center US lng +/- 10 degrees
  };
}

function getMockAddressForCoordinates(lat: number, lng: number): string {
  // Mock reverse geocoding
  const streetNumber = Math.floor(Math.random() * 9999) + 1;
  const streets = [
    "Main St",
    "Oak Ave",
    "Elm St",
    "First Ave",
    "Park Blvd",
    "School Dr",
  ];
  const cities = [
    "Chicago",
    "Springfield",
    "Madison",
    "Franklin",
    "Washington",
  ];
  const states = ["IL", "WI", "IN", "IA", "MO"];

  const street = streets[Math.floor(Math.random() * streets.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const state = states[Math.floor(Math.random() * states.length)];
  const zip = Math.floor(Math.random() * 90000) + 10000;

  return `${streetNumber} ${street}, ${city}, ${state} ${zip}`;
}

// Distance calculation between two coordinate points
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Check if coordinates are within a reasonable distance of an address
export const validateCoordinateAddressMatch = async (
  address: string,
  latitude: number,
  longitude: number,
  toleranceMeters: number = 1000
): Promise<{ isMatch: boolean; distance?: number; error?: string }> => {
  try {
    const geocodeResult = await geocodeAddress(address);

    if (!geocodeResult.success || !geocodeResult.coordinates) {
      return {
        isMatch: false,
        error: "Could not validate address coordinates: " + geocodeResult.error,
      };
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      geocodeResult.coordinates.lat,
      geocodeResult.coordinates.lng
    );

    return {
      isMatch: distance <= toleranceMeters,
      distance,
    };
  } catch (error) {
    return {
      isMatch: false,
      error: "Failed to validate coordinate and address match",
    };
  }
};
