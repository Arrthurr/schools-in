/**
 * Assignment Service - Manages provider-to-location assignments
 * 
 * IMPORTANT: This service now uses Location.assignedProviders as the
 * single source of truth. User documents no longer store assignment arrays.
 */

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
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "../firebase/firestore";
import { UserRecord } from "./userService";
import { Location } from "../firebase/types";

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
    // Get all locations
    const locationsQuery = query(
      collection(db, COLLECTIONS.LOCATIONS),
      orderBy("name")
    );
    const locationsSnapshot = await getDocs(locationsQuery);

    // Get all providers for name lookups
    const providersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider")
    );
    const providersSnapshot = await getDocs(providersQuery);

    const providersMap = new Map<string, UserRecord>();
    providersSnapshot.docs.forEach((doc) => {
      providersMap.set(doc.id, {
        id: doc.id,
        ...doc.data(),
      } as UserRecord);
    });

    // Build school assignments from Location.assignedProviders
    const assignments: SchoolAssignment[] = [];

    for (const locationDoc of locationsSnapshot.docs) {
      const locationData = locationDoc.data() as Location;
      const locationId = locationDoc.id;

      // Get providers from Location.assignedProviders array
      const assignedProviders: ProviderAssignment[] = (locationData.assignedProviders || [])
        .map((providerId) => {
          const provider = providersMap.get(providerId);
          if (!provider) return null;
          
          return {
            userId: provider.id,
            userEmail: provider.email || "",
            displayName: provider.displayName || "Unknown",
            assignedAt: provider.createdAt || Timestamp.now(),
            isActive: provider.isActive,
          };
        })
        .filter((p): p is ProviderAssignment => p !== null);

      assignments.push({
        schoolId: locationId,
        schoolName: locationData.name || "Unknown School",
        schoolAddress: locationData.address || "",
        assignedProviders,
        isActive: locationData.active !== false,
        totalProviders: assignedProviders.length,
        lastUpdated: locationData.updatedAt || locationData.createdAt || Timestamp.now(),
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
    // Verify provider exists
    const userRef = doc(db, COLLECTIONS.USERS, providerId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("Provider not found");
    }

    // Update Location.assignedProviders (single source of truth)
    const locationRef = doc(db, COLLECTIONS.LOCATIONS, schoolId);
    await updateDoc(locationRef, {
      assignedProviders: arrayUnion(providerId),
      updatedAt: Timestamp.now(),
    });
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
    // Update Location.assignedProviders (single source of truth)
    const locationRef = doc(db, COLLECTIONS.LOCATIONS, schoolId);
    await updateDoc(locationRef, {
      assignedProviders: arrayRemove(providerId),
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
    // Get current location data
    const locationRef = doc(db, COLLECTIONS.LOCATIONS, schoolId);
    const locationDoc = await getDoc(locationRef);
    
    if (!locationDoc.exists()) {
      throw new Error("Location not found");
    }
    
    const locationData = locationDoc.data() as Location;
    const currentProviders = locationData.assignedProviders || [];
    
    // Merge new providers with existing (avoiding duplicates)
    const updatedProviders = Array.from(new Set([...currentProviders, ...providerIds]));
    
    await updateDoc(locationRef, {
      assignedProviders: updatedProviders,
      updatedAt: Timestamp.now(),
    });
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
    // Get current location data
    const locationRef = doc(db, COLLECTIONS.LOCATIONS, schoolId);
    const locationDoc = await getDoc(locationRef);
    
    if (!locationDoc.exists()) {
      throw new Error("Location not found");
    }
    
    const locationData = locationDoc.data() as Location;
    const currentProviders = locationData.assignedProviders || [];
    
    // Remove specified providers
    const updatedProviders = currentProviders.filter(
      (providerId) => !providerIds.includes(providerId)
    );
    
    await updateDoc(locationRef, {
      assignedProviders: updatedProviders,
      updatedAt: Timestamp.now(),
    });
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
    // Simply replace the assignedProviders array
    const locationRef = doc(db, COLLECTIONS.LOCATIONS, schoolId);
    await updateDoc(locationRef, {
      assignedProviders: newProviderIds,
      updatedAt: Timestamp.now(),
    });
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

// Get unassigned providers (providers not in any Location.assignedProviders)
export const getUnassignedProviders = async (): Promise<UserRecord[]> => {
  try {
    // Get all active providers
    const providersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider"),
      where("isActive", "==", true)
    );
    const providersSnapshot = await getDocs(providersQuery);

    // Get all locations to check assignedProviders
    const locationsQuery = query(collection(db, COLLECTIONS.LOCATIONS));
    const locationsSnapshot = await getDocs(locationsQuery);

    // Build set of assigned provider IDs
    const assignedProviderIds = new Set<string>();
    locationsSnapshot.docs.forEach((doc) => {
      const locationData = doc.data() as Location;
      (locationData.assignedProviders || []).forEach((providerId) => {
        assignedProviderIds.add(providerId);
      });
    });

    // Filter out assigned providers
    return providersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as UserRecord))
      .filter((provider) => !assignedProviderIds.has(provider.id));
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
