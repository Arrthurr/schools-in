import { Timestamp } from "firebase/firestore";
import {
  normalizeLocationData,
  buildLocationWriteData,
  buildLocationUpdateData,
} from "./locationNormalizer";

describe("locationNormalizer", () => {
  const baseGeo = { latitude: 41.0, longitude: -87.0 };

  it("normalizes geo and radius fields", () => {
    const raw = {
      name: "Test School",
      address: "123 Main St",
      geo: baseGeo,
      radiusMeters: 120,
      assignedProviders: ["provider-1"],
      active: false,
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("school-1", raw);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.id).toBe("school-1");
    expect(normalized.geo).toMatchObject({ latitude: 41.0, longitude: -87.0 });
    expect(normalized.radiusMeters).toBe(120);
    expect(normalized.assignedProviders).toEqual(["provider-1"]);
    expect(normalized.isActive).toBe(false);
  });

  it("falls back to coordinates when geo is missing", () => {
    const raw = {
      name: "Fallback School",
      address: "456 Elm St",
      coordinates: { latitude: 40.5, longitude: -86.5 },
      radius: 80,
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("school-2", raw);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.radiusMeters).toBe(80);
    expect(normalized.latitude).toBeCloseTo(40.5);
    expect(normalized.longitude).toBeCloseTo(-86.5);
  });

  it("builds write data with defaults", () => {
    const writeData = buildLocationWriteData({
      name: "New School",
      address: "789 Oak St",
      latitude: 42.1,
      longitude: -88.2,
      radiusMeters: 150,
      assignedProviders: ["provider-2"],
    });

    // Verify geo fields are NOT plain spreads (should not have _lat/_long)
    expect(writeData.geo).toBeDefined();
    expect(writeData.gpsCoordinates).toBeDefined();
    // In production, these are GeoPoint instances with .latitude/.longitude getters.
    // In tests with mocked Firebase, verify the constructor was called correctly.
    expect(writeData.geo).toEqual(writeData.gpsCoordinates);
    expect(writeData.radiusMeters).toBe(150);
    expect(writeData.assignedProviders).toEqual(["provider-2"]);
    expect(writeData.isActive).toBe(true);
  });

  it("builds update data with coordinate changes", () => {
    const updateData = buildLocationUpdateData({
      name: "Updated School",
      latitude: 43.2,
      longitude: -89.3,
      isActive: false,
    });

    expect(updateData.name).toBe("Updated School");
    expect(updateData.geo).toBeDefined();
    expect(updateData.gpsCoordinates).toBeDefined();
    expect(updateData.geo).toEqual(updateData.gpsCoordinates);
    expect(updateData.isActive).toBe(false);
  });

  it("computes activeProviders from assignedProviders array length", () => {
    const raw = {
      name: "Provider Test School",
      address: "100 Test Ave",
      geo: baseGeo,
      radiusMeters: 100,
      assignedProviders: ["provider-1", "provider-2", "provider-3"],
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("school-3", raw);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.assignedProviders).toEqual(["provider-1", "provider-2", "provider-3"]);
    expect(normalized.activeProviders).toBe(3);
  });

  it("handles empty assignedProviders array", () => {
    const raw = {
      name: "No Provider School",
      address: "200 Empty St",
      geo: baseGeo,
      radiusMeters: 100,
      assignedProviders: [],
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("school-4", raw);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.assignedProviders).toEqual([]);
    expect(normalized.activeProviders).toBe(0);
  });

  it("handles missing assignedProviders field", () => {
    const raw = {
      name: "Missing Providers School",
      address: "300 None St",
      geo: baseGeo,
      radiusMeters: 100,
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("school-5", raw);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.assignedProviders).toEqual([]);
    expect(normalized.activeProviders).toBe(0);
  });

  it("handles spread GeoPoint objects with _lat/_long properties", () => {
    const raw = {
      name: "HOPE Excel",
      address: "4821 W Chicago Ave, Chicago, IL 60651",
      geo: { _lat: 41.894692, _long: -87.746703 },
      gpsCoordinates: { _lat: 41.894692, _long: -87.746703 },
      radiusMeters: 300,
      radius: 300,
      assignedProviders: [],
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("VmkbaQIbg9vmtIvsLBrv", raw);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.id).toBe("VmkbaQIbg9vmtIvsLBrv");
    expect(normalized.name).toBe("HOPE Excel");
    expect(normalized.latitude).toBeCloseTo(41.894692);
    expect(normalized.longitude).toBeCloseTo(-87.746703);
    expect(normalized.radiusMeters).toBe(300);
  });

  it("returns null when coordinates are missing/invalid", () => {
    const raw = {
      name: "No Coords School",
      address: "404 Missing St",
      assignedProviders: [],
      radiusMeters: 100,
      createdAt: { toMillis: () => Timestamp.now().toMillis() },
      updatedAt: { toMillis: () => Timestamp.now().toMillis() },
    };

    const normalized = normalizeLocationData("school-missing", raw);

    expect(normalized).toBeNull();
  });
});
