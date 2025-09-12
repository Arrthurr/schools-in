// Unit tests for location utilities

import {
  calculateDistance,
  isWithinRadius,
  getLocationErrorMessage,
  formatCoordinates,
  isValidCoordinates,
  locationService,
  Coordinates
} from './location';

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn()
};

// Replace the global navigator.geolocation
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  configurable: true
});

describe('Location Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDistance', () => {
    it('calculates distance between same coordinates as 0', () => {
      const coord1: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const coord2: Coordinates = { latitude: 40.7128, longitude: -74.0060 };

      const distance = calculateDistance(coord1, coord2);
      expect(distance).toBe(0);
    });

    it('calculates distance between different coordinates', () => {
      // New York to Los Angeles (approximate)
      const nyc: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const la: Coordinates = { latitude: 34.0522, longitude: -118.2437 };

      const distance = calculateDistance(nyc, la);
      // Should be approximately 3,944 km or 3,944,000 meters
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('calculates short distances accurately', () => {
      // Two points approximately 100m apart
      const point1: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const point2: Coordinates = { latitude: 40.7137, longitude: -74.0060 }; // ~100m north

      const distance = calculateDistance(point1, point2);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it('handles edge cases with extreme coordinates', () => {
      const north: Coordinates = { latitude: 89, longitude: 0 };
      const south: Coordinates = { latitude: -89, longitude: 0 };

      const distance = calculateDistance(north, south);
      expect(distance).toBeGreaterThan(0);
      expect(typeof distance).toBe('number');
      expect(isFinite(distance)).toBe(true);
    });
  });

  describe('isWithinRadius', () => {
    const schoolLocation: Coordinates = { latitude: 40.7128, longitude: -74.0060 };

    it('returns true when user is at exact school location', () => {
      const userLocation: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const radius = 100;

      const result = isWithinRadius(userLocation, schoolLocation, radius);
      expect(result).toBe(true);
    });

    it('returns true when user is within radius', () => {
      // User is about 50m away (within 100m radius)
      const userLocation: Coordinates = { latitude: 40.7132, longitude: -74.0060 };
      const radius = 100;

      const result = isWithinRadius(userLocation, schoolLocation, radius);
      expect(result).toBe(true);
    });

    it('returns false when user is outside radius', () => {
      // User is about 200m away (outside 100m radius)
      const userLocation: Coordinates = { latitude: 40.7146, longitude: -74.0060 };
      const radius = 100;

      const result = isWithinRadius(userLocation, schoolLocation, radius);
      expect(result).toBe(false);
    });

    it('works with different radius values', () => {
      const userLocation: Coordinates = { latitude: 40.7132, longitude: -74.0060 }; // ~50m away

      expect(isWithinRadius(userLocation, schoolLocation, 25)).toBe(false);
      expect(isWithinRadius(userLocation, schoolLocation, 75)).toBe(true);
      expect(isWithinRadius(userLocation, schoolLocation, 200)).toBe(true);
    });

    it('handles zero radius correctly', () => {
      const exactLocation: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const nearbyLocation: Coordinates = { latitude: 40.7129, longitude: -74.0060 };

      expect(isWithinRadius(exactLocation, schoolLocation, 0)).toBe(true);
      expect(isWithinRadius(nearbyLocation, schoolLocation, 0)).toBe(false);
    });
  });

  describe('getLocationErrorMessage', () => {
    it('returns correct message for permission denied error', () => {
      const message = getLocationErrorMessage(1);
      expect(message).toBe('Location access denied. Please enable location permissions.');
    });

    it('returns correct message for position unavailable error', () => {
      const message = getLocationErrorMessage(2);
      expect(message).toBe('Location unavailable. Please check your GPS settings.');
    });

    it('returns correct message for timeout error', () => {
      const message = getLocationErrorMessage(3);
      expect(message).toBe('Location request timed out. Please try again.');
    });

    it('returns default message for unknown error codes', () => {
      expect(getLocationErrorMessage(0)).toBe('An unknown location error occurred.');
      expect(getLocationErrorMessage(999)).toBe('An unknown location error occurred.');
      expect(getLocationErrorMessage(-1)).toBe('An unknown location error occurred.');
    });
  });

  describe('formatCoordinates', () => {
    const coords: Coordinates = { latitude: 40.712776, longitude: -74.005974 };

    it('formats coordinates with default precision', () => {
      const formatted = formatCoordinates(coords);
      expect(formatted).toBe('40.712776, -74.005974');
    });

    it('formats coordinates with custom precision', () => {
      const formatted = formatCoordinates(coords, 3);
      expect(formatted).toBe('40.713, -74.006');
    });

    it('handles zero precision', () => {
      const formatted = formatCoordinates(coords, 0);
      expect(formatted).toBe('41, -74');
    });

    it('handles negative coordinates', () => {
      const negativeCoords: Coordinates = { latitude: -33.8688, longitude: 151.2093 };
      const formatted = formatCoordinates(negativeCoords, 2);
      expect(formatted).toBe('-33.87, 151.21');
    });
  });

  describe('isValidCoordinates', () => {
    it('validates correct coordinates', () => {
      expect(isValidCoordinates({ latitude: 40.7128, longitude: -74.0060 })).toBe(true);
      expect(isValidCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
      expect(isValidCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
      expect(isValidCoordinates({ latitude: -90, longitude: -180 })).toBe(true);
    });

    it('rejects invalid latitudes', () => {
      expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
      expect(isValidCoordinates({ latitude: -91, longitude: 0 })).toBe(false);
      expect(isValidCoordinates({ latitude: 180, longitude: 0 })).toBe(false);
    });

    it('rejects invalid longitudes', () => {
      expect(isValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
      expect(isValidCoordinates({ latitude: 0, longitude: -181 })).toBe(false);
      expect(isValidCoordinates({ latitude: 0, longitude: 360 })).toBe(false);
    });

    it('rejects coordinates with invalid types', () => {
      expect(isValidCoordinates({ latitude: NaN, longitude: 0 })).toBe(false);
      expect(isValidCoordinates({ latitude: 0, longitude: NaN })).toBe(false);
      expect(isValidCoordinates({ latitude: Infinity, longitude: 0 })).toBe(false);
      expect(isValidCoordinates({ latitude: 0, longitude: -Infinity })).toBe(false);
    });
  });

  describe('locationService.getCurrentLocation', () => {
    it('resolves with coordinates when geolocation succeeds', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const result = await locationService.getCurrentLocation();

      expect(result).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      });
    });

    it('rejects with error when geolocation fails', async () => {
      const mockError = { code: 1, message: 'Permission denied' };

      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error(mockError);
      });

      await expect(locationService.getCurrentLocation()).rejects.toEqual({
        code: 1,
        message: 'Location access denied. Please enable location permissions.'
      });
    });

    it('uses custom options when provided', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 5
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const customOptions = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      };

      await locationService.getCurrentLocation(customOptions);

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining(customOptions)
      );
    });

    it('merges custom options with defaults', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 15
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const partialOptions = {
        timeout: 5000
      };

      await locationService.getCurrentLocation(partialOptions);

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000
        })
      );
    });

    it('rejects when geolocation is not supported', async () => {
      // Temporarily remove geolocation
      const originalGeolocation = global.navigator.geolocation;
      delete (global.navigator as any).geolocation;

      await expect(locationService.getCurrentLocation()).rejects.toEqual({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      });

      // Restore geolocation
      global.navigator.geolocation = originalGeolocation;
    });

    it('includes accuracy in result when available', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 25.5
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const result = await locationService.getCurrentLocation();

      expect(result.accuracy).toBe(25.5);
    });

    it('handles missing accuracy gracefully', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060
          // No accuracy property
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const result = await locationService.getCurrentLocation();

      expect(result).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: undefined
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles very large distances', () => {
      const point1: Coordinates = { latitude: 90, longitude: 0 }; // North Pole
      const point2: Coordinates = { latitude: -90, longitude: 0 }; // South Pole

      const distance = calculateDistance(point1, point2);
      expect(distance).toBeGreaterThan(19000000); // ~20,000 km
      expect(typeof distance).toBe('number');
      expect(isFinite(distance)).toBe(true);
    });

    it('handles coordinates at international date line', () => {
      const east: Coordinates = { latitude: 0, longitude: 179 };
      const west: Coordinates = { latitude: 0, longitude: -179 };

      const distance = calculateDistance(east, west);
      expect(typeof distance).toBe('number');
      expect(isFinite(distance)).toBe(true);
      expect(distance).toBeGreaterThan(0);
    });

    it('calculates distance across equator', () => {
      const north: Coordinates = { latitude: 1, longitude: 0 };
      const south: Coordinates = { latitude: -1, longitude: 0 };

      const distance = calculateDistance(north, south);
      expect(distance).toBeGreaterThan(220000); // ~222 km
      expect(distance).toBeLessThan(225000);
    });
  });
});
