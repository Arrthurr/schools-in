import { GeoPoint, Timestamp } from "firebase/firestore";
import type { Location } from "@/lib/firebase/types";

type GeoLike =
  | GeoPoint
  | { latitude: number; longitude: number }
  | { lat: number; lng: number }
  | null
  | undefined;

/** Firestore / imports sometimes store lat-lng as numeric strings */
function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function extractLatitude(geo: GeoLike, fallback?: number): number | undefined {
  if (!geo) return fallback;
  if (geo instanceof GeoPoint) return geo.latitude;
  const fromLat =
    coerceFiniteNumber((geo as any).latitude) ??
    coerceFiniteNumber((geo as any).lat) ??
    coerceFiniteNumber((geo as any)._lat);
  if (fromLat !== undefined) return fromLat;
  return fallback;
}

function extractLongitude(geo: GeoLike, fallback?: number): number | undefined {
  if (!geo) return fallback;
  if (geo instanceof GeoPoint) return geo.longitude;
  const fromLng =
    coerceFiniteNumber((geo as any).longitude) ??
    coerceFiniteNumber((geo as any).lng) ??
    coerceFiniteNumber((geo as any)._long);
  if (fromLng !== undefined) return fromLng;
  return fallback;
}

export type NormalizedLocation = Location & {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  radius?: number;
  isActive?: boolean;
  description?: string;
  totalSessions?: number;
  activeProviders?: number;
};

export function normalizeLocationData(
  docId: string,
  rawData: Record<string, any>,
  options?: { allowMissingGeo?: boolean }
): NormalizedLocation | null {
  const baseData = rawData ?? {};
  const allowMissingGeo = options?.allowMissingGeo === true;

  const geoSource: GeoLike =
    baseData.geo ?? baseData.gpsCoordinates ?? baseData.coordinates;

  let latitude =
    coerceFiniteNumber(baseData.latitude) ??
    extractLatitude(geoSource);

  let longitude =
    coerceFiniteNumber(baseData.longitude) ??
    extractLongitude(geoSource);

  // If coordinates provided separately, prefer them for consistency
  if (baseData.coordinates) {
    latitude = extractLatitude(baseData.coordinates, latitude);
    longitude = extractLongitude(baseData.coordinates, longitude);
  }

  let geoPoint: GeoPoint | undefined;
  if (baseData.geo instanceof GeoPoint) {
    geoPoint = baseData.geo as GeoPoint;
  } else if (baseData.gpsCoordinates instanceof GeoPoint) {
    geoPoint = baseData.gpsCoordinates as GeoPoint;
  } else if (typeof latitude === "number" && typeof longitude === "number") {
    geoPoint = new GeoPoint(latitude, longitude);
  }

  const radiusMeters =
    typeof baseData.radiusMeters === "number"
      ? baseData.radiusMeters
      : typeof baseData.radius === "number"
      ? baseData.radius
      : 500;

  const assignedProviders = Array.isArray(baseData.assignedProviders)
    ? baseData.assignedProviders.filter((id: unknown) => typeof id === "string")
    : [];

  const toTimestamp = (value: any): Timestamp => {
    if (value && typeof value.toMillis === "function") {
      return Timestamp.fromDate(new Date(value.toMillis()));
    }
    return Timestamp.now();
  };

  const createdAt = toTimestamp(baseData.createdAt);
  const updatedAt = baseData.updatedAt
    ? toTimestamp(baseData.updatedAt)
    : createdAt;

  const isActive =
    baseData.active !== undefined
      ? baseData.active
      : baseData.isActive !== undefined
      ? baseData.isActive
      : true;

  // If we cannot resolve valid coordinates, treat the document as invalid (unless admin listing)
  const hasValidGeo =
    geoPoint &&
    typeof geoPoint.latitude === "number" &&
    typeof geoPoint.longitude === "number";
  if (!hasValidGeo && !allowMissingGeo) {
    return null;
  }

  const resolvedGeo = hasValidGeo ? geoPoint : undefined;

  const location: Partial<NormalizedLocation> = {
    id: docId,
    name: baseData.name ?? "",
    address: baseData.address ?? "",
    radiusMeters,
    radius:
      typeof baseData.radius === "number" ? baseData.radius : radiusMeters,
    timezone: baseData.timezone ?? "America/Chicago",
    assignedProviders,
    createdAt,
    updatedAt,
    isActive,
    active: isActive,
    region: baseData.region,
    latitude: typeof latitude === "number" ? latitude : undefined,
    longitude: typeof longitude === "number" ? longitude : undefined,
    description: baseData.description,
    totalSessions: baseData.totalSessions,
    activeProviders: assignedProviders.length, // Compute from assignedProviders array
    ...(resolvedGeo
      ? {
          geo: resolvedGeo,
          gpsCoordinates:
            baseData.gpsCoordinates instanceof GeoPoint
              ? baseData.gpsCoordinates
              : resolvedGeo,
        }
      : {}),
  };

  return location as NormalizedLocation;
}

interface BuildLocationInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  assignedProviders?: string[];
  timezone?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export function buildLocationWriteData(
  data: BuildLocationInput,
  existing?: Partial<Location>
): Record<string, unknown> {
  const geoPoint = new GeoPoint(data.latitude, data.longitude);
  const now = Timestamp.now();

  return {
    name: data.name,
    address: data.address,
    geo: geoPoint,
    gpsCoordinates: geoPoint,
    radiusMeters: data.radiusMeters,
    radius: data.radiusMeters,
    assignedProviders:
      data.assignedProviders ?? existing?.assignedProviders ?? [],
    timezone: data.timezone ?? existing?.timezone ?? "America/Chicago",
    isActive: data.isActive ?? existing?.isActive ?? true,
    active: data.isActive ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...((data.metadata as object) || {}),
  };
}

export function buildLocationUpdateData(
  data: Partial<BuildLocationInput>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.address !== undefined) updates.address = data.address;
  if (data.radiusMeters !== undefined) {
    updates.radiusMeters = data.radiusMeters;
    updates.radius = data.radiusMeters;
  }
  if (data.assignedProviders !== undefined) {
    updates.assignedProviders = data.assignedProviders;
  }
  if (data.timezone !== undefined) updates.timezone = data.timezone;
  if (data.isActive !== undefined) {
    updates.isActive = data.isActive;
    updates.active = data.isActive;
  }
  if (data.latitude !== undefined && data.longitude !== undefined) {
    const geo = new GeoPoint(data.latitude, data.longitude);
    updates.geo = geo;
    updates.gpsCoordinates = geo;
    updates.latitude = data.latitude;
    updates.longitude = data.longitude;
  }

  if (data.metadata) {
    Object.assign(updates, data.metadata);
  }

  updates.updatedAt = Timestamp.now();

  return updates;
}
