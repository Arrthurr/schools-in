import { GeoPoint } from "firebase/firestore";
import {
  haversineDistance,
  calculateDistanceBetweenGeoPoints,
  calculateDistanceToLocation,
  withinRadius,
  isWithinGeofence,
  validateGeofence,
  createGeoPoint,
  areValidCoordinates,
  getCurrentPosition,
  validateCurrentPositionAgainstGeofence,
  GeoPointLike,
} from "../geo";

// Mock geolocation
const mockGetCurrentPosition = jest.fn();

Object.defineProperty(global.navigator, "geolocation", {
  value: { getCurrentPosition: mockGetCurrentPosition },
  configurable: true,
});

describe("geo utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("haversineDistance", () => {
    it("returns 0 for identical coordinates", () => {
      expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
    });

    it("calculates short distances accurately", () => {
      // Two points ~100m apart (north-south along same longitude)
      const distance = haversineDistance(40.7128, -74.006, 40.7137, -74.006);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it("calculates NYC to LA distance", () => {
      const distance = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(3_900_000);
      expect(distance).toBeLessThan(4_000_000);
    });

    it("calculates pole-to-pole distance", () => {
      const distance = haversineDistance(90, 0, -90, 0);
      // Half Earth circumference ~20,000 km
      expect(distance).toBeGreaterThan(19_000_000);
      expect(distance).toBeLessThan(20_100_000);
    });

    it("handles international date line crossing", () => {
      const distance = haversineDistance(0, 179, 0, -179);
      // ~222 km (2 degrees at equator)
      expect(distance).toBeGreaterThan(200_000);
      expect(distance).toBeLessThan(250_000);
    });
  });

  describe("calculateDistanceBetweenGeoPoints", () => {
    it("calculates distance between two GeoPoint objects", () => {
      const p1 = new GeoPoint(40.7128, -74.006);
      const p2 = new GeoPoint(40.7137, -74.006);
      const distance = calculateDistanceBetweenGeoPoints(p1, p2);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it("accepts plain objects (serialized GeoPoints)", () => {
      const p1: GeoPointLike = { latitude: 40.7128, longitude: -74.006 };
      const p2: GeoPointLike = { latitude: 40.7128, longitude: -74.006 };
      expect(calculateDistanceBetweenGeoPoints(p1, p2)).toBe(0);
    });
  });

  describe("calculateDistanceToLocation", () => {
    it("returns distance from user coords to a GeoPoint", () => {
      const locationGeo = new GeoPoint(40.7128, -74.006);
      const distance = calculateDistanceToLocation(40.7137, -74.006, locationGeo);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it("returns 0 when user is at the location", () => {
      const locationGeo: GeoPointLike = { latitude: 40.7128, longitude: -74.006 };
      expect(calculateDistanceToLocation(40.7128, -74.006, locationGeo)).toBe(0);
    });
  });

  describe("withinRadius", () => {
    it("returns true when distance is within radius", () => {
      // ~100m apart, 200m radius
      expect(withinRadius(40.7128, -74.006, 40.7137, -74.006, 200)).toBe(true);
    });

    it("returns false when distance exceeds radius", () => {
      // ~100m apart, 50m radius
      expect(withinRadius(40.7128, -74.006, 40.7137, -74.006, 50)).toBe(false);
    });

    it("returns true for identical coordinates with 0 radius", () => {
      expect(withinRadius(40.7128, -74.006, 40.7128, -74.006, 0)).toBe(true);
    });
  });

  describe("isWithinGeofence", () => {
    const schoolGeo = new GeoPoint(40.7128, -74.006);

    it("returns true when user is within default 300m radius", () => {
      // ~100m away
      expect(isWithinGeofence(40.7137, -74.006, schoolGeo)).toBe(true);
    });

    it("returns false when user is outside default radius", () => {
      // ~3.9 million meters away
      expect(isWithinGeofence(34.0522, -118.2437, schoolGeo)).toBe(false);
    });

    it("uses custom radius when provided", () => {
      // ~100m away, 50m radius
      expect(isWithinGeofence(40.7137, -74.006, schoolGeo, 50)).toBe(false);
      // ~100m away, 200m radius
      expect(isWithinGeofence(40.7137, -74.006, schoolGeo, 200)).toBe(true);
    });
  });

  describe("validateGeofence", () => {
    const schoolGeo: GeoPointLike = { latitude: 40.7128, longitude: -74.006 };

    it("returns distance and isWithinGeofence=true when inside", () => {
      const result = validateGeofence(40.7128, -74.006, schoolGeo);
      expect(result.distance).toBe(0);
      expect(result.isWithinGeofence).toBe(true);
    });

    it("returns distance and isWithinGeofence=false when outside", () => {
      const result = validateGeofence(34.0522, -118.2437, schoolGeo, 300);
      expect(result.distance).toBeGreaterThan(300);
      expect(result.isWithinGeofence).toBe(false);
    });

    it("uses default 300m radius", () => {
      // ~100m away → within 300m
      const result = validateGeofence(40.7137, -74.006, schoolGeo);
      expect(result.isWithinGeofence).toBe(true);
      expect(result.distance).toBeGreaterThan(0);
    });

    it("accepts legacy plain maps with lat/lng keys", () => {
      const schoolGeo = { lat: 40.7128, lng: -74.006 };
      const result = validateGeofence(40.7128, -74.006, schoolGeo);
      expect(result.distance).toBe(0);
      expect(result.isWithinGeofence).toBe(true);
    });
  });

  describe("createGeoPoint", () => {
    it("creates a GeoPoint with given coordinates", () => {
      const point = createGeoPoint(40.7128, -74.006);
      expect(point.latitude).toBe(40.7128);
      expect(point.longitude).toBe(-74.006);
    });
  });

  describe("areValidCoordinates", () => {
    it("accepts valid coordinates", () => {
      expect(areValidCoordinates(0, 0)).toBe(true);
      expect(areValidCoordinates(90, 180)).toBe(true);
      expect(areValidCoordinates(-90, -180)).toBe(true);
      expect(areValidCoordinates(40.7128, -74.006)).toBe(true);
    });

    it("rejects out-of-range latitude", () => {
      expect(areValidCoordinates(91, 0)).toBe(false);
      expect(areValidCoordinates(-91, 0)).toBe(false);
    });

    it("rejects out-of-range longitude", () => {
      expect(areValidCoordinates(0, 181)).toBe(false);
      expect(areValidCoordinates(0, -181)).toBe(false);
    });

    it("rejects NaN and Infinity", () => {
      expect(areValidCoordinates(NaN, 0)).toBe(false);
      expect(areValidCoordinates(0, NaN)).toBe(false);
      expect(areValidCoordinates(Infinity, 0)).toBe(false);
      expect(areValidCoordinates(0, -Infinity)).toBe(false);
    });
  });

  describe("getCurrentPosition", () => {
    it("resolves with position when geolocation succeeds", async () => {
      const mockPosition = {
        coords: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
      };
      mockGetCurrentPosition.mockImplementation((success) => success(mockPosition));

      const result = await getCurrentPosition();
      expect(result).toBe(mockPosition);
    });

    it("rejects when geolocation fails", async () => {
      const error = { code: 1, message: "Permission denied" };
      mockGetCurrentPosition.mockImplementation((_s, fail) => fail(error));

      await expect(getCurrentPosition()).rejects.toBe(error);
    });

    it("passes default options merged with custom options", async () => {
      const mockPosition = { coords: { latitude: 0, longitude: 0 } };
      mockGetCurrentPosition.mockImplementation((success) => success(mockPosition));

      await getCurrentPosition({ timeout: 5000 });

      expect(mockGetCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000,
        })
      );
    });

    it("rejects when geolocation is not supported", async () => {
      const original = global.navigator.geolocation;
      Object.defineProperty(global.navigator, "geolocation", {
        value: undefined,
        configurable: true,
      });

      await expect(getCurrentPosition()).rejects.toThrow(
        "Geolocation is not supported by this browser"
      );

      Object.defineProperty(global.navigator, "geolocation", {
        value: original,
        configurable: true,
      });
    });
  });

  describe("validateCurrentPositionAgainstGeofence", () => {
    const locationGeo = new GeoPoint(40.7128, -74.006);

    it("returns validation result when within geofence", async () => {
      mockGetCurrentPosition.mockImplementation((success) =>
        success({ coords: { latitude: 40.7128, longitude: -74.006 } })
      );

      const result = await validateCurrentPositionAgainstGeofence(locationGeo);
      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBe(-74.006);
      expect(result.distance).toBe(0);
      expect(result.isWithinGeofence).toBe(true);
    });

    it("returns isWithinGeofence=false when outside radius", async () => {
      mockGetCurrentPosition.mockImplementation((success) =>
        success({ coords: { latitude: 34.0522, longitude: -118.2437 } })
      );

      const result = await validateCurrentPositionAgainstGeofence(locationGeo, 300);
      expect(result.isWithinGeofence).toBe(false);
      expect(result.distance).toBeGreaterThan(300);
    });

    it("throws on invalid coordinates from device", async () => {
      mockGetCurrentPosition.mockImplementation((success) =>
        success({ coords: { latitude: NaN, longitude: NaN } })
      );

      await expect(
        validateCurrentPositionAgainstGeofence(locationGeo)
      ).rejects.toThrow("Invalid coordinates received from device");
    });
  });
});
