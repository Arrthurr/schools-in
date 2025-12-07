import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "../firebase/firestore";
import { Service } from "../firebase/types";

interface CreateServiceInput {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
}

interface UpdateServiceInput {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Create a new service (admin only - enforced by Firestore rules)
 */
export async function createService(data: CreateServiceInput): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.SERVICES), {
    ...data,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

/**
 * Update an existing service (admin only - enforced by Firestore rules)
 */
export async function updateService(
  serviceId: string,
  data: UpdateServiceInput
): Promise<void> {
  const serviceRef = doc(db, COLLECTIONS.SERVICES, serviceId);
  await updateDoc(serviceRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get a single service by ID
 */
export async function getServiceById(serviceId: string): Promise<Service | null> {
  const docRef = doc(db, COLLECTIONS.SERVICES, serviceId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Service;
}

/**
 * Get all active services, sorted by name
 */
export async function getAllServices(onlyActive = true): Promise<Service[]> {
  const constraints = [
    ...(onlyActive ? [where("isActive", "==", true)] : []),
    orderBy("name"),
  ];

  const q = query(collection(db, COLLECTIONS.SERVICES), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (serviceDoc) => ({ id: serviceDoc.id, ...serviceDoc.data() } as Service)
  );
}

