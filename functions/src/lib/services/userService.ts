// Service for handling user data operations and role management

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "../firebase/firestore";

export interface UserRecord {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "provider" | "admin";
  assignedSchools?: string[];
  createdAt: Timestamp;
  lastSignIn?: Timestamp;
  isActive: boolean;
  photoURL?: string | null;
}

export interface UserFormData {
  displayName: string;
  email: string;
  role: "provider" | "admin";
  assignedSchools?: string[];
  isActive: boolean;
}

export interface UserStats {
  totalUsers: number;
  totalProviders: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
}

// Get all users with optional filtering
export const getAllUsers = async (filters?: {
  role?: "provider" | "admin";
  isActive?: boolean;
}): Promise<UserRecord[]> => {
  try {
    let q = query(
      collection(db, COLLECTIONS.USERS),
      orderBy("createdAt", "desc")
    );

    if (filters?.role) {
      q = query(q, where("role", "==", filters.role));
    }

    if (filters?.isActive !== undefined) {
      q = query(q, where("isActive", "==", filters.isActive));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserRecord[];
  } catch (error) {
    console.error("Error getting users:", error);
    throw new Error("Failed to fetch users");
  }
};

// Get user by ID
export const getUserById = async (
  userId: string
): Promise<UserRecord | null> => {
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data(),
      } as UserRecord;
    }
    return null;
  } catch (error) {
    console.error("Error getting user:", error);
    throw new Error("Failed to fetch user");
  }
};

// Update user role
export const updateUserRole = async (
  userId: string,
  role: "provider" | "admin"
): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      role,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    throw new Error("Failed to update user role");
  }
};

// Toggle user active status
export const toggleUserStatus = async (
  userId: string,
  isActive: boolean
): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    throw new Error("Failed to update user status");
  }
};

// Update user's assigned schools (for providers)
export const updateUserSchools = async (
  userId: string,
  assignedSchools: string[]
): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      assignedSchools,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating user schools:", error);
    throw new Error("Failed to update user schools");
  }
};

// Update user profile information
export const updateUserProfile = async (
  userId: string,
  data: Partial<UserFormData>
): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile");
  }
};

// Delete user
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error("Failed to delete user");
  }
};

// Bulk operations for users
export const bulkUpdateUserStatus = async (
  userIds: string[],
  isActive: boolean
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const timestamp = Timestamp.now();

    userIds.forEach((userId) => {
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      batch.update(userRef, {
        isActive,
        updatedAt: timestamp,
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error bulk updating user status:", error);
    throw new Error("Failed to bulk update user status");
  }
};

export const bulkDeleteUsers = async (userIds: string[]): Promise<void> => {
  try {
    const batch = writeBatch(db);

    userIds.forEach((userId) => {
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      batch.delete(userRef);
    });

    await batch.commit();
  } catch (error) {
    console.error("Error bulk deleting users:", error);
    throw new Error("Failed to bulk delete users");
  }
};

// Get user statistics
export const getUserStats = async (): Promise<UserStats> => {
  try {
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    const users = usersSnapshot.docs.map((doc) => doc.data()) as UserRecord[];

    const stats: UserStats = {
      totalUsers: users.length,
      totalProviders: users.filter((user) => user.role === "provider").length,
      totalAdmins: users.filter((user) => user.role === "admin").length,
      activeUsers: users.filter((user) => user.isActive).length,
      inactiveUsers: users.filter((user) => !user.isActive).length,
    };

    return stats;
  } catch (error) {
    console.error("Error getting user stats:", error);
    throw new Error("Failed to fetch user statistics");
  }
};

// Get providers with assigned schools
export const getProvidersWithSchools = async (): Promise<UserRecord[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where("role", "==", "provider"),
      orderBy("displayName")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserRecord[];
  } catch (error) {
    console.error("Error getting providers:", error);
    throw new Error("Failed to fetch providers");
  }
};

// Search users by email or display name
export const searchUsers = async (
  searchTerm: string
): Promise<UserRecord[]> => {
  try {
    // Note: Firestore doesn't support full-text search natively
    // For production, consider using Algolia or similar service
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserRecord[];

    const searchLower = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(searchLower) ||
        user.displayName?.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error("Error searching users:", error);
    throw new Error("Failed to search users");
  }
};
