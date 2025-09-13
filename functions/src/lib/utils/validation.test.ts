// Unit tests for validation utilities

import { z } from "zod";
import { GeoPoint, Timestamp } from "firebase/firestore";
import { userSchema, locationSchema, sessionSchema } from "./validation";

// Mock GeoPoint and Timestamp for testing
const mockGeoPoint = {
  latitude: 40.7128,
  longitude: -74.006,
  isEqual: jest.fn(),
  toJSON: jest.fn(),
} as any;

const mockTimestamp = {
  seconds: Math.floor(Date.now() / 1000),
  nanoseconds: 0,
  toMillis: () => Date.now(),
  toDate: () => new Date(),
  isEqual: jest.fn(),
  valueOf: jest.fn(),
  toJSON: jest.fn(),
} as any;

// Mock the GeoPoint and Timestamp constructors
jest.mock("firebase/firestore", () => ({
  GeoPoint: jest.fn().mockImplementation((lat, lng) => ({
    latitude: lat,
    longitude: lng,
    isEqual: jest.fn(),
    toJSON: jest.fn(),
  })),
  Timestamp: jest.fn().mockImplementation((seconds, nanoseconds) => ({
    seconds,
    nanoseconds,
    toDate: jest.fn(() => new Date(seconds * 1000)),
    toMillis: jest.fn(() => seconds * 1000),
    isEqual: jest.fn(),
    valueOf: jest.fn(),
    toJSON: jest.fn(),
  })),
}));

// Set up instanceof checks for mocks
const MockedGeoPoint = require("firebase/firestore").GeoPoint;
const MockedTimestamp = require("firebase/firestore").Timestamp;

// Make instanceof work with our mocks
Object.defineProperty(MockedGeoPoint, Symbol.hasInstance, {
  value: (instance: any) => {
    return (
      instance &&
      typeof instance.latitude === "number" &&
      typeof instance.longitude === "number"
    );
  },
});

Object.defineProperty(MockedTimestamp, Symbol.hasInstance, {
  value: (instance: any) => {
    return (
      instance &&
      typeof instance.seconds === "number" &&
      typeof instance.nanoseconds === "number"
    );
  },
});

// Create actual mock instances
const actualMockGeoPoint = new MockedGeoPoint(40.7128, -74.006);
const actualMockTimestamp = new MockedTimestamp(
  Math.floor(Date.now() / 1000),
  0
);

describe("Validation Schemas", () => {
  describe("userSchema", () => {
    it("validates valid user data", () => {
      const validUser = {
        uid: "user123",
        email: "user@example.com",
        displayName: "John Doe",
        role: "provider" as const,
        assignedLocations: ["school1", "school2"],
      };

      expect(() => userSchema.parse(validUser)).not.toThrow();
      const result = userSchema.parse(validUser);
      expect(result).toEqual(validUser);
    });

    it("validates user with null email and displayName", () => {
      const validUser = {
        uid: "user123",
        email: null,
        displayName: null,
        role: "admin" as const,
      };

      expect(() => userSchema.parse(validUser)).not.toThrow();
    });

    it("rejects invalid uid", () => {
      const invalidUser = {
        uid: "",
        email: "user@example.com",
        displayName: "John Doe",
        role: "provider" as const,
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    it("rejects invalid email format", () => {
      const invalidUser = {
        uid: "user123",
        email: "invalid-email",
        displayName: "John Doe",
        role: "provider" as const,
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    it("rejects invalid role", () => {
      const invalidUser = {
        uid: "user123",
        email: "user@example.com",
        displayName: "John Doe",
        role: "invalid-role",
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    it("validates optional assignedLocations", () => {
      const userWithoutLocations = {
        uid: "user123",
        email: "user@example.com",
        displayName: "John Doe",
        role: "provider" as const,
      };

      expect(() => userSchema.parse(userWithoutLocations)).not.toThrow();
    });
  });

  describe("locationSchema", () => {
    it("validates valid location data", () => {
      const validLocation = {
        id: "location123",
        name: "Test School",
        address: "123 Main St, City, State 12345",
        gpsCoordinates: actualMockGeoPoint,
        radius: 100,
      };

      expect(() => locationSchema.parse(validLocation)).not.toThrow();
      const result = locationSchema.parse(validLocation);
      expect(result).toEqual(validLocation);
    });

    it("rejects invalid id", () => {
      const invalidLocation = {
        id: "",
        name: "Test School",
        address: "123 Main St, City, State 12345",
        gpsCoordinates: mockGeoPoint,
        radius: 100,
      };

      expect(() => locationSchema.parse(invalidLocation)).toThrow();
    });

    it("rejects name too short", () => {
      const invalidLocation = {
        id: "location123",
        name: "A",
        address: "123 Main St, City, State 12345",
        gpsCoordinates: mockGeoPoint,
        radius: 100,
      };

      expect(() => locationSchema.parse(invalidLocation)).toThrow();
    });

    it("rejects address too short", () => {
      const invalidLocation = {
        id: "location123",
        name: "Test School",
        address: "123",
        gpsCoordinates: mockGeoPoint,
        radius: 100,
      };

      expect(() => locationSchema.parse(invalidLocation)).toThrow();
    });

    it("rejects invalid GeoPoint", () => {
      const invalidLocation = {
        id: "location123",
        name: "Test School",
        address: "123 Main St, City, State 12345",
        gpsCoordinates: "invalid-geopoint", // Not a GeoPoint
        radius: 100,
      };

      expect(() => locationSchema.parse(invalidLocation)).toThrow();
    });

    it("rejects non-positive radius", () => {
      const invalidLocation = {
        id: "location123",
        name: "Test School",
        address: "123 Main St, City, State 12345",
        gpsCoordinates: actualMockGeoPoint,
        radius: 0,
      };

      expect(() => locationSchema.parse(invalidLocation)).toThrow();
    });

    it("rejects negative radius", () => {
      const invalidLocation = {
        id: "location123",
        name: "Test School",
        address: "123 Main St, City, State 12345",
        gpsCoordinates: actualMockGeoPoint,
        radius: -50,
      };

      expect(() => locationSchema.parse(invalidLocation)).toThrow();
    });
  });

  describe("sessionSchema", () => {
    it("validates valid session data", () => {
      const validSession = {
        id: "session123",
        userId: "user123",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "active" as const,
        duration: 150,
      };

      expect(() => sessionSchema.parse(validSession)).not.toThrow();
      const result = sessionSchema.parse(validSession);
      expect(result).toEqual(validSession);
    });

    it("validates session with checkOutTime", () => {
      const validSession = {
        id: "session123",
        userId: "user123",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: actualMockTimestamp,
        status: "completed" as const,
        duration: 150,
      };

      expect(() => sessionSchema.parse(validSession)).not.toThrow();
    });

    it("rejects invalid id", () => {
      const invalidSession = {
        id: "",
        userId: "user123",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "active" as const,
      };

      expect(() => sessionSchema.parse(invalidSession)).toThrow();
    });

    it("rejects invalid userId", () => {
      const invalidSession = {
        id: "session123",
        userId: "",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "active" as const,
      };

      expect(() => sessionSchema.parse(invalidSession)).toThrow();
    });

    it("rejects invalid locationId", () => {
      const invalidSession = {
        id: "session123",
        userId: "user123",
        locationId: "",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "active" as const,
      };

      expect(() => sessionSchema.parse(invalidSession)).toThrow();
    });

    it("rejects invalid Timestamp for checkInTime", () => {
      const invalidSession = {
        id: "session123",
        userId: "user123",
        locationId: "location123",
        checkInTime: new Date(), // Not a Timestamp
        checkOutTime: null,
        status: "active" as const,
      };

      expect(() => sessionSchema.parse(invalidSession)).toThrow();
    });

    it("rejects invalid status", () => {
      const invalidSession = {
        id: "session123",
        userId: "user123",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "invalid-status",
      };

      expect(() => sessionSchema.parse(invalidSession)).toThrow();
    });

    it("validates optional duration", () => {
      const sessionWithoutDuration = {
        id: "session123",
        userId: "user123",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "active" as const,
      };

      expect(() => sessionSchema.parse(sessionWithoutDuration)).not.toThrow();
    });

    it("rejects non-positive duration", () => {
      const invalidSession = {
        id: "session123",
        userId: "user123",
        locationId: "location123",
        checkInTime: actualMockTimestamp,
        checkOutTime: null,
        status: "active" as const,
        duration: 0,
      };

      expect(() => sessionSchema.parse(invalidSession)).toThrow();
    });
  });
});
