import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { ReportSchedule } from "@/lib/firebase/types";

export type ReportScheduleInput = Omit<
  ReportSchedule,
  "id" | "createdAt" | "lastRun"
>;

const COLLECTION_NAME = "reportSchedules";

export const reportScheduleService = {
  /**
   * Get all report schedules (Admin only)
   */
  getAll: async (): Promise<ReportSchedule[]> => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as ReportSchedule)
    );
  },

  /**
   * Create a new report schedule
   */
  create: async (input: ReportScheduleInput): Promise<string> => {
    const scheduleData = {
      ...input,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), scheduleData);
    return docRef.id;
  },

  /**
   * Update an existing report schedule
   */
  update: async (
    id: string,
    updates: Partial<Omit<ReportSchedule, "id" | "createdAt" | "createdBy">>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updates);
  },

  /**
   * Toggle schedule active state
   */
  toggleActive: async (
    id: string,
    isActive: boolean,
    nextRun?: Timestamp
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isActive,
      nextRun: nextRun ?? null,
    });
  },

  /**
   * Record that a schedule was run
   */
  recordRun: async (id: string, nextRun: Timestamp): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      lastRun: Timestamp.now(),
      nextRun,
    });
  },

  /**
   * Delete a report schedule
   */
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
