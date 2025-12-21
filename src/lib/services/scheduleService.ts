import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "../firebase/firestore";
import { Schedule } from "../firebase/types";
import { isProviderAssigned } from "./locationService";

interface CreateScheduleInput {
  providerId: string;
  locationId: string;
  serviceId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM 24-hour
  endTime: string; // HH:MM 24-hour
  createdBy: string;
  isActive?: boolean;
}

interface UpdateScheduleInput {
  locationId?: string;
  serviceId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

const schedulesCollection = collection(db, COLLECTIONS.SCHEDULES);

function mapSchedule(scheduleDoc: DocumentSnapshot): Schedule {
  return {
    id: scheduleDoc.id,
    ...scheduleDoc.data(),
  } as Schedule;
}

async function ensureProviderAssignedToLocation(
  providerId: string,
  locationId: string
): Promise<void> {
  const assigned = await isProviderAssigned(providerId, locationId);
  if (!assigned) {
    throw new Error("Provider is not assigned to this location");
  }
}

async function ensureServiceExists(serviceId: string): Promise<void> {
  const serviceRef = doc(db, COLLECTIONS.SERVICES, serviceId);
  const serviceDoc = await getDoc(serviceRef);

  if (!serviceDoc.exists()) {
    throw new Error("Service not found");
  }

  const data = serviceDoc.data() as { isActive?: boolean };
  if (data.isActive === false) {
    throw new Error("Service is inactive");
  }
}

/**
 * Create a new schedule entry (admin only - enforced by Firestore rules)
 */
export async function createSchedule(
  data: CreateScheduleInput
): Promise<string> {
  await ensureProviderAssignedToLocation(data.providerId, data.locationId);
  await ensureServiceExists(data.serviceId);

  const now = Timestamp.now();
  const docRef = await addDoc(schedulesCollection, {
    ...data,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

/**
 * Update an existing schedule (admin only - enforced by Firestore rules)
 */
export async function updateSchedule(
  scheduleId: string,
  data: UpdateScheduleInput
): Promise<void> {
  const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId);

  if (data.serviceId) {
    await ensureServiceExists(data.serviceId);
  }

  await updateDoc(scheduleRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Soft delete a schedule (admin only - enforced by Firestore rules)
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId);
  await updateDoc(scheduleRef, {
    isActive: false,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get all schedules for a provider (active by default)
 */
export async function getSchedulesByProvider(
  providerId: string,
  includeInactive = false
): Promise<Schedule[]> {
  const constraints = [where("providerId", "==", providerId)];
  const q = query(schedulesCollection, ...constraints);
  const snapshot = await getDocs(q);

  const schedules = snapshot.docs.map(mapSchedule);
  const filtered = includeInactive
    ? schedules
    : schedules.filter((schedule) => schedule.isActive !== false);

  return filtered.sort((a, b) => {
    if (a.dayOfWeek === b.dayOfWeek) {
      return a.startTime.localeCompare(b.startTime);
    }
    return a.dayOfWeek - b.dayOfWeek;
  });
}

/**
 * Get all schedules for a location (active by default)
 */
export async function getSchedulesByLocation(
  locationId: string,
  includeInactive = false
): Promise<Schedule[]> {
  const constraints = [where("locationId", "==", locationId)];
  const q = query(schedulesCollection, ...constraints);
  const snapshot = await getDocs(q);

  const schedules = snapshot.docs.map(mapSchedule);
  const filtered = includeInactive
    ? schedules
    : schedules.filter((schedule) => schedule.isActive !== false);

  return filtered.sort((a, b) => {
    if (a.dayOfWeek === b.dayOfWeek) {
      return a.startTime.localeCompare(b.startTime);
    }
    return a.dayOfWeek - b.dayOfWeek;
  });
}

/**
 * Get schedules for a provider at a specific location
 */
export async function getSchedulesByProviderAndLocation(
  providerId: string,
  locationId: string,
  includeInactive = false
): Promise<Schedule[]> {
  const constraints = [
    where("providerId", "==", providerId),
    where("locationId", "==", locationId),
  ];
  const q = query(schedulesCollection, ...constraints);
  const snapshot = await getDocs(q);

  const schedules = snapshot.docs.map(mapSchedule);
  const filtered = includeInactive
    ? schedules
    : schedules.filter((schedule) => schedule.isActive !== false);

  return filtered.sort((a, b) => {
    if (a.dayOfWeek === b.dayOfWeek) {
      return a.startTime.localeCompare(b.startTime);
    }
    return a.dayOfWeek - b.dayOfWeek;
  });
}

/**
 * Get schedules for a provider on a specific day of week (active only)
 */
export async function getSchedulesForDay(
  providerId: string,
  dayOfWeek: number
): Promise<Schedule[]> {
  const constraints = [
    where("providerId", "==", providerId),
    where("dayOfWeek", "==", dayOfWeek),
    orderBy("startTime"),
  ];

  const q = query(schedulesCollection, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(mapSchedule)
    .filter((schedule) => schedule.isActive !== false);
}

/**
 * Get the earliest schedule for a provider on a given day
 */
export async function getEarliestScheduleForDay(
  providerId: string,
  dayOfWeek: number
): Promise<Schedule | null> {
  const constraints = [
    where("providerId", "==", providerId),
    where("dayOfWeek", "==", dayOfWeek),
    orderBy("startTime"),
    limit(1),
  ];

  const q = query(schedulesCollection, ...constraints);
  const snapshot = await getDocs(q);
  const schedule = snapshot.docs
    .map(mapSchedule)
    .find((item) => item.isActive !== false);

  return schedule ?? null;
}

/**
 * Soft delete all schedules for a provider at a location
 * Used for cascade when unassigning a provider from a school
 */
export async function softDeleteSchedulesForProviderAtLocation(
  providerId: string,
  locationId: string
): Promise<void> {
  const schedules = await getSchedulesByProviderAndLocation(
    providerId,
    locationId,
    true
  );

  await Promise.all(
    schedules.map((schedule) =>
      updateSchedule(schedule.id, { isActive: false })
    )
  );
}

