// Service for handling school-to-provider assignments

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "../firebase/firestore";
import { UserRecord } from "./userService";

export interface SchoolAssignment {
  schoolId: string;
  schoolName: string;
  schoolAddress: string;
  assignedProviders: ProviderAssignment[];
  isActive: boolean;
  totalProviders: number;
  lastUpdated: Timestamp;
}

export interface ProviderAssignment {
  userId: string;
  userEmail: string;
  displayName: string;
  assignedAt: Timestamp;
  isActive: boolean;
}

export interface AssignmentStats {
  totalSchools: number;
  schoolsWithProviders: number;
  schoolsWithoutProviders: number;
  totalAssignments: number;
  activeProviders: number;
}

// Get all school assignments with provider information
export const getSchoolAssignments = async (): Promise<SchoolAssignment[]> => {
  try {
    // Get all schools
    const schoolsQuery = query(
      collection(db, COLLECTIONS.LOCATIONS),
      orderBy("name")
    );
    const schoolsSnapshot = await getDocs(schoolsQuery);

    // Get all providers
    const providersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider")
    );
    const providersSnapshot = await getDocs(providersQuery);

    const providers = providersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserRecord[];

    // Build school assignments
    const assignments: SchoolAssignment[] = [];

    for (const schoolDoc of schoolsSnapshot.docs) {
      const schoolData = schoolDoc.data();
      const schoolId = schoolDoc.id;

      // Find providers assigned to this school
      const assignedProviders: ProviderAssignment[] = providers
        .filter((provider) => provider.assignedSchools?.includes(schoolId))
        .map((provider) => ({
          userId: provider.id,
          userEmail: provider.email || "",
          displayName: provider.displayName || "Unknown",
          assignedAt: provider.createdAt || Timestamp.now(),
          isActive: provider.isActive,
        }));

      assignments.push({
        schoolId,
        schoolName: schoolData.name || "Unknown School",
        schoolAddress: schoolData.address || "",
        assignedProviders,
        isActive: schoolData.isActive !== false,
        totalProviders: assignedProviders.length,
        lastUpdated:
          schoolData.updatedAt || schoolData.createdAt || Timestamp.now(),
      });
    }

    return assignments;
  } catch (error) {
    console.error("Error getting school assignments:", error);
    throw new Error("Failed to fetch school assignments");
  }
};

// Assign a provider to a school
export const assignProviderToSchool = async (
  providerId: string,
  schoolId: string
): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, providerId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("Provider not found");
    }

    const userData = userDoc.data();
    const currentAssignments = userData.assignedSchools || [];

    // Add school if not already assigned
    if (!currentAssignments.includes(schoolId)) {
      const updatedAssignments = [...currentAssignments, schoolId];

      await updateDoc(userRef, {
        assignedSchools: updatedAssignments,
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error("Error assigning provider to school:", error);
    throw new Error("Failed to assign provider to school");
  }
};

// Remove a provider from a school
export const removeProviderFromSchool = async (
  providerId: string,
  schoolId: string
): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, providerId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("Provider not found");
    }

    const userData = userDoc.data();
    const currentAssignments = userData.assignedSchools || [];

    // Remove school from assignments
    const updatedAssignments = currentAssignments.filter(
      (assignedSchoolId: string) => assignedSchoolId !== schoolId
    );

    await updateDoc(userRef, {
      assignedSchools: updatedAssignments,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error removing provider from school:", error);
    throw new Error("Failed to remove provider from school");
  }
};

// Bulk assign multiple providers to a school
export const bulkAssignProvidersToSchool = async (
  providerIds: string[],
  schoolId: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const timestamp = Timestamp.now();

    for (const providerId of providerIds) {
      const userRef = doc(db, COLLECTIONS.USERS, providerId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentAssignments = userData.assignedSchools || [];

        if (!currentAssignments.includes(schoolId)) {
          const updatedAssignments = [...currentAssignments, schoolId];
          batch.update(userRef, {
            assignedSchools: updatedAssignments,
            updatedAt: timestamp,
          });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error bulk assigning providers to school:", error);
    throw new Error("Failed to bulk assign providers to school");
  }
};

// Bulk remove multiple providers from a school
export const bulkRemoveProvidersFromSchool = async (
  providerIds: string[],
  schoolId: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const timestamp = Timestamp.now();

    for (const providerId of providerIds) {
      const userRef = doc(db, COLLECTIONS.USERS, providerId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentAssignments = userData.assignedSchools || [];

        const updatedAssignments = currentAssignments.filter(
          (assignedSchoolId: string) => assignedSchoolId !== schoolId
        );

        batch.update(userRef, {
          assignedSchools: updatedAssignments,
          updatedAt: timestamp,
        });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error bulk removing providers from school:", error);
    throw new Error("Failed to bulk remove providers from school");
  }
};

// Replace all assignments for a school
export const replaceSchoolAssignments = async (
  schoolId: string,
  newProviderIds: string[]
): Promise<void> => {
  try {
    // Get all current providers
    const providersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider")
    );
    const providersSnapshot = await getDocs(providersQuery);

    const batch = writeBatch(db);
    const timestamp = Timestamp.now();

    // Update all providers
    for (const providerDoc of providersSnapshot.docs) {
      const providerId = providerDoc.id;
      const providerData = providerDoc.data();
      const currentAssignments = providerData.assignedSchools || [];

      let updatedAssignments = currentAssignments.filter(
        (assignedSchoolId: string) => assignedSchoolId !== schoolId
      );

      // Add school if this provider should be assigned
      if (newProviderIds.includes(providerId)) {
        updatedAssignments.push(schoolId);
      }

      batch.update(doc(db, COLLECTIONS.USERS, providerId), {
        assignedSchools: updatedAssignments,
        updatedAt: timestamp,
      });
    }

    await batch.commit();
  } catch (error) {
    console.error("Error replacing school assignments:", error);
    throw new Error("Failed to replace school assignments");
  }
};

// Get assignment statistics
export const getAssignmentStats = async (): Promise<AssignmentStats> => {
  try {
    const assignments = await getSchoolAssignments();

    const schoolsWithProviders = assignments.filter(
      (assignment) => assignment.totalProviders > 0
    ).length;

    const totalAssignments = assignments.reduce(
      (total, assignment) => total + assignment.totalProviders,
      0
    );

    const activeProviders = new Set();
    assignments.forEach((assignment) => {
      assignment.assignedProviders.forEach((provider) => {
        if (provider.isActive) {
          activeProviders.add(provider.userId);
        }
      });
    });

    return {
      totalSchools: assignments.length,
      schoolsWithProviders,
      schoolsWithoutProviders: assignments.length - schoolsWithProviders,
      totalAssignments,
      activeProviders: activeProviders.size,
    };
  } catch (error) {
    console.error("Error getting assignment stats:", error);
    throw new Error("Failed to fetch assignment statistics");
  }
};

// Get unassigned providers
export const getUnassignedProviders = async (): Promise<UserRecord[]> => {
  try {
    const providersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider"),
      where("isActive", "==", true)
    );
    const providersSnapshot = await getDocs(providersQuery);

    return providersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as UserRecord))
      .filter(
        (provider) =>
          !provider.assignedSchools || provider.assignedSchools.length === 0
      );
  } catch (error) {
    console.error("Error getting unassigned providers:", error);
    throw new Error("Failed to fetch unassigned providers");
  }
};

// Get all available providers (for assignment dropdowns)
export const getAvailableProviders = async (): Promise<UserRecord[]> => {
  try {
    const providersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider"),
      where("isActive", "==", true),
      orderBy("displayName")
    );
    const providersSnapshot = await getDocs(providersQuery);

    return providersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserRecord[];
  } catch (error) {
    console.error("Error getting available providers:", error);
    throw new Error("Failed to fetch available providers");
  }
};
