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

    expect(writeData.geo).toMatchObject({ latitude: 42.1, longitude: -88.2 });
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
    expect(updateData.geo).toMatchObject({ latitude: 43.2, longitude: -89.3 });
    expect(updateData.isActive).toBe(false);
  });
});
