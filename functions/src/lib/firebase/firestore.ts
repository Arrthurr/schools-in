// Firestore database service and CRUD operations

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { User, Location, Session } from "./types";

// Collection names
export const COLLECTIONS = {
  USERS: "users",
  SESSIONS: "sessions",
  LOCATIONS: "locations",
} as const;

// Generic CRUD operations
export const createDocument = async <T extends object>(
  collectionName: string,
  data: T
): Promise<string> => {
  const docRef = await addDoc(collection(db, collectionName), data);
  return docRef.id;
};

export const getDocument = async <T>(
  collectionName: string,
  docId: string
): Promise<T | null> => {
  const docSnap = await getDoc(doc(db, collectionName, docId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
};

export const updateDocument = async (
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<void> => {
  await updateDoc(doc(db, collectionName, docId), data);
};

export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  await deleteDoc(doc(db, collectionName, docId));
};

export const getCollection = async <T>(
  collectionName: string
): Promise<T[]> => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
};

// Specific queries
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where("email", "==", email)
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  const doc = querySnapshot.docs[0];
  return { uid: doc.id, ...doc.data() } as User;
};

export const getLocationsByProvider = async (
  providerId: string
): Promise<Location[]> => {
  const q = query(
    collection(db, COLLECTIONS.LOCATIONS),
    where("assignedProviders", "array-contains", providerId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Location)
  );
};

export const getSessionsByUser = async (
  userId: string,
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    schoolId?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{ sessions: Session[]; total: number; hasMore: boolean }> => {
  // Build query constraints
  const constraints = [where("userId", "==", userId)];

  if (filters?.schoolId) {
    constraints.push(where("schoolId", "==", filters.schoolId));
  }

  // First, get total count with filters
  const countQuery = query(
    collection(db, COLLECTIONS.SESSIONS),
    ...constraints
  );
  const countSnapshot = await getDocs(countQuery);
  const total = countSnapshot.size;

  // Calculate offset for pagination
  const offset = (page - 1) * pageSize;

  // Build main query with filters
  const mainConstraints = [...constraints];

  // Add date range filters if provided
  if (filters?.startDate) {
    mainConstraints.push(
      where("checkInTime", ">=", Timestamp.fromDate(filters.startDate))
    );
  }
  if (filters?.endDate) {
    // Set end date to end of day
    const endOfDay = new Date(filters.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    mainConstraints.push(
      where("checkInTime", "<=", Timestamp.fromDate(endOfDay))
    );
  }

  // Get paginated results
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    ...mainConstraints,
    orderBy("checkInTime", "desc"),
    limit(pageSize + offset + 1) // Get one extra to check if there are more
  );

  const querySnapshot = await getDocs(q);
  const allDocs = querySnapshot.docs;

  // Apply offset and limit
  const sessions = allDocs
    .slice(offset, offset + pageSize)
    .map((doc) => ({ id: doc.id, ...doc.data() } as Session));

  const hasMore = allDocs.length > offset + pageSize;

  return { sessions, total, hasMore };
};

export const getActiveSessions = async (): Promise<Session[]> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where("status", "==", "active")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Session)
  );
};
