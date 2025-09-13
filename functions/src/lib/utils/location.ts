// GPS utilities and location validation functions

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationError {
  code: number;
  message: string;
}

const geolocationProvider = {
  getCurrentPosition: (
    successCallback: PositionCallback,
    errorCallback: PositionErrorCallback,
    options?: PositionOptions,
  ) => {
    navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallback,
      options,
    );
  },
};

// Get current GPS coordinates using browser Geolocation API with enhanced options
const getCurrentLocation = (
  options?: PositionOptions,
): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: "Geolocation is not supported by this browser",
      });
      return;
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 60000, // 1 minute
    };

    const finalOptions = { ...defaultOptions, ...options };

    geolocationProvider.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject({
          code: error.code,
          message: getLocationErrorMessage(error.code),
        });
      },
      finalOptions,
    );
  });
};

export const locationService = {
  getCurrentLocation,
};

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (
  coord1: Coordinates,
  coord2: Coordinates,
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) *
      Math.cos(toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// Convert degrees to radians
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

// Check if user is within allowed radius of school
export const isWithinRadius = (
  userLocation: Coordinates,
  schoolLocation: Coordinates,
  allowedRadius: number,
): boolean => {
  const distance = calculateDistance(userLocation, schoolLocation);
  return distance <= allowedRadius;
};

// Get human-readable error message for location errors
export const getLocationErrorMessage = (errorCode: number): string => {
  switch (errorCode) {
    case 1:
      return "Location access denied. Please enable location permissions.";
    case 2:
      return "Location unavailable. Please check your GPS settings.";
    case 3:
      return "Location request timed out. Please try again.";
    default:
      return "An unknown location error occurred.";
  }
};

// Format coordinates for display
export const formatCoordinates = (
  coords: Coordinates,
  precision: number = 6,
): string => {
  return `${coords.latitude.toFixed(precision)}, ${coords.longitude.toFixed(precision)}`;
};

// Validate coordinates
export const isValidCoordinates = (coords: Coordinates): boolean => {
  return (
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
};
