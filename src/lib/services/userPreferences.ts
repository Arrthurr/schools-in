import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { appLogger } from "@/lib/logging/appLogger";

const AUTO_GEOFENCE_PREF_KEY = "auto_geofence_check_enabled";

export async function getAutoGeofencePreference(
  userId: string
): Promise<boolean> {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return false;
    }

    const data = snap.data();
    const enabled =
      typeof data.autoGeofenceCheckEnabled === "boolean"
        ? data.autoGeofenceCheckEnabled
        : false;

    // Mirror to localStorage for faster subsequent reads
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        AUTO_GEOFENCE_PREF_KEY,
        enabled ? "true" : "false"
      );
    }

    return enabled;
  } catch (error) {
    appLogger.warn("Failed to read auto geofence preference", { error });
    return false;
  }
}

export async function setAutoGeofencePreference(
  userId: string,
  enabled: boolean
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, userId);

  await updateDoc(docRef, {
    autoGeofenceCheckEnabled: enabled,
    updatedAt: Timestamp.now(),
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      AUTO_GEOFENCE_PREF_KEY,
      enabled ? "true" : "false"
    );
  }
}

export function getAutoGeofencePreferenceFromStorage(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(AUTO_GEOFENCE_PREF_KEY);
  if (stored === null) return null;
  return stored === "true";
}

export function clearAutoGeofencePreferenceFromStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTO_GEOFENCE_PREF_KEY);
}

export const autoGeofencePreferenceKey = AUTO_GEOFENCE_PREF_KEY;
