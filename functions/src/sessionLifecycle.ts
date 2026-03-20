import { calculateDistance } from "./utils";

export interface StartSessionInput {
  locationId: string;
  startTime: string;
  checkInMethod: "geo" | "manual" | "offline-sync";
  dayKey: string;
  checkInLocation?: { latitude: number; longitude: number; accuracy?: number };
  distanceFromCenterAtCheckIn?: number;
  notes?: string;
  durationMinutes?: number;
}

export interface UserData {
  role: "provider" | "admin";
  isActive?: boolean;
  disabled?: boolean;
}

export interface LocationData {
  active?: boolean;
  assignedProviders?: string[];
  geo?: { latitude: number; longitude: number };
  radiusMeters?: number;
}

/**
 * Validate that the check-in method is allowed for this user's role
 */
export function validateCheckInMethod(role: "provider" | "admin", method: string): void {
  const validMethods = ["geo", "manual", "offline-sync"];
  if (!validMethods.includes(method)) {
    throw new Error(`Invalid checkInMethod: ${method}. Must be one of: ${validMethods.join(", ")}`);
  }
  if (role === "provider" && !["geo", "manual", "offline-sync"].includes(method)) {
    throw new Error("Invalid check-in method for provider.");
  }
  if (role === "admin" && method !== "manual") {
    throw new Error("Admins must use manual check-in method.");
  }
}

/**
 * Validate user is active and has a valid role
 */
export function validateUserForSession(userData: UserData): void {
  if (!userData.role || !["provider", "admin"].includes(userData.role)) {
    throw new Error("Invalid user role for session creation");
  }
  if (userData.isActive === false || userData.disabled === true) {
    throw new Error("User account is not active");
  }
}

/**
 * Validate provider is assigned to location
 */
export function validateProviderAssignment(
  role: "provider" | "admin",
  userId: string,
  locationData: LocationData
): void {
  if (role === "provider") {
    if (!locationData.assignedProviders?.includes(userId)) {
      throw new Error("Provider is not assigned to this location");
    }
  }
  // Admins can access any location
}

/**
 * Validate location is active
 */
export function validateLocationActive(locationData: LocationData): void {
  if (locationData.active === false) {
    throw new Error("Location is not active");
  }
}

/**
 * Calculate and validate geofence distance. Returns the calculated distance.
 * Throws if outside radius for applicable check-in methods.
 */
export function validateGeofence(
  checkInMethod: string,
  checkInLocation: { latitude: number; longitude: number } | undefined,
  locationGeo: { latitude: number; longitude: number } | undefined,
  radiusMeters: number,
  clientDistance?: number
): number {
  let distanceFromCenter = clientDistance || 0;

  if (
    checkInLocation &&
    typeof checkInLocation.latitude === "number" &&
    typeof checkInLocation.longitude === "number" &&
    locationGeo
  ) {
    distanceFromCenter = calculateDistance(
      checkInLocation.latitude,
      checkInLocation.longitude,
      locationGeo.latitude,
      locationGeo.longitude
    );

    if (distanceFromCenter > radiusMeters) {
      const distance = Math.round(distanceFromCenter);
      throw new Error(
        `You must be within ${radiusMeters}m of the location to check in. Current distance: ${distance}m`
      );
    }
  } else if (checkInMethod === "manual") {
    throw new Error("Manual check-in requires checkInLocation with latitude and longitude");
  }

  return distanceFromCenter;
}

/**
 * Validate required fields for starting a session
 */
export function validateStartSessionInput(data: any): void {
  if (!data || !data.locationId || !data.startTime || !data.checkInMethod || !data.dayKey) {
    throw new Error("Missing required session data: locationId, startTime, checkInMethod, dayKey");
  }
}

/**
 * Validate required fields for ending a session
 */
export function validateEndSessionInput(data: any): void {
  if (!data?.sessionId || !data?.checkOutTime) {
    throw new Error("Missing required session data: sessionId, checkOutTime");
  }
}

/**
 * Validate session ownership for checkout
 */
export function validateSessionOwnership(sessionUserId: string, requestUserId: string): void {
  if (sessionUserId !== requestUserId) {
    throw new Error("You are not authorized to end this session.");
  }
}

/**
 * Validate session is in a checkable-out state
 */
export function validateSessionStatus(status: string): void {
  if (!["active", "paused"].includes(status)) {
    throw new Error("Session is not active.");
  }
}

/**
 * Calculate session duration in minutes
 */
export function calculateDurationMinutes(startTimeMs: number, endTimeMs: number): number {
  return Math.max(0, Math.floor((endTimeMs - startTimeMs) / (1000 * 60)));
}

/**
 * Check if a proposed offline-sync session would be a duplicate
 * (within 5-minute window of an existing session)
 */
export function isWithinDuplicateWindow(proposedStartTime: string, existingStartTimeMs: number): boolean {
  const proposedStart = new Date(proposedStartTime).getTime();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  return Math.abs(proposedStart - existingStartTimeMs) <= windowMs;
}

/**
 * Validate schedule-based time gating for provider manual check-in.
 * Returns true if allowed, throws with message if too early.
 *
 * @param currentMinutes - current time in minutes since midnight (America/Chicago)
 * @param activeStartTimes - sorted array of "HH:MM" strings for active schedules
 */
export function validateScheduleGating(
  currentMinutes: number,
  activeStartTimes: string[]
): void {
  if (activeStartTimes.length === 0) return;

  const earliestStartTime = activeStartTimes[0]; // already sorted
  const [hours, minutes] = earliestStartTime.split(":").map(Number);
  const scheduleMinutes = hours * 60 + minutes;
  const earliestCheckInMinutes = scheduleMinutes - 15;

  if (currentMinutes < earliestCheckInMinutes) {
    const checkInHour = Math.floor(earliestCheckInMinutes / 60);
    const checkInMin = earliestCheckInMinutes % 60;
    const ampm = checkInHour >= 12 ? "PM" : "AM";
    const displayHour = checkInHour > 12 ? checkInHour - 12 : checkInHour === 0 ? 12 : checkInHour;
    const timeStr = `${displayHour}:${String(checkInMin).padStart(2, "0")} ${ampm}`;
    throw new Error(
      `Check-in opens at ${timeStr}. Your first session starts at ${earliestStartTime}.`
    );
  }
}
